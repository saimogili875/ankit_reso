import re
from rest_framework import serializers
from django.db import transaction
from django.utils.text import slugify

from apps.academics.models import (
    Exam, AcademicClass, Subject, Category, Chapter, Topic, Lecture, Course, Enrollment
)
from apps.content.models import (
    Video, HeroSlide, QuickAccessItem, Announcement, Doubt,
    ScheduleEvent, Notification,
    LandingBanner, LandingBannerSettings
)
from apps.questions.models import (
    Question, QuestionOption, PYQ, DPP, DPPQuestion
)
from apps.materials.models import StudyMaterial
from apps.tests.models import Test, TestQuestion, TestAttempt, TestSeries
from apps.accounts.models import User, StudentProfile
from apps.progress.models import DPPAttempt, VideoProgress
from apps.analytics.models import RankPredictor


def extract_youtube_id(value: str) -> str:
    """
    Extracts an 11-character YouTube video ID from various YouTube URL formats
    or validates an existing 11-character ID.
    """
    if not value:
        return ""
    val = value.strip()
    if len(val) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', val):
        return val

    # Match common YouTube URL patterns:
    # - https://www.youtube.com/watch?v=VIDEO_ID
    # - https://youtu.be/VIDEO_ID
    # - https://www.youtube.com/embed/VIDEO_ID
    # - https://www.youtube.com/shorts/VIDEO_ID
    # - https://www.youtube.com/v/VIDEO_ID
    pattern = r'(?:v=|\/youtu\.be\/|\/embed\/|\/shorts\/|\/v\/|^)([a-zA-Z0-9_-]{11})(?:[&?\/]|$)'
    match = re.search(pattern, val)
    if match:
        return match.group(1)

    raise serializers.ValidationError(
        "Invalid YouTube video ID or URL. Please provide an 11-character ID or standard YouTube URL."
    )


class AdminQuestionOptionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = QuestionOption
        fields = ['id', 'option_text', 'is_correct']


class AdminPYQSerializer(serializers.ModelSerializer):
    exam_name = serializers.CharField(source='exam.name', read_only=True)

    class Meta:
        model = PYQ
        fields = ['id', 'exam', 'exam_name', 'year', 'shift_or_paper']


