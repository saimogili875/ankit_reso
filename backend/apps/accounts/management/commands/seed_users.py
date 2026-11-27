from django.core.management.base import BaseCommand
from decouple import config
from apps.accounts.models import User, StudentProfile
from apps.content.models import HeroSlide, QuickAccessItem, Announcement, ScheduleEvent, Notification
from apps.academics.models import Subject, AcademicClass, Course, Exam, Category, Chapter
from apps.questions.models import Question, QuestionOption
from apps.tests.models import Test, TestSection, TestQuestion
from apps.analytics.models import RankPredictor
from django.utils import timezone
from datetime import timedelta, date

class Command(BaseCommand):
    help = "Seeds default student and admin users idempotently from environment variables, plus base platform records."

    def handle(self, *args, **options):
        # 1. Read credentials from environment variables (no hardcoded credentials)
        student_email = config('SEED_STUDENT_EMAIL', default='').strip().lower()
        student_password = config('SEED_STUDENT_PASSWORD', default='')
        admin_email = config('ADMIN_EMAIL', default=config('SEED_ADMIN_EMAIL', default='')).strip().lower()
        admin_password = config('ADMIN_PASSWORD', default=config('SEED_ADMIN_PASSWORD', default=''))

        # 2. Seed Student User
        if student_email and student_password:
            student_user, student_created = User.objects.get_or_create(
                email=student_email,
                defaults={
                    'username': student_email.split('@')[0],
                    'role': User.Role.STUDENT,
                    'first_name': 'Sai Kumar',
                    'last_name': 'Mogili',
                    'is_verified': True,
                    'is_active': True,
                }
            )
            student_user.role = User.Role.STUDENT
            student_user.is_verified = True
            student_user.is_active = True
            student_user.set_password(student_password)
            student_user.save()

            StudentProfile.objects.update_or_create(
                user=student_user,
                defaults={
                    'target_exam': StudentProfile.TargetExam.BOTH,
                    'target_year': 2025,
                    'bio': 'JEE Main & Advanced aspirant',
                }
            )

            student_action = "Created" if student_created else "Updated"
            self.stdout.write(self.style.SUCCESS(
                f"Successfully {student_action} student user: {student_email} (role={student_user.role})"
            ))
        else:
            self.stdout.write(self.style.WARNING(
                "Skipping student user seeding: SEED_STUDENT_EMAIL or SEED_STUDENT_PASSWORD not configured."
            ))

        # 3. Seed Admin User
        if admin_email and admin_password:
            admin_user, admin_created = User.objects.get_or_create(
                email=admin_email,
                defaults={
                    'username': admin_email.split('@')[0],
                    'role': User.Role.ADMIN,
                    'first_name': 'Admin',
                    'last_name': 'User',
                    'is_staff': True,
                    'is_superuser': True,
                    'is_verified': True,
                    'is_active': True,
                }
            )
            admin_user.role = User.Role.ADMIN
            admin_user.is_staff = True
            admin_user.is_superuser = True
            admin_user.is_verified = True
            admin_user.is_active = True
            admin_user.set_password(admin_password)
            admin_user.save()

            admin_action = "Created" if admin_created else "Updated"
            self.stdout.write(self.style.SUCCESS(
                f"Successfully {admin_action} admin user: {admin_email} (role={admin_user.role}, superuser={admin_user.is_superuser})"
            ))
        else:
            self.stdout.write(self.style.WARNING(
                "Skipping admin user seeding: ADMIN_EMAIL or ADMIN_PASSWORD not configured."
            ))

        # 4. Seed Base Platform Content (Only if empty, so admin maintains full control)
        # Academic Classes
        c11, _ = AcademicClass.objects.get_or_create(
            code='class11',
            defaults={'name': 'Class 11', 'slug': 'class-11', 'order': 1}
        )
        c12, _ = AcademicClass.objects.get_or_create(
            code='class12',
            defaults={'name': 'Class 12', 'slug': 'class-12', 'order': 2}
        )

        # Base Subjects
        Subject.objects.update_or_create(
            slug='physics',
            defaults={
                'name': 'Physics',
                'description': 'Master physical laws, vectors, kinematics, electromagnetism and modern physics concepts.',
                'topics': ['Mechanics', 'Electrodynamics', 'Modern Physics', 'Optics'],
                'color_hex': '#3B82F6',
                'order': 1,
                'is_visible': True,
            }
        )
        Subject.objects.update_or_create(
            slug='chemistry',
            defaults={
                'name': 'Chemistry',
                'description': 'Understand reaction mechanisms, mole concept, chemical bonding and inorganic trends.',
                'topics': ['Physical Chemistry', 'Organic Chemistry', 'Inorganic Chemistry'],
                'color_hex': '#10B981',
                'order': 2,
                'is_visible': True,
            }
        )
        Subject.objects.update_or_create(
            slug='mathematics',
            defaults={
                'name': 'Mathematics',
                'description': 'Solve complex calculus integrals, matrix algebra, coordinate geometry and vector equations.',
                'topics': ['Calculus', 'Algebra', 'Coordinate Geometry', 'Vectors & 3D'],
                'color_hex': '#8B5CF6',
                'order': 3,
                'is_visible': True,
            }
        )

        # Base Course
        main_course, _ = Course.objects.update_or_create(
            slug='jee-main-advanced-complete-course',
            defaults={
                'title': 'JEE Main + Advanced Complete Course',
                'subtitle': 'Structured lectures, DPPs, chapter notes, and mock tests for Class 11 & 12',
                'description': 'Full syllabus comprehensive program covering Physics, Chemistry, and Mathematics for JEE Main and Advanced aspirants.',
                'thumbnail_url': '/images/hero/slide-1.jpg',
                'exam_type': Course.ExamType.BOTH,
                'price': 0.00,
                'original_price': 7999.00,
                'discount_badge': '100% OFF (FREE)',
                'is_free': True,
                'features': [
                    'Full syllabus HD Video Lectures',
                    'Daily Practice Problem (DPP) sets with detailed solutions',
                    'Chapter formula sheets & revision maps',
                    'All India Mock Tests with NTA CBT interface',
                    '24/7 Faculty Doubt Resolution Desk'
                ],
                'start_date': date(2025, 1, 1),
                'end_date': date(2025, 12, 31),
                'status': Course.Status.PUBLISHED,
                'is_published': True,
                'allow_self_enrollment': True,
            }
        )
        main_course.classes.add(c11, c12)

        # Advanced Course (admin-enrolled only)
        adv_course, _ = Course.objects.update_or_create(
            slug='jee-advanced-super30',
            defaults={
                'title': 'JEE Advanced Super 30 Elite Course',
                'subtitle': 'Intensive multi-concept problem solving course for top 500 AIR aspirants',
                'description': 'Rigorous problem solving, subjective Olympiad-level questions, and personalized faculty mentoring.',
                'thumbnail_url': '/images/hero/slide-3.jpg',
                'exam_type': Course.ExamType.JEE_ADVANCED,
                'price': 2999.00,
                'original_price': 9999.00,
                'discount_badge': '70% OFF',
                'is_free': False,
                'features': [
                    'Advanced Multi-Concept problem sessions',
                    'Previous 20 Years Advanced Subjective Analysis',
                    'Weekly Proctored CBT Mock Papers',
                    'One-on-one doubt clearing sessions'
                ],
                'start_date': date(2025, 2, 1),
                'end_date': date(2025, 6, 30),
                'status': Course.Status.PUBLISHED,
                'is_published': True,
                'allow_self_enrollment': False,
            }
        )
        adv_course.classes.add(c12)

        # Initial Schedule items for today (if none exist)
        now = timezone.now()
        physics_subj = Subject.objects.filter(slug='physics').first()

        if ScheduleEvent.objects.filter(event_type=ScheduleEvent.EventType.RECORDED_CLASS).count() == 0:
            ScheduleEvent.objects.create(
                course=main_course,
                event_type=ScheduleEvent.EventType.RECORDED_CLASS,
                title='Masterclass: Rotational Dynamics - Moment of Inertia',
                description='Conceptual derivation of Moment of Inertia for combined rolling bodies.',
                subject=physics_subj,
                start_time=now - timedelta(minutes=15),
                end_time=now + timedelta(minutes=45),
                link='/learn',
                is_published=True,
            )

        if ScheduleEvent.objects.filter(event_type=ScheduleEvent.EventType.PRACTICE_DEADLINE).count() == 0:
            ScheduleEvent.objects.create(
                course=main_course,
                event_type=ScheduleEvent.EventType.PRACTICE_DEADLINE,
                title='DPP 04: Work Power Energy Problem Set Due',
                description='Complete 10 multi-concept numerical problems before 11:59 PM today.',
                subject=physics_subj,
                start_time=now.replace(hour=23, minute=59, second=0),
                end_time=now.replace(hour=23, minute=59, second=0),
                link='/practice',
                is_published=True,
            )

        if ScheduleEvent.objects.filter(event_type=ScheduleEvent.EventType.EXAM).count() == 0:
            ScheduleEvent.objects.create(
                course=main_course,
                event_type=ScheduleEvent.EventType.EXAM,
                title='All-India JEE Main Part Syllabus Mock Test 2',
                description='Physics, Chemistry & Math part syllabus test (180 mins).',
                subject=physics_subj,
                start_time=now.replace(hour=14, minute=0, second=0),
                end_time=now.replace(hour=17, minute=0, second=0),
                link='/tests',
                is_published=True,
            )

        if Notification.objects.count() == 0:
            Notification.objects.create(
                title='Lecture Available',
                message='Rotational Dynamics - Moment of Inertia & Rolling Motion is now available in your Learn section.',
                notification_type=Notification.NotificationType.RECORDING_AVAILABLE,
                link_url='/learn',
                is_read=False,
            )

        # Initial Hero Slides (if none exist)
        if HeroSlide.objects.count() == 0:
            HeroSlide.objects.create(
                title='JEE Main + Advanced',
                title_highlight='Complete Course',
                subtitle='Structured learning, expert lectures, practice questions, mock tests and complete revision for your JEE journey.',
                badge='Complete Preparation',
                features=['Video Lectures', 'Chapter-wise Notes', 'PYQs & Practice', 'Mock Tests & Analysis'],
                original_price='₹7,999',
                offer_price='₹0',
                discount_badge='100% OFF (FREE)',
                cta_text='Enroll Free',
                cta_href='/learn',
                image_url='/images/hero/slide-1.jpg',
                order=1,
                is_active=True,
            )
            HeroSlide.objects.create(
                title='Targeted Mains Mastery',
                title_highlight='JEE Main 2025',
                subtitle='Master every chapter with structured lectures, PYQs, practice questions and mock tests aligned with NTA pattern.',
                badge='NTA Pattern CBT',
                features=['Chapter-wise Learning', 'JEE Main PYQs', 'Practice Questions', 'Mock Tests'],
                original_price='₹5,999',
                offer_price='₹0',
                discount_badge='100% OFF (FREE)',
                cta_text='Start Preparing',
                cta_href='/learn',
                image_url='/images/hero/slide-2.jpg',
                order=2,
                is_active=True,
            )

        # Initial Quick Access Cards (if none exist)
        if QuickAccessItem.objects.count() == 0:
            quick_items = [
                {'title': 'Learn', 'description': 'Watch video lectures by expert faculty', 'icon_name': 'BookOpen', 'href': '/learn', 'badge_text': 'Lectures', 'order': 1},
                {'title': 'Practice', 'description': 'Daily practice problems with solutions', 'icon_name': 'Edit3', 'href': '/practice', 'badge_text': 'DPPs', 'order': 2},
                {'title': 'Tests', 'description': 'Full syllabus mock tests & PYQ CBT papers', 'icon_name': 'Clock', 'href': '/tests', 'badge_text': 'NTA CBT', 'order': 3},
                {'title': 'Analysis', 'description': 'Deep accuracy & chapter performance', 'icon_name': 'BarChart3', 'href': '/progress', 'badge_text': 'Analytics', 'order': 4},
                {'title': 'Doubt Solver', 'description': 'Get verified solutions from JEE faculty', 'icon_name': 'MessageSquare', 'href': '/doubt-solver', 'badge_text': '24/7', 'order': 5},
                {'title': 'Materials', 'description': 'Download formula maps & PDF handouts', 'icon_name': 'FileText', 'href': '/materials', 'badge_text': 'PDF Notes', 'order': 6},
            ]
            for qi in quick_items:
                QuickAccessItem.objects.create(**qi, is_visible=True)

        # Initial Announcement (if none exist)
        if Announcement.objects.count() == 0:
            Announcement.objects.create(
                title='Welcome to ANKIT JEE',
                message='JEE 2025 test series and DPP sets are now active. Check the Tests and Practice sections to begin your preparation.',
                announcement_type='UPDATE',
                link_url='/tests',
                is_active=True,
            )

        # 8. Seed Academic Chapters for Physics and Chemistry if needed
        phys_cat, _ = Category.objects.get_or_create(
            name='Classical Mechanics',
            subject=physics_subj,
            defaults={'slug': 'classical-mechanics'}
        )
        phys_chap, _ = Chapter.objects.get_or_create(
            name='Rotational Dynamics',
            category=phys_cat,
            academic_class=c11,
            defaults={'slug': 'rotational-dynamics', 'order': 4}
        )

        chem_subj, _ = Subject.objects.get_or_create(
            name='Chemistry',
            defaults={'slug': 'chemistry', 'code': 'CHEM', 'order': 2, 'is_visible': True}
        )
        chem_cat, _ = Category.objects.get_or_create(
            name='Inorganic & Physical Chemistry',
            subject=chem_subj,
            defaults={'slug': 'inorganic-physical'}
        )
        chem_chap, _ = Chapter.objects.get_or_create(
            name='Chemical Bonding & Molecular Structure',
            category=chem_cat,
            academic_class=c11,
            defaults={'slug': 'chemical-bonding', 'order': 3}
        )

        math_chap = Chapter.objects.filter(name__icontains='Integrals').first()
        exam_jee, _ = Exam.objects.get_or_create(slug='jee', defaults={'name': 'JEE Main & Advanced'})

        # 9. Seed Questions if fewer than 6 exist
        if Question.objects.count() < 6:
            # Physics Q1
            pq1, _ = Question.objects.get_or_create(
                question_text='A solid cylinder of mass M and radius R rolls without slipping down an inclined plane of inclination θ. The acceleration of its center of mass is:',
                defaults={
                    'subject': physics_subj,
                    'chapter': phys_chap,
                    'difficulty': Question.Difficulty.EASY,
                    'question_type': Question.QuestionType.SINGLE_CHOICE,
                    'solution_text': r'For a rolling solid cylinder, $I = \frac{1}{2}MR^2$. Acceleration $a = \frac{g \sin\theta}{1 + I/(MR^2)} = \frac{g \sin\theta}{1 + 1/2} = \frac{2}{3}g \sin\theta$.',
                }
            )
            QuestionOption.objects.get_or_create(question=pq1, option_text='(2/3) g sin θ', defaults={'is_correct': True})
            QuestionOption.objects.get_or_create(question=pq1, option_text='(1/2) g sin θ', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=pq1, option_text='(3/4) g sin θ', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=pq1, option_text='g sin θ', defaults={'is_correct': False})

            # Physics Q2
            pq2, _ = Question.objects.get_or_create(
                question_text='A wheel of radius 0.2 m is accelerated from rest at a constant angular acceleration of 5 rad/s². The linear speed of a point on its rim after 4 seconds is:',
                defaults={
                    'subject': physics_subj,
                    'chapter': phys_chap,
                    'difficulty': Question.Difficulty.MEDIUM,
                    'question_type': Question.QuestionType.SINGLE_CHOICE,
                    'solution_text': r'Angular velocity $\omega = \omega_0 + \alpha t = 0 + (5)(4) = 20\text{ rad/s}$. Linear speed $v = \omega R = 20 \times 0.2 = 4\text{ m/s}$.',
                }
            )
            QuestionOption.objects.get_or_create(question=pq2, option_text='4 m/s', defaults={'is_correct': True})
            QuestionOption.objects.get_or_create(question=pq2, option_text='2 m/s', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=pq2, option_text='10 m/s', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=pq2, option_text='8 m/s', defaults={'is_correct': False})

            # Chemistry Q1
            cq1, _ = Question.objects.get_or_create(
                question_text='According to VSEPR theory, the shape and hybridization of the SF6 molecule are respectively:',
                defaults={
                    'subject': chem_subj,
                    'chapter': chem_chap,
                    'difficulty': Question.Difficulty.EASY,
                    'question_type': Question.QuestionType.SINGLE_CHOICE,
                    'solution_text': r'SF6 has 6 bonding pairs and 0 lone pairs around sulfur. Hybridization is $sp^3d^2$ and molecular geometry is Octahedral.',
                }
            )
            QuestionOption.objects.get_or_create(question=cq1, option_text='Octahedral, sp3d2', defaults={'is_correct': True})
            QuestionOption.objects.get_or_create(question=cq1, option_text='Trigonal bipyramidal, sp3d', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=cq1, option_text='Square planar, dsp2', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=cq1, option_text='Tetrahedral, sp3', defaults={'is_correct': False})

            # Chemistry Q2
            cq2, _ = Question.objects.get_or_create(
                question_text='Based on Molecular Orbital Theory, the bond order of O2⁺ ion is:',
                defaults={
                    'subject': chem_subj,
                    'chapter': chem_chap,
                    'difficulty': Question.Difficulty.MEDIUM,
                    'question_type': Question.QuestionType.SINGLE_CHOICE,
                    'solution_text': r'O2 has 16 electrons (Bond Order = 2.0). O2+ has 15 electrons, losing an antibonding $\pi^* 2p$ electron. Bond Order = $\frac{10 - 5}{2} = 2.5$.',
                }
            )
            QuestionOption.objects.get_or_create(question=cq2, option_text='2.5', defaults={'is_correct': True})
            QuestionOption.objects.get_or_create(question=cq2, option_text='1.5', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=cq2, option_text='2.0', defaults={'is_correct': False})
            QuestionOption.objects.get_or_create(question=cq2, option_text='3.0', defaults={'is_correct': False})

            # Mathematics Q1
            if math_chap:
                mq1, _ = Question.objects.get_or_create(
                    question_text=r'Evaluate the definite integral: $\int_{0}^{\pi/2} \frac{\sin x}{\sin x + \cos x} dx$.',
                    defaults={
                        'subject': math_chap.category.subject if math_chap.category else None,
                        'chapter': math_chap,
                        'difficulty': Question.Difficulty.EASY,
                        'question_type': Question.QuestionType.SINGLE_CHOICE,
                        'solution_text': r'Using property $I = \int_{0}^{a} f(a-x) dx$: $I = \int_{0}^{\pi/2} \frac{\cos x}{\cos x + \sin x} dx$. Adding both gives $2I = \int_{0}^{\pi/2} 1 dx = \frac{\pi}{2} \implies I = \frac{\pi}{4}$.',
                    }
                )
                QuestionOption.objects.get_or_create(question=mq1, option_text='π/4', defaults={'is_correct': True})
                QuestionOption.objects.get_or_create(question=mq1, option_text='π/2', defaults={'is_correct': False})
                QuestionOption.objects.get_or_create(question=mq1, option_text='π', defaults={'is_correct': False})
                QuestionOption.objects.get_or_create(question=mq1, option_text='1', defaults={'is_correct': False})

        # 10. Seed Full Mock Test (if none exist)
        mock_test, t_created = Test.objects.get_or_create(
            title='All-India JEE Main Complete Mock Test 1',
            defaults={
                'test_type': Test.TestType.MOCK,
                'course': main_course,
                'exam': exam_jee,
                'duration_minutes': 180,
                'total_marks': 300,
                'cutoff_score': 105.0,
                'is_published': True,
                'publish_results_immediately': True,
                'instructions': 'Total 180 minutes. Physics, Chemistry, and Mathematics sections. Each correct answer awards +4.0 marks, incorrect answer deducts -1.0 mark.',
            }
        )

        if mock_test.test_questions.count() == 0:
            # Create sections
            sec_phys, _ = TestSection.objects.get_or_create(
                test=mock_test,
                subject=physics_subj,
                defaults={'name': 'Physics', 'order': 1}
            )
            sec_chem, _ = TestSection.objects.get_or_create(
                test=mock_test,
                subject=chem_subj,
                defaults={'name': 'Chemistry', 'order': 2}
            )
            math_subj = Subject.objects.filter(name='Mathematics').first()
            if math_subj:
                sec_math, _ = TestSection.objects.get_or_create(
                    test=mock_test,
                    subject=math_subj,
                    defaults={'name': 'Mathematics', 'order': 3}
                )

            # Map questions into test
            q_idx = 1
            for q in Question.objects.all().order_by('id'):
                sec = None
                if q.subject == physics_subj:
                    sec = sec_phys
                elif q.subject == chem_subj:
                    sec = sec_chem
                elif math_subj and q.subject == math_subj:
                    sec = sec_math

                TestQuestion.objects.create(
                    test=mock_test,
                    section=sec,
                    question=q,
                    positive_marks=4.0,
                    negative_marks=1.0,
                    order=q_idx
                )
                q_idx += 1

        # 11. Seed Rank Predictor Bands
        if RankPredictor.objects.count() == 0:
            bands = [
                {'exam_type': 'JEE_MAIN', 'min_marks': 270.0, 'max_marks': 300.0, 'predicted_rank_min': 1, 'predicted_rank_max': 250, 'percentile_min': 99.90, 'percentile_max': 100.00, 'notes': 'Top 0.1% tier — eligible for top NIT Computer Science.'},
                {'exam_type': 'JEE_MAIN', 'min_marks': 230.0, 'max_marks': 269.0, 'predicted_rank_min': 251, 'predicted_rank_max': 1500, 'percentile_min': 99.50, 'percentile_max': 99.89, 'notes': 'Exceptional score — Tier-1 NITs & IIITs.'},
                {'exam_type': 'JEE_MAIN', 'min_marks': 190.0, 'max_marks': 229.0, 'predicted_rank_min': 1501, 'predicted_rank_max': 5500, 'percentile_min': 98.50, 'percentile_max': 99.49, 'notes': 'High probability for Core branches in top NITs.'},
                {'exam_type': 'JEE_MAIN', 'min_marks': 150.0, 'max_marks': 189.0, 'predicted_rank_min': 5501, 'predicted_rank_max': 16000, 'percentile_min': 96.50, 'percentile_max': 98.49, 'notes': 'Good standing — eligible for all JEE Advanced preparation.'},
                {'exam_type': 'JEE_MAIN', 'min_marks': 115.0, 'max_marks': 149.0, 'predicted_rank_min': 16001, 'predicted_rank_max': 38000, 'percentile_min': 92.00, 'percentile_max': 96.49, 'notes': 'Qualifies General Category JEE Advanced cutoff.'},
                {'exam_type': 'JEE_MAIN', 'min_marks': 80.0, 'max_marks': 114.0, 'predicted_rank_min': 38001, 'predicted_rank_max': 85000, 'percentile_min': 82.00, 'percentile_max': 91.99, 'notes': 'State quota & reserved categories qualifying band.'},
                {'exam_type': 'JEE_MAIN', 'min_marks': 0.0, 'max_marks': 79.0, 'predicted_rank_min': 85001, 'predicted_rank_max': 250000, 'percentile_min': 40.00, 'percentile_max': 81.99, 'notes': 'Requires strengthening weak chapters before Mains session.'},
            ]
            for b in bands:
                RankPredictor.objects.create(**b)

        self.stdout.write(self.style.SUCCESS("Base platform content seeded successfully."))
