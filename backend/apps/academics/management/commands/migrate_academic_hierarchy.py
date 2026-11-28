import logging
from django.core.management.base import BaseCommand
from django.db import transaction, models
from django.db.models.functions import Lower

logger = logging.getLogger(__name__)


def run_hierarchy_migration(stdout=None, dry_run=False):
    """
    Core idempotent backfill function to transition to:
    Exam -> AcademicClass -> Subject -> Chapter.
    Can be run from management command or migration RunPython.
    """
    def log(msg):
        if stdout:
            stdout.write(msg)
        logger.info(msg)

    log("[Academic Hierarchy Migration] Starting backfill...")
    if dry_run:
        log("[DRY-RUN MODE] No database changes will be committed.")

    from apps.academics.models import Exam, AcademicClass, Subject, Chapter, Category, Course
    from apps.questions.models import Question
    from apps.materials.models import StudyMaterial
    from apps.content.models import ScheduleEvent
    from apps.coursecontent.models import ContentItem

    # a. Ensure default Exams exist
    jee_main, _ = Exam.objects.get_or_create(
        slug='jee-main',
        defaults={'name': 'JEE Main', 'order': 1, 'is_active': True, 'description': 'Joint Entrance Examination (Main)'}
    )
    jee_adv, _ = Exam.objects.get_or_create(
        slug='jee-advanced',
        defaults={'name': 'JEE Advanced', 'order': 2, 'is_active': True, 'description': 'Joint Entrance Examination (Advanced)'}
    )
    default_exam = Exam.objects.order_by('order', 'id').first()
    log(f"Verified default Exams. Primary default: '{default_exam.name}' (ID: {default_exam.id})")

    # b. Assign every existing AcademicClass to an Exam
    classes_updated = 0
    for ac in AcademicClass.objects.all():
        if getattr(ac, 'exam_id', None) is None:
            ac.exam = default_exam
            ac.save(update_fields=['exam'])
            classes_updated += 1
            log(f"[Backfill] Assigned AcademicClass '{ac.name}' (code: {ac.code}) to Exam '{default_exam.name}'")

    first_class = AcademicClass.objects.order_by('order', 'id').first()
    if not first_class:
        first_class = AcademicClass.objects.create(
            exam=default_exam,
            name='Class 11',
            slug='class-11',
            code='class11',
            order=1
        )
        log(f"[Backfill] Created initial Class 11 for Exam '{default_exam.name}'")

    # Map Course.exam_type to Exam FK
    for course in Course.objects.all():
        if getattr(course, 'exam_id', None) is None:
            raw_type = getattr(course, 'exam_type', 'BOTH')
            if raw_type == 'JEE_ADVANCED':
                course.exam = jee_adv
            elif raw_type == 'JEE_MAIN':
                course.exam = jee_main
            else:
                course.exam = default_exam
                log(f"[Notice] Course '{course.title}' had exam_type='{raw_type}'. Mapped to Exam '{default_exam.name}'.")
            course.save(update_fields=['exam'])

    # c. Group Subject chapters by chapter.academic_class
    for subject in Subject.objects.all():
        # Find chapters belonging to this subject via direct FK or legacy category
        chapters = list(Chapter.objects.filter(
            models.Q(subject=subject) | models.Q(category__subject=subject)
        ).distinct())

        if not chapters:
            if getattr(subject, 'academic_class_id', None) is None:
                subject.academic_class = first_class
                subject.save(update_fields=['academic_class'])
                log(f"[Backfill] Subject '{subject.name}' (ID: {subject.id}) had no chapters. Assigned to Class '{first_class.name}'.")
            continue

        # Group chapters by old chapter.academic_class
        by_class = {}
        for chap in chapters:
            c_class = getattr(chap, 'academic_class', None)
            class_key = c_class.id if c_class else None
            by_class.setdefault(class_key, []).append(chap)

        # Separate into valid classes vs unassigned
        valid_classes = [k for k in by_class.keys() if k is not None]

        if not valid_classes:
            # All chapters in this subject had no academic_class assigned
            target_class = getattr(subject, 'academic_class', None) or first_class
            subject.academic_class = target_class
            subject.save(update_fields=['academic_class'])
            for chap in chapters:
                chap.subject = subject
                chap.save(update_fields=['subject'])
            continue

        # The first valid class group reuses the original Subject row (retains ID)
        first_class_id = valid_classes[0]
        first_group_class = AcademicClass.objects.get(id=first_class_id)
        subject.academic_class = first_group_class
        subject.save(update_fields=['academic_class'])

        for chap in by_class[first_class_id]:
            chap.subject = subject
            chap.save(update_fields=['subject'])

        # Remaining valid class groups get a cloned Subject
        for class_id in valid_classes[1:]:
            target_class = AcademicClass.objects.get(id=class_id)
            group_chapters = by_class[class_id]

            # Check if a subject for this (academic_class, name) already exists
            existing_clone = Subject.objects.filter(
                academic_class=target_class,
                name__iexact=subject.name
            ).first()

            if not existing_clone:
                existing_clone = Subject.objects.create(
                    academic_class=target_class,
                    name=subject.name,
                    slug=subject.slug,
                    description=subject.description,
                    icon=subject.icon,
                    color_hex=subject.color_hex,
                    topics=subject.topics,
                    order=subject.order,
                    is_visible=subject.is_visible,
                )
                log(f"[Backfill] Cloned Subject '{subject.name}' for Class '{target_class.name}' (New ID: {existing_clone.id})")

            # Repoint Category & Chapters
            for chap in group_chapters:
                chap.subject = existing_clone
                if chap.category:
                    # Ensure Category exists under the new Subject
                    cat, _ = Category.objects.get_or_create(
                        subject=existing_clone,
                        slug=chap.category.slug,
                        defaults={'name': chap.category.name}
                    )
                    chap.category = cat
                chap.save(update_fields=['subject', 'category'])

            # Repoint Question, StudyMaterial, ScheduleEvent, ContentItem
            q_count = Question.objects.filter(chapter__in=group_chapters).update(subject=existing_clone)
            m_count = StudyMaterial.objects.filter(chapter__in=group_chapters).update(subject=existing_clone)
            s_count = ScheduleEvent.objects.filter(chapter__in=group_chapters).update(subject=existing_clone)
            c_count = ContentItem.objects.filter(chapter__in=group_chapters).update(subject=existing_clone)
            log(f"[Backfill] Repointed {q_count} questions, {m_count} materials, {s_count} events to Subject '{existing_clone.name}' ({target_class.name})")

            # Update Course.subjects M2M for courses that teach this class
            for crs in Course.objects.filter(classes=target_class, subjects=subject):
                crs.subjects.add(existing_clone)

        # Any unassigned chapters default to the original subject
        if None in by_class:
            for chap in by_class[None]:
                chap.subject = subject
                chap.save(update_fields=['subject'])

    # Final Verification Checks
    assert Exam.objects.count() > 0, "Verification failed: No Exams exist."
    assert AcademicClass.objects.filter(exam__isnull=True).count() == 0, "Verification failed: AcademicClass with null exam found."
    assert Subject.objects.filter(academic_class__isnull=True).count() == 0, "Verification failed: Subject with null academic_class found."
    assert Chapter.objects.filter(subject__isnull=True).count() == 0, "Verification failed: Chapter with null subject found."

    # Check for duplicate (academic_class, lower(name))
    dupes = Subject.objects.annotate(
        lower_name=Lower('name')
    ).values('academic_class', 'lower_name').annotate(
        c=models.Count('id')
    ).filter(c__gt=1)
    assert not dupes.exists(), f"Verification failed: Duplicate subjects inside same class: {list(dupes)}"

    log("[Academic Hierarchy Migration] Verification completed: All checks passed with zero orphans and valid hierarchy.")


class Command(BaseCommand):
    help = "Idempotently migrates existing academic data to the Exam -> AcademicClass -> Subject -> Chapter hierarchy."

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Simulate migration and verify constraints without committing changes.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        self.stdout.write(self.style.WARNING("REMINDER: Ensure a database backup (pg_dump) has been taken before proceeding."))

        if dry_run:
            self.stdout.write(self.style.NOTICE("Running in DRY-RUN mode inside an atomic rollback transaction..."))
            try:
                with transaction.atomic():
                    run_hierarchy_migration(stdout=self.stdout, dry_run=True)
                    raise RuntimeError("__ROLLBACK_DRY_RUN__")
            except RuntimeError as e:
                if str(e) == "__ROLLBACK_DRY_RUN__":
                    self.stdout.write(self.style.SUCCESS("[DRY-RUN COMPLETE] Successfully simulated migration. Rolled back all changes."))
                else:
                    raise
        else:
            with transaction.atomic():
                run_hierarchy_migration(stdout=self.stdout, dry_run=False)
            self.stdout.write(self.style.SUCCESS("[SUCCESS] Academic hierarchy migration committed successfully!"))