class AdminQuestionSerializer(serializers.ModelSerializer):
    options = AdminQuestionOptionSerializer(many=True, required=False)
    pyq_meta = AdminPYQSerializer(read_only=True)

    # Optional PYQ write fields
    pyq_exam = serializers.PrimaryKeyRelatedField(
        queryset=Exam.objects.all(), required=False, allow_null=True, write_only=True
    )
    pyq_year = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    pyq_shift_or_paper = serializers.CharField(
        required=False, allow_blank=True, default='', write_only=True
    )

    subject_id = serializers.IntegerField(source='subject.id', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    class_id = serializers.UUIDField(source='subject.academic_class.id', read_only=True, allow_null=True)
    class_name = serializers.CharField(source='subject.academic_class.name', read_only=True, default='')
    exam_id = serializers.UUIDField(source='subject.academic_class.exam.id', read_only=True, allow_null=True)
    exam_name = serializers.CharField(source='subject.academic_class.exam.name', read_only=True, default='')
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    topic_name = serializers.CharField(source='topic.name', read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'topic', 'topic_name', 'subject', 'subject_id', 'subject_name', 'subject_label',
            'class_id', 'class_name', 'exam_id', 'exam_name',
            'chapter', 'chapter_name', 'question_text', 'solution_text',
            'solution_video_url', 'difficulty', 'question_type',
            'options', 'pyq_meta', 'pyq_exam', 'pyq_year', 'pyq_shift_or_paper',
            'created_at', 'updated_at'
        ]

    def get_subject_label(self, obj):
        if obj.subject and obj.subject.academic_class:
            return f"{obj.subject.academic_class.name} · {obj.subject.name}"
        return obj.subject.name if obj.subject else ''

    def validate(self, data):
        question_text = data.get('question_text')
        if question_text is not None and not question_text.strip():
            raise serializers.ValidationError({"question_text": "Question text cannot be empty."})

        # Derive subject from chapter or topic if missing
        subject = data.get('subject') or getattr(self.instance, 'subject', None)
        chapter = data.get('chapter') or getattr(self.instance, 'chapter', None)
        topic = data.get('topic') or getattr(self.instance, 'topic', None)

        if not subject:
            if chapter and hasattr(chapter, 'subject') and chapter.subject:
                subject = chapter.subject
                data['subject'] = subject
            elif topic and topic.chapter and topic.chapter.subject:
                subject = topic.chapter.subject
                data['subject'] = subject

        if chapter and subject and chapter.subject_id != subject.id:
            raise serializers.ValidationError({
                "chapter": f"Chapter '{chapter.name}' belongs to subject '{chapter.subject.name}', not '{subject.name}'."
            })

        # Validate options if provided
        options_data = self.initial_data.get('options')
        if options_data is not None:
            if not isinstance(options_data, list):
                raise serializers.ValidationError({"options": "Options must be a list."})

            q_type = data.get('question_type', getattr(self.instance, 'question_type', Question.QuestionType.SINGLE_CHOICE))
            correct_count = sum(1 for opt in options_data if opt.get('is_correct') is True)

            for opt in options_data:
                if not str(opt.get('option_text', '')).strip():
                    raise serializers.ValidationError({"options": "Option text cannot be empty."})

            if q_type == Question.QuestionType.SINGLE_CHOICE:
                if len(options_data) < 2:
                    raise serializers.ValidationError(
                        {"options": "Single choice questions require at least 2 options."}
                    )
                if correct_count != 1:
                    raise serializers.ValidationError(
                        {"options": "Single choice questions must have exactly 1 correct option."}
                    )
            elif q_type == Question.QuestionType.MULTIPLE_CHOICE:
                if len(options_data) < 2:
                    raise serializers.ValidationError(
                        {"options": "Multiple choice questions require at least 2 options."}
                    )
                if correct_count < 1:
                    raise serializers.ValidationError(
                        {"options": "Multiple choice questions must have at least 1 correct option."}
                    )
            elif q_type == Question.QuestionType.NUMERICAL:
                if len(options_data) != 1:
                    raise serializers.ValidationError(
                        {"options": "Numerical questions must have exactly 1 option representing the answer."}
                    )
                if not options_data[0].get('is_correct'):
                    raise serializers.ValidationError(
                        {"options": "The numerical answer option must be marked as correct."}
                    )

        return data

    @transaction.atomic
    def create(self, validated_data):
        options_data = self.initial_data.get('options', [])
        pyq_exam = validated_data.pop('pyq_exam', None)
        pyq_year = validated_data.pop('pyq_year', None)
        pyq_shift_or_paper = validated_data.pop('pyq_shift_or_paper', '')
        validated_data.pop('options', None)

        question = Question.objects.create(**validated_data)

        # Create nested options
        for opt in options_data:
            QuestionOption.objects.create(
                question=question,
                option_text=opt.get('option_text', '').strip(),
                is_correct=bool(opt.get('is_correct', False))
            )

        # Create PYQ metadata if provided
        if pyq_exam and pyq_year:
            PYQ.objects.create(
                question=question,
                exam=pyq_exam,
                year=pyq_year,
                shift_or_paper=pyq_shift_or_paper or ''
            )

        return question

    @transaction.atomic
    def update(self, instance, validated_data):
        options_data = self.initial_data.get('options')
        has_pyq_exam = 'pyq_exam' in validated_data
        pyq_exam = validated_data.pop('pyq_exam', None)
        pyq_year = validated_data.pop('pyq_year', None)
        pyq_shift_or_paper = validated_data.pop('pyq_shift_or_paper', '')
        validated_data.pop('options', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Update options if explicitly provided
        if options_data is not None:
            instance.options.all().delete()
            for opt in options_data:
                QuestionOption.objects.create(
                    question=instance,
                    option_text=opt.get('option_text', '').strip(),
                    is_correct=bool(opt.get('is_correct', False))
                )

        # Update or delete PYQ
        if has_pyq_exam:
            if pyq_exam and pyq_year:
                PYQ.objects.update_or_create(
                    question=instance,
                    defaults={
                        'exam': pyq_exam,
                        'year': pyq_year,
                        'shift_or_paper': pyq_shift_or_paper or ''
                    }
                )
            else:
                PYQ.objects.filter(question=instance).delete()

        return instance


class AdminChapterSerializer(serializers.ModelSerializer):
    subject_id = serializers.IntegerField(source='subject.id', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    academic_class_id = serializers.UUIDField(source='subject.academic_class.id', read_only=True)
    academic_class_name = serializers.CharField(source='subject.academic_class.name', read_only=True)
    class_id = serializers.UUIDField(source='subject.academic_class.id', read_only=True)
    class_name = serializers.CharField(source='subject.academic_class.name', read_only=True)
    exam_id = serializers.UUIDField(source='subject.academic_class.exam.id', read_only=True)
    exam_name = serializers.CharField(source='subject.academic_class.exam.name', read_only=True)
    category_name = serializers.CharField(source='category.name', read_only=True, default='')

    lectures_count = serializers.SerializerMethodField()
    dpps_count = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()

    class Meta:
        model = Chapter
        fields = [
            'id', 'subject', 'subject_id', 'subject_name', 'subject_label',
            'academic_class_id', 'academic_class_name', 'class_id', 'class_name',
            'exam_id', 'exam_name',
            'category', 'category_name', 'name', 'slug', 'order',
            'description', 'lectures_count', 'dpps_count', 'questions_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']
        validators = []

    def get_subject_label(self, obj):
        if obj.subject and obj.subject.academic_class:
            return f"{obj.subject.academic_class.name} · {obj.subject.name}"
        return obj.subject.name if obj.subject else ''

    def get_lectures_count(self, obj):
        return obj.lectures.count()

    def get_dpps_count(self, obj):
        return obj.dpps.count()

    def get_questions_count(self, obj):
        return obj.questions.count()

    def validate(self, data):
        subject = data.get('subject') or getattr(self.instance, 'subject', None)
        category = data.get('category') or getattr(self.instance, 'category', None)

        if not subject and category and category.subject:
            subject = category.subject
            data['subject'] = subject

        if not subject:
            raise serializers.ValidationError({"subject": "Subject is required for a chapter."})

        if category and category.subject_id != subject.id:
            raise serializers.ValidationError({
                "category": f"Category '{category.name}' belongs to subject '{category.subject.name}', not '{subject.name}'."
            })

        name = data.get('name') or getattr(self.instance, 'name', '')
        name = name.strip()
        if not name:
            raise serializers.ValidationError({"name": "Chapter name is required."})

        # Name uniqueness per subject
        qs_name = Chapter.objects.filter(subject=subject, name__iexact=name)
        if self.instance:
            qs_name = qs_name.exclude(pk=self.instance.pk)
        if qs_name.exists():
            raise serializers.ValidationError({"name": f"Chapter '{name}' already exists in {subject.name}."})

        # Auto-generate slug scoped per subject
        base_slug = slugify(name) or 'chapter'
        slug = base_slug
        counter = 1
        qs = Chapter.objects.filter(subject=subject, slug=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        while qs.exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
            qs = Chapter.objects.filter(subject=subject, slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
        data['slug'] = slug
        return data


class AdminLectureSerializer(serializers.ModelSerializer):
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    subject_id = serializers.IntegerField(source='chapter.subject.id', read_only=True)
    subject_name = serializers.CharField(source='chapter.subject.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    class_id = serializers.UUIDField(source='chapter.subject.academic_class.id', read_only=True, allow_null=True)
    class_name = serializers.CharField(source='chapter.subject.academic_class.name', read_only=True, default='')
    exam_id = serializers.UUIDField(source='chapter.subject.academic_class.exam.id', read_only=True, allow_null=True)
    exam_name = serializers.CharField(source='chapter.subject.academic_class.exam.name', read_only=True, default='')
    video = serializers.SerializerMethodField()

    class Meta:
        model = Lecture
        fields = [
            'id', 'chapter', 'chapter_name', 'subject_id', 'subject_name',
            'subject_label', 'class_id', 'class_name', 'exam_id', 'exam_name', 'lecture_number',
            'title', 'slug', 'description', 'duration_seconds', 'is_published',
            'order', 'video', 'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']
        validators = []

    def get_subject_label(self, obj):
        if obj.chapter and obj.chapter.subject and obj.chapter.subject.academic_class:
            return f"{obj.chapter.subject.academic_class.name} · {obj.chapter.subject.name}"
        return obj.chapter.subject.name if (obj.chapter and obj.chapter.subject) else ''

    def get_video(self, obj):
        v = obj.videos.first()
        if not v:
            return None
        return {
            'id': v.id,
            'title': v.title,
            'video_source_type': v.video_source_type,
            'youtube_video_id': v.youtube_video_id,
            'r2_object_key': v.r2_object_key,
            'duration_seconds': v.duration_seconds,
        }

    def validate(self, data):
        title = data.get('title') or getattr(self.instance, 'title', '')
        if not title.strip():
            raise serializers.ValidationError({"title": "Lecture title is required."})

        base_slug = slugify(title)
        slug = base_slug
        counter = 1
        qs = Lecture.objects.filter(slug=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        while qs.exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
            qs = Lecture.objects.filter(slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
        data['slug'] = slug
        return data


class AdminVideoSerializer(serializers.ModelSerializer):
    lecture_title = serializers.CharField(source='lecture.title', read_only=True)
    chapter_name = serializers.CharField(source='lecture.chapter.name', read_only=True)
    topic_name = serializers.CharField(source='topic.name', read_only=True)

    class Meta:
        model = Video
        fields = [
            'id', 'lecture', 'lecture_title', 'chapter_name', 'topic', 'topic_name',
            'title', 'description', 'duration_seconds', 'video_source_type',
            'status', 'processing_progress', 'error_message',
            'original_key', 'hls_manifest_key', 'poster_key', 'sprite_key', 'vtt_key',
            'source_width', 'source_height', 'source_fps', 'file_size', 'renditions',
            'youtube_video_id', 'r2_object_key', 'thumbnail_key',
            'is_free_preview', 'is_published', 'processed_at', 'created_at', 'updated_at'
        ]

    def validate(self, data):
        lecture = data.get('lecture', getattr(self.instance, 'lecture', None))
        topic = data.get('topic', getattr(self.instance, 'topic', None))
        if not lecture and not topic:
            raise serializers.ValidationError("At least one of 'lecture' or 'topic' is required.")

        duration = data.get('duration_seconds', getattr(self.instance, 'duration_seconds', 0))
        if duration is not None and duration < 0:
            raise serializers.ValidationError({"duration_seconds": "Duration must be greater than or equal to 0."})

        v_type = data.get('video_source_type', getattr(self.instance, 'video_source_type', Video.VideoSourceType.YOUTUBE))
        if v_type == Video.VideoSourceType.YOUTUBE:
            raw_youtube = data.get('youtube_video_id', getattr(self.instance, 'youtube_video_id', None))
            if not raw_youtube:
                raise serializers.ValidationError({"youtube_video_id": "YouTube video ID or URL is required for YouTube videos."})
            data['youtube_video_id'] = extract_youtube_id(raw_youtube)
        elif v_type == Video.VideoSourceType.CLOUD:
            r2_key = data.get('r2_object_key', getattr(self.instance, 'r2_object_key', None))
            orig_key = data.get('original_key', getattr(self.instance, 'original_key', None))
            hls_key = data.get('hls_manifest_key', getattr(self.instance, 'hls_manifest_key', None))
            if not (r2_key or orig_key or hls_key):
                raise serializers.ValidationError({"r2_object_key": "Cloudflare R2 object key or video file is required for Cloud hosted videos."})

        return data


class AdminDPPQuestionSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    difficulty = serializers.CharField(source='question.difficulty', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)

    class Meta:
        model = DPPQuestion
        fields = [
            'id', 'question', 'question_text', 'difficulty', 'question_type',
            'order', 'positive_marks', 'negative_marks'
        ]


class AdminDPPSerializer(serializers.ModelSerializer):
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    subject_id = serializers.IntegerField(source='chapter.subject.id', read_only=True)
    subject_name = serializers.CharField(source='chapter.subject.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    class_id = serializers.UUIDField(source='chapter.subject.academic_class.id', read_only=True, allow_null=True)
    class_name = serializers.CharField(source='chapter.subject.academic_class.name', read_only=True, default='')
    exam_id = serializers.UUIDField(source='chapter.subject.academic_class.exam.id', read_only=True, allow_null=True)
    exam_name = serializers.CharField(source='chapter.subject.academic_class.exam.name', read_only=True, default='')
    dpp_questions = AdminDPPQuestionSerializer(many=True, read_only=True)
    questions_count = serializers.SerializerMethodField()

    question_ids = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True
    )
    positive_marks = serializers.IntegerField(default=4, required=False, write_only=True)
    negative_marks = serializers.IntegerField(default=1, required=False, write_only=True)

    class Meta:
        model = DPP
        fields = [
            'id', 'chapter', 'chapter_name', 'subject_id', 'subject_name',
            'subject_label', 'class_id', 'class_name', 'exam_id', 'exam_name', 'dpp_number',
            'title', 'description', 'duration_minutes', 'is_published',
            'questions_count', 'dpp_questions', 'question_ids',
            'positive_marks', 'negative_marks', 'created_at', 'updated_at'
        ]

    def get_subject_label(self, obj):
        if obj.chapter and obj.chapter.subject and obj.chapter.subject.academic_class:
            return f"{obj.chapter.subject.academic_class.name} · {obj.chapter.subject.name}"
        return obj.chapter.subject.name if (obj.chapter and obj.chapter.subject) else ''

    def get_questions_count(self, obj):
        return obj.dpp_questions.count()

    def validate(self, data):
        q_ids = self.initial_data.get('question_ids')
        if q_ids is not None:
            if not isinstance(q_ids, list):
                raise serializers.ValidationError({"question_ids": "question_ids must be a list of question IDs."})
            if q_ids:
                str_ids = [str(x) for x in q_ids]
                existing_ids = set(str(qid) for qid in Question.objects.filter(id__in=str_ids).values_list('id', flat=True))
                missing = [qid for qid in str_ids if qid not in existing_ids]
                if missing:
                    raise serializers.ValidationError(
                        {"question_ids": f"Questions with IDs {missing} do not exist."}
                    )
        return data

    @transaction.atomic
    def create(self, validated_data):
        q_ids = validated_data.pop('question_ids', None)
        pos_marks = validated_data.pop('positive_marks', 4)
        neg_marks = validated_data.pop('negative_marks', 1)

        dpp = DPP.objects.create(**validated_data)

        if q_ids:
            for idx, qid in enumerate(q_ids):
                DPPQuestion.objects.create(
                    dpp=dpp,
                    question_id=qid,
                    order=idx + 1,
                    positive_marks=pos_marks,
                    negative_marks=neg_marks
                )
        return dpp

    @transaction.atomic
    def update(self, instance, validated_data):
        has_q_ids = 'question_ids' in self.initial_data
        q_ids = validated_data.pop('question_ids', None)
        pos_marks = validated_data.pop('positive_marks', 4)
        neg_marks = validated_data.pop('negative_marks', 1)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if has_q_ids:
            instance.dpp_questions.all().delete()
            if q_ids:
                for idx, qid in enumerate(q_ids):
                    DPPQuestion.objects.create(
                        dpp=instance,
                        question_id=qid,
                        order=idx + 1,
                        positive_marks=pos_marks,
                        negative_marks=neg_marks
                    )

        return instance


class AdminHeroSlideSerializer(serializers.ModelSerializer):
    class Meta:
        model = HeroSlide
        fields = '__all__'


class AdminQuickAccessSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuickAccessItem
        fields = '__all__'


class AdminExamSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    classes_count = serializers.SerializerMethodField()

    class Meta:
        model = Exam
        fields = [
            'id', 'name', 'slug', 'description', 'order', 'is_active',
            'classes_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_classes_count(self, obj):
        return obj.classes.count()

    def validate_name(self, value):
        trimmed = value.strip() if value else ''
        if not trimmed:
            raise serializers.ValidationError("Exam name cannot be empty.")
        qs = Exam.objects.filter(name__iexact=trimmed)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("An exam with this name already exists.")
        return trimmed

    def create(self, validated_data):
        if not validated_data.get('slug'):
            base_slug = slugify(validated_data['name']) or 'exam'
            slug = base_slug
            counter = 1
            while Exam.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        return super().create(validated_data)


class AdminAcademicClassSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    exam_id = serializers.UUIDField(source='exam.id', read_only=True)
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    subjects_count = serializers.SerializerMethodField()
    chapters_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicClass
        fields = [
            'id', 'exam', 'exam_id', 'exam_name', 'name', 'slug', 'code',
            'order', 'subjects_count', 'chapters_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        validators = []

    def get_subjects_count(self, obj):
        return obj.subjects.count()

    def get_chapters_count(self, obj):
        return Chapter.objects.filter(subject__academic_class=obj).count()

    def validate(self, data):
        exam = data.get('exam') or getattr(self.instance, 'exam', None)
        if not exam:
            raise serializers.ValidationError({"exam": "Exam is required for an academic class."})

        name = data.get('name') or getattr(self.instance, 'name', '')
        name = name.strip()
        if not name:
            raise serializers.ValidationError({"name": "Class name cannot be empty."})

        code = data.get('code') or getattr(self.instance, 'code', '')
        code = code.strip() if code else ''

        qs_name = AcademicClass.objects.filter(exam=exam, name__iexact=name)
        if self.instance:
            qs_name = qs_name.exclude(pk=self.instance.pk)
        if qs_name.exists():
            raise serializers.ValidationError({"name": f"Class '{name}' already exists in exam '{exam.name}'."})

        if code:
            qs_code = AcademicClass.objects.filter(exam=exam, code=code)
            if self.instance:
                qs_code = qs_code.exclude(pk=self.instance.pk)
            if qs_code.exists():
                raise serializers.ValidationError({"code": f"Class code '{code}' already exists in exam '{exam.name}'."})

        if not data.get('slug'):
            base_slug = slugify(name) or 'class'
            slug = base_slug
            counter = 1
            qs_slug = AcademicClass.objects.filter(exam=exam, slug=slug)
            if self.instance:
                qs_slug = qs_slug.exclude(pk=self.instance.pk)
            while qs_slug.exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs_slug = AcademicClass.objects.filter(exam=exam, slug=slug)
                if self.instance:
                    qs_slug = qs_slug.exclude(pk=self.instance.pk)
            data['slug'] = slug

        return data


class AdminSubjectSerializer(serializers.ModelSerializer):
    slug = serializers.SlugField(required=False, allow_blank=True)
    academic_class_id = serializers.UUIDField(source='academic_class.id', read_only=True)
    class_id = serializers.UUIDField(source='academic_class.id', read_only=True)
    class_name = serializers.CharField(source='academic_class.name', read_only=True)
    exam_id = serializers.UUIDField(source='academic_class.exam.id', read_only=True)
    exam_name = serializers.CharField(source='academic_class.exam.name', read_only=True)
    subject_id = serializers.IntegerField(source='id', read_only=True)
    subject_name = serializers.CharField(source='name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    categories_count = serializers.SerializerMethodField()
    chapters_count = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = [
            'id', 'academic_class', 'academic_class_id', 'class_id', 'class_name',
            'exam_id', 'exam_name', 'subject_id', 'subject_name', 'name', 'slug', 'subject_label',
            'description', 'icon', 'color_hex', 'topics', 'order',
            'is_visible', 'categories_count', 'chapters_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        validators = []

    def get_subject_label(self, obj):
        if obj.academic_class:
            return f"{obj.academic_class.name} · {obj.name}"
        return obj.name

    def get_categories_count(self, obj):
        return obj.categories.count()

    def get_chapters_count(self, obj):
        return obj.chapters.count()

    def validate(self, data):
        academic_class = data.get('academic_class') or getattr(self.instance, 'academic_class', None)
        if not academic_class:
            raise serializers.ValidationError({"academic_class": "Academic class is required for a subject."})

        name = data.get('name') or getattr(self.instance, 'name', '')
        name = name.strip()
        if not name:
            raise serializers.ValidationError({"name": "Subject name cannot be empty."})

        qs_name = Subject.objects.filter(academic_class=academic_class, name__iexact=name)
        if self.instance:
            qs_name = qs_name.exclude(pk=self.instance.pk)
        if qs_name.exists():
            raise serializers.ValidationError({"name": f"Subject '{name}' already exists in {academic_class.name}."})

        if not data.get('slug'):
            base_slug = slugify(name) or 'subject'
            slug = base_slug
            counter = 1
            qs_slug = Subject.objects.filter(academic_class=academic_class, slug=slug)
            if self.instance:
                qs_slug = qs_slug.exclude(pk=self.instance.pk)
            while qs_slug.exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs_slug = Subject.objects.filter(academic_class=academic_class, slug=slug)
                if self.instance:
                    qs_slug = qs_slug.exclude(pk=self.instance.pk)
            data['slug'] = slug

        return data


class AdminCategorySerializer(serializers.ModelSerializer):
    subject_id = serializers.IntegerField(source='subject.id', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    chapters_count = serializers.SerializerMethodField()

    class Meta:
        model = Category
        fields = [
            'id', 'subject', 'subject_id', 'subject_name', 'subject_label',
            'name', 'slug', 'chapters_count', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        validators = []
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def get_subject_label(self, obj):
        if obj.subject and obj.subject.academic_class:
            return f"{obj.subject.academic_class.name} · {obj.subject.name}"
        return obj.subject.name if obj.subject else ''

    def get_chapters_count(self, obj):
        return obj.chapters.count()

    def validate(self, data):
        subject = data.get('subject') or getattr(self.instance, 'subject', None)
        if not subject:
            raise serializers.ValidationError({"subject": "Subject is required for a category."})

        name = data.get('name') or getattr(self.instance, 'name', '')
        name = name.strip()
        if not name:
            raise serializers.ValidationError({"name": "Category name cannot be empty."})

        if not data.get('slug'):
            base_slug = slugify(name) or 'category'
            slug = base_slug
            counter = 1
            qs_slug = Category.objects.filter(subject=subject, slug=slug)
            if self.instance:
                qs_slug = qs_slug.exclude(pk=self.instance.pk)
            while qs_slug.exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs_slug = Category.objects.filter(subject=subject, slug=slug)
                if self.instance:
                    qs_slug = qs_slug.exclude(pk=self.instance.pk)
            data['slug'] = slug

        return data


class AdminTopicSerializer(serializers.ModelSerializer):
    chapter_id = serializers.UUIDField(source='chapter.id', read_only=True)
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    subject_id = serializers.IntegerField(source='chapter.subject.id', read_only=True)
    subject_name = serializers.CharField(source='chapter.subject.name', read_only=True)

    class Meta:
        model = Topic
        fields = [
            'id', 'chapter', 'chapter_id', 'chapter_name',
            'subject_id', 'subject_name', 'name', 'slug', 'order',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def validate(self, data):
        chapter = data.get('chapter') or getattr(self.instance, 'chapter', None)
        if not chapter:
            raise serializers.ValidationError({"chapter": "Chapter is required for a topic."})

        name = data.get('name') or getattr(self.instance, 'name', '')
        name = name.strip()
        if not name:
            raise serializers.ValidationError({"name": "Topic name cannot be empty."})

        if not data.get('slug'):
            base_slug = slugify(name) or 'topic'
            slug = base_slug
            counter = 1
            qs_slug = Topic.objects.filter(chapter=chapter, slug=slug)
            if self.instance:
                qs_slug = qs_slug.exclude(pk=self.instance.pk)
            while qs_slug.exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
                qs_slug = Topic.objects.filter(chapter=chapter, slug=slug)
                if self.instance:
                    qs_slug = qs_slug.exclude(pk=self.instance.pk)
            data['slug'] = slug

        return data


class AdminCourseSerializer(serializers.ModelSerializer):
    enrolled_count = serializers.SerializerMethodField()
    classes_names = serializers.SerializerMethodField()
    subjects_names = serializers.SerializerMethodField()
    exam_name = serializers.CharField(source='exam.name', read_only=True, default='')
    category_name = serializers.CharField(source='category.name', read_only=True, default='')
    category_slug = serializers.CharField(source='category.slug', read_only=True, default='')
    academic_class_name = serializers.CharField(source='academic_class.name', read_only=True, default='')

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'tagline', 'description',
            'image', 'thumbnail_url', 'exam', 'exam_name', 'exam_type', 'price', 'original_price',
            'discount_badge', 'is_free', 'features', 'has_live_classes', 'display_order',
            'category', 'category_name', 'category_slug',
            'academic_class', 'academic_class_name',
            'start_date', 'end_date',
            'status', 'is_published', 'allow_self_enrollment',
            'classes', 'subjects', 'classes_names', 'subjects_names',
            'enrolled_count', 'created_at', 'updated_at'
        ]
        extra_kwargs = {
            'slug': {'required': False, 'allow_blank': True},
        }

    def validate_title(self, value):
        trimmed = value.strip() if value else ''
        if not trimmed:
            raise serializers.ValidationError("Course title cannot be empty.")
        qs = Course.objects.filter(title__iexact=trimmed)
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("A course with this title already exists.")
        return trimmed

    def validate(self, data):
        exam = data.get('exam') or (self.instance.exam if self.instance else None)
        classes = data.get('classes')
        if classes is not None and exam:
            for cls in classes:
                if cls.exam_id != exam.id:
                    raise serializers.ValidationError({
                        "classes": f"Class '{cls.name}' belongs to exam '{cls.exam.name}', not '{exam.name}'."
                    })

        subjects = data.get('subjects')
        if subjects is not None:
            allowed_classes = set(classes) if classes is not None else (set(self.instance.classes.all()) if self.instance else set())
            if allowed_classes:
                for subj in subjects:
                    if subj.academic_class not in allowed_classes:
                        raise serializers.ValidationError({
                            "subjects": f"Subject '{subj.name}' ({subj.academic_class.name}) does not belong to any selected class for this course."
                        })
        return data

    def get_enrolled_count(self, obj):
        return obj.enrollments.count()

    def get_classes_names(self, obj):
        return [c.name for c in obj.classes.all()]

    def get_subjects_names(self, obj):
        return [f"{s.academic_class.name} · {s.name}" if s.academic_class else s.name for s in obj.subjects.all()]

    def create(self, validated_data):
        if not validated_data.get('slug'):
            base_slug = slugify(validated_data.get('title', 'course')) or 'course'
            slug = base_slug
            counter = 2
            while Course.objects.filter(slug=slug).exists():
                slug = f"{base_slug}-{counter}"
                counter += 1
            validated_data['slug'] = slug
        if 'status' in validated_data:
            validated_data['is_published'] = (validated_data['status'] == 'PUBLISHED')
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'status' in validated_data:
            validated_data['is_published'] = (validated_data['status'] == 'PUBLISHED')
        return super().update(instance, validated_data)


class AdminTestSeriesSerializer(serializers.ModelSerializer):
    tests_count = serializers.SerializerMethodField()
    course_title = serializers.CharField(source='course.title', read_only=True)
    addon_title = serializers.CharField(source='course_addon.title', read_only=True, default='')

    class Meta:
        model = TestSeries
        fields = [
            'id', 'title', 'description', 'course', 'course_title',
            'order', 'is_published', 'price', 'course_addon', 'addon_title',
            'tests_count', 'created_at', 'updated_at'
        ]

    def get_tests_count(self, obj):
        return obj.tests.count()


class AdminTestQuestionSerializer(serializers.ModelSerializer):
    question_text = serializers.CharField(source='question.question_text', read_only=True)
    question_type = serializers.CharField(source='question.question_type', read_only=True)
    difficulty = serializers.CharField(source='question.difficulty', read_only=True)

    class Meta:
        model = TestQuestion
        fields = [
            'id', 'question', 'question_text', 'question_type',
            'difficulty', 'positive_marks', 'negative_marks', 'order'
        ]


class AdminTestSerializer(serializers.ModelSerializer):
    exam_name = serializers.CharField(source='exam.name', read_only=True)
    test_questions = AdminTestQuestionSerializer(many=True, read_only=True)
    questions_count = serializers.SerializerMethodField()
    attempts_count = serializers.SerializerMethodField()

    question_ids = serializers.ListField(
        child=serializers.CharField(), required=False, write_only=True
    )
    positive_marks = serializers.DecimalField(max_digits=4, decimal_places=1, default=4.0, required=False, write_only=True)
    negative_marks = serializers.DecimalField(max_digits=4, decimal_places=1, default=1.0, required=False, write_only=True)

    course_title = serializers.CharField(source='course.title', read_only=True)
    test_series_title = serializers.CharField(source='test_series.title', read_only=True, default='')

    def to_internal_value(self, data):
        if isinstance(data, dict) and 'test_type' in data:
            val = str(data.get('test_type') or '').strip().upper()
            mapping = {
                'FULL': Test.TestType.MOCK,
                'SUBJECT': Test.TestType.SECTIONAL,
            }
            mapped_val = mapping.get(val, val)
            data = data.copy()
            data['test_type'] = mapped_val
        return super().to_internal_value(data)

    def validate_test_type(self, value):
        if not value:
            return value
        val_upper = str(value).strip().upper()
        mapping = {
            'FULL': Test.TestType.MOCK,
            'SUBJECT': Test.TestType.SECTIONAL,
        }
        val_mapped = mapping.get(val_upper, val_upper)
        valid_choices = [c[0] for c in Test.TestType.choices]
        if val_mapped not in valid_choices:
            raise serializers.ValidationError(
                f"'{value}' is not a valid choice. Valid choices are: {', '.join(valid_choices)}."
            )
        return val_mapped

    class Meta:
        model = Test
        fields = [
            'id', 'title', 'description', 'exam', 'exam_name',
            'course', 'course_title',
            'test_series', 'test_series_title',
            'test_type', 'duration_minutes', 'total_marks', 'cutoff_score',
            'start_time', 'end_time', 'publish_results_immediately',
            'instructions', 'is_published', 'priority', 'rank_board_enabled', 'rank_publish_time',
            'questions_count', 'attempts_count', 'test_questions',
            'question_ids', 'positive_marks', 'negative_marks', 'created_at', 'updated_at'
        ]

    def get_questions_count(self, obj):
        return obj.test_questions.count()

    def get_attempts_count(self, obj):
        return obj.attempts.count()

    @transaction.atomic
    def create(self, validated_data):
        q_ids = validated_data.pop('question_ids', None)
        pos = validated_data.pop('positive_marks', 4.0)
        neg = validated_data.pop('negative_marks', 1.0)
        test = Test.objects.create(**validated_data)
        if q_ids:
            for idx, qid in enumerate(q_ids):
                TestQuestion.objects.create(
                    test=test, question_id=qid, order=idx + 1,
                    positive_marks=pos, negative_marks=neg
                )
        return test

    @transaction.atomic
    def update(self, instance, validated_data):
        has_q_ids = 'question_ids' in self.initial_data
        q_ids = validated_data.pop('question_ids', None)
        pos = validated_data.pop('positive_marks', 4.0)
        neg = validated_data.pop('negative_marks', 1.0)

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if has_q_ids:
            instance.test_questions.all().delete()
            if q_ids:
                for idx, qid in enumerate(q_ids):
                    TestQuestion.objects.create(
                        test=instance, question_id=qid, order=idx + 1,
                        positive_marks=pos, negative_marks=neg
                    )
        return instance


class AdminStudyMaterialSerializer(serializers.ModelSerializer):
    subject_id = serializers.IntegerField(source='subject.id', read_only=True, allow_null=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    class_id = serializers.UUIDField(source='subject.academic_class.id', read_only=True, allow_null=True)
    class_name = serializers.CharField(source='subject.academic_class.name', read_only=True, default='')
    exam_id = serializers.UUIDField(source='subject.academic_class.exam.id', read_only=True, allow_null=True)
    exam_name = serializers.CharField(source='subject.academic_class.exam.name', read_only=True, default='')
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)

    class Meta:
        model = StudyMaterial
        fields = [
            'id', 'title', 'description', 'material_type',
            'subject', 'subject_id', 'subject_name', 'subject_label',
            'class_id', 'class_name', 'exam_id', 'exam_name',
            'chapter', 'chapter_name',
            'r2_object_key', 'file_size_bytes', 'is_published', 'created_at', 'updated_at'
        ]

    def get_subject_label(self, obj):
        if obj.subject and obj.subject.academic_class:
            return f"{obj.subject.academic_class.name} · {obj.subject.name}"
        return obj.subject.name if obj.subject else ''


class AdminAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Announcement
        fields = '__all__'


class AdminDoubtSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.SerializerMethodField()
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    replied_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Doubt
        fields = [
            'id', 'student', 'student_email', 'student_name',
            'subject', 'subject_name', 'title', 'question_text',
            'image_url', 'status', 'reply_text', 'replied_by',
            'replied_by_name', 'replied_at', 'created_at'
        ]
        read_only_fields = ['student', 'replied_by', 'replied_at']

    def get_student_name(self, obj):
        name = f"{obj.student.first_name} {obj.student.last_name}".strip()
        return name or obj.student.username

    def get_replied_by_name(self, obj):
        if not obj.replied_by:
            return None
        name = f"{obj.replied_by.first_name} {obj.replied_by.last_name}".strip()
        return name or obj.replied_by.username


class AdminStudentSerializer(serializers.ModelSerializer):
    enrolled_courses = serializers.SerializerMethodField()
    test_attempts_count = serializers.SerializerMethodField()
    dpp_attempts_count = serializers.SerializerMethodField()
    completed_videos_count = serializers.SerializerMethodField()
    overall_accuracy = serializers.SerializerMethodField()
    target_exam = serializers.CharField(source='student_profile.target_exam', read_only=True)
    target_year = serializers.IntegerField(source='student_profile.target_year', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'phone_number', 'is_active', 'is_verified', 'last_login',
            'date_joined', 'target_exam', 'target_year',
            'enrolled_courses', 'test_attempts_count', 'dpp_attempts_count',
            'completed_videos_count', 'overall_accuracy'
        ]

    def get_enrolled_courses(self, obj):
        return list(
            Enrollment.objects.filter(user=obj, status='ACTIVE')
            .values('course__id', 'course__title', 'enrolled_at')
        )

    def get_test_attempts_count(self, obj):
        return TestAttempt.objects.filter(user=obj).count()

    def get_dpp_attempts_count(self, obj):
        return DPPAttempt.objects.filter(user=obj).count()

    def get_completed_videos_count(self, obj):
        return VideoProgress.objects.filter(user=obj, completed=True).count()

    def get_overall_accuracy(self, obj):
        attempts = DPPAttempt.objects.filter(user=obj)
        total_correct = sum(a.correct_count for a in attempts)
        total_ans = sum(a.correct_count + a.incorrect_count for a in attempts)
        return round((total_correct / total_ans) * 100, 1) if total_ans > 0 else 0.0


class AdminScheduleEventSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    subject_label = serializers.SerializerMethodField()
    class_name = serializers.CharField(source='subject.academic_class.name', read_only=True, default='')
    exam_name = serializers.CharField(source='subject.academic_class.exam.name', read_only=True, default='')
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    test_title = serializers.CharField(source='test.title', read_only=True)
    dpp_title = serializers.CharField(source='dpp.title', read_only=True)
    lecture_title = serializers.CharField(source='lecture.title', read_only=True)

    class Meta:
        model = ScheduleEvent
        fields = [
            'id', 'course', 'course_title', 'event_type', 'title', 'description',
            'subject', 'subject_name', 'subject_label', 'class_name', 'exam_name',
            'chapter', 'chapter_name',
            'start_time', 'end_time', 'link',
            'test', 'test_title',
            'dpp', 'dpp_title',
            'lecture', 'lecture_title',
            'is_published', 'created_at', 'updated_at'
        ]

    def get_subject_label(self, obj):
        if obj.subject and obj.subject.academic_class:
            return f"{obj.subject.academic_class.name} · {obj.subject.name}"
        return obj.subject.name if obj.subject else ''


class AdminNotificationSerializer(serializers.ModelSerializer):
    user_email = serializers.CharField(source='user.email', read_only=True)

    class Meta:
        model = Notification
        fields = [
            'id', 'user', 'user_email', 'title', 'message',
            'notification_type', 'link_url', 'is_read', 'created_at'
        ]


class AdminRankPredictorSerializer(serializers.ModelSerializer):
    class Meta:
        model = RankPredictor
        fields = '__all__'


class AdminLandingBannerSerializer(serializers.ModelSerializer):
    image_display_url = serializers.SerializerMethodField()

    class Meta:
        model = LandingBanner
        fields = [
            'id', 'title', 'caption', 'image', 'image_url', 'image_display_url',
            'link_url', 'show_from', 'show_until', 'order', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def get_image_display_url(self, obj):
        if obj.image:
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return obj.image_url or ''


class AdminLandingBannerSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = LandingBannerSettings
        fields = ['display_count']



