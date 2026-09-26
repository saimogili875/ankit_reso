import uuid
from django.core.management.base import BaseCommand
from apps.academics.models import AcademicClass, Subject, Course, Category, Chapter, Lecture
from apps.content.models import Video
from apps.questions.models import Question, QuestionOption, DPP, DPPQuestion

class Command(BaseCommand):
    help = 'Seeds initial course, class, subject, chapter, lecture, DPP, and question data into Django database'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting database seeding for ANKIT JEE..."))

        # 1. Academic Classes
        c11, _ = AcademicClass.objects.get_or_create(
            code='class11',
            defaults={'name': 'Class 11', 'slug': 'class-11', 'order': 1}
        )
        c12, _ = AcademicClass.objects.get_or_create(
            code='class12',
            defaults={'name': 'Class 12', 'slug': 'class-12', 'order': 2}
        )

        # 2. Subjects
        phy, _ = Subject.objects.get_or_create(
            slug='physics',
            defaults={'name': 'Physics', 'icon': 'Atom', 'color_hex': '#3B82F6'}
        )
        chem, _ = Subject.objects.get_or_create(
            slug='chemistry',
            defaults={'name': 'Chemistry', 'icon': 'FlaskConical', 'color_hex': '#10B981'}
        )
        math, _ = Subject.objects.get_or_create(
            slug='mathematics',
            defaults={'name': 'Mathematics', 'icon': 'Calculator', 'color_hex': '#8B5CF6'}
        )

        # 3. Main Course
        course, _ = Course.objects.get_or_create(
            slug='jee-complete-2025',
            defaults={
                'title': 'JEE Main + Advanced Complete Preparation Course',
                'subtitle': 'Structured learning, expert lectures, practice questions, mock tests and complete revision for Class 11 & Class 12.',
                'description': 'Comprehensive JEE preparation package covering Physics, Chemistry, and Mathematics.',
                'price': 0.00,
                'original_price': 7999.00,
                'discount_badge': '100% OFF (FREE)',
                'is_free': True,
                'is_published': True,
            }
        )
        course.classes.set([c11, c12])
        course.subjects.set([phy, chem, math])

        # Demo YouTube Video IDs
        demo_videos = ['dQw4w9WgXcQ', 'M7lc1UVf-VE', 'L_LUpnjgPso']

        # Helper to create Category & Chapters
        def create_chapter_data(subj, ac_class, cat_name, chap_name, chap_slug, lectures_data, dpps_data):
            cat, _ = Category.objects.get_or_create(
                subject=subj,
                slug=f"{subj.slug}-{ac_class.code}-{cat_name.lower().replace(' ', '-')}",
                defaults={'name': cat_name}
            )
            chap, _ = Chapter.objects.get_or_create(
                slug=chap_slug,
                defaults={
                    'category': cat,
                    'academic_class': ac_class,
                    'name': chap_name,
                    'order': 1,
                    'description': f"Complete JEE preparation module for {chap_name}."
                }
            )

            # Lectures
            for idx, lec in enumerate(lectures_data, 1):
                lecture_obj, _ = Lecture.objects.get_or_create(
                    chapter=chap,
                    lecture_number=idx,
                    defaults={
                        'title': lec['title'],
                        'slug': f"{chap_slug}-lec-{idx}",
                        'description': lec.get('description', ''),
                        'duration_seconds': lec.get('duration_seconds', 1800),
                        'is_published': True,
                        'order': idx,
                    }
                )
                v_source = demo_videos[(idx - 1) % len(demo_videos)]
                Video.objects.get_or_create(
                    lecture=lecture_obj,
                    defaults={
                        'title': lec['title'],
                        'duration_seconds': lec.get('duration_seconds', 1800),
                        'video_source_type': Video.VideoSourceType.YOUTUBE,
                        'youtube_video_id': v_source,
                        'is_free_preview': True,
                    }
                )

            # DPPs
            for d_idx, dpp_info in enumerate(dpps_data, 1):
                dpp_obj, _ = DPP.objects.get_or_create(
                    chapter=chap,
                    dpp_number=d_idx,
                    defaults={
                        'title': dpp_info['title'],
                        'description': dpp_info.get('description', ''),
                        'duration_minutes': dpp_info.get('duration_minutes', 20),
                        'is_published': True,
                    }
                )

                for q_idx, q_info in enumerate(dpp_info['questions'], 1):
                    q_obj = Question.objects.create(
                        subject=subj,
                        chapter=chap,
                        question_text=q_info['text'],
                        solution_text=q_info['explanation'],
                        difficulty=Question.Difficulty.MEDIUM,
                        question_type=Question.QuestionType.SINGLE_CHOICE
                    )

                    for opt_letter, opt_text in q_info['options'].items():
                        QuestionOption.objects.create(
                            question=q_obj,
                            option_text=opt_text,
                            is_correct=(opt_letter == q_info['correct'])
                        )

                    DPPQuestion.objects.create(
                        dpp=dpp_obj,
                        question=q_obj,
                        order=q_idx,
                        positive_marks=4,
                        negative_marks=1
                    )

        # Class 11 - Physics Chapters
        create_chapter_data(
            phy, c11, 'Mechanics', 'Units & Measurements', 'phy-11-c1',
            [
                {'title': 'Introduction to Physical Quantities & SI Units', 'duration_seconds': 1680},
                {'title': 'Dimensional Analysis & Applications', 'duration_seconds': 2100},
                {'title': 'Error Analysis & Significant Figures', 'duration_seconds': 2400},
            ],
            [
                {
                    'title': 'DPP 01: Dimensions & Unit Conversion',
                    'questions': [
                        {
                            'text': 'The dimension of Planck Constant (h) is identical to:',
                            'options': {'A': 'Angular Momentum', 'B': 'Linear Momentum', 'C': 'Energy', 'D': 'Force'},
                            'correct': 'A',
                            'explanation': 'Dimensions of h = [M L^2 T^-1], which is identical to Angular Momentum (L = r x p).'
                        },
                        {
                            'text': 'If Force (F), Velocity (V), and Time (T) are fundamental, the dimension of Mass is:',
                            'options': {'A': '[F V^-1 T]', 'B': '[F V T^-1]', 'C': '[F V^-1 T^-1]', 'D': '[F V T]'},
                            'correct': 'A',
                            'explanation': 'F = m * a = m * (V/T) => m = F * V^-1 * T.'
                        },
                        {
                            'text': 'The percentage error in measurement of mass and speed are 2% and 3%. Max error in KE is:',
                            'options': {'A': '5%', 'B': '8%', 'C': '11%', 'D': '6%'},
                            'correct': 'B',
                            'explanation': 'KE = 1/2 m v^2 => % error = 2% + 2(3%) = 8%.'
                        },
                        {
                            'text': 'Which physical quantity has the same dimensions as pressure?',
                            'options': {'A': 'Stress', 'B': 'Strain', 'C': 'Work', 'D': 'Momentum'},
                            'correct': 'A',
                            'explanation': 'Stress = Force / Area = [M L^-1 T^-2].'
                        },
                        {
                            'text': 'The pitch of a screw gauge is 0.5 mm and 50 divisions on circular scale. Least count is:',
                            'options': {'A': '0.01 mm', 'B': '0.001 mm', 'C': '0.05 mm', 'D': '0.1 mm'},
                            'correct': 'A',
                            'explanation': 'LC = Pitch / Divisions = 0.5 mm / 50 = 0.01 mm.'
                        }
                    ]
                },
                {
                    'title': 'DPP 02: Error Analysis & Precision Tools',
                    'questions': [
                        {
                            'text': 'In a Vernier Calliper, 10 MSD = 1 cm, 10 VSD coincide with 9 MSD. Vernier Constant is:',
                            'options': {'A': '0.01 cm', 'B': '0.1 cm', 'C': '0.001 cm', 'D': '0.05 cm'},
                            'correct': 'A',
                            'explanation': 'VC = 1 MSD - 1 VSD = 0.1 cm - 0.09 cm = 0.01 cm.'
                        },
                        {
                            'text': 'Number of significant figures in 0.007020 is:',
                            'options': {'A': '4', 'B': '3', 'C': '6', 'D': '7'},
                            'correct': 'A',
                            'explanation': 'Digits 7, 0, 2, 0 form 4 significant figures.'
                        },
                        {
                            'text': 'Dimensions of Solar Constant (energy received per area per time) are:',
                            'options': {'A': '[M L⁰ T⁻³]', 'B': '[M L² T⁻²]', 'C': '[M L T⁻²]', 'D': '[M L⁻¹ T⁻²]'},
                            'correct': 'A',
                            'explanation': '[M L² T⁻²] / ([L²] [T]) = [M L⁰ T⁻³].'
                        },
                        {
                            'text': 'Planck length l_P in terms of h, G, c is:',
                            'options': {'A': 'h¹/² G¹/² c⁻³/²', 'B': 'h¹/² G¹/² c⁻⁵/²', 'C': 'h G c', 'D': 'h¹/² G⁻¹/² c³'},
                            'correct': 'A',
                            'explanation': 'l_P = √(h G / c³).'
                        },
                        {
                            'text': 'Relative lowering of vapor pressure equals:',
                            'options': {'A': 'Mole fraction of solute', 'B': 'Molarity', 'C': 'Molality', 'D': 'Normality'},
                            'correct': 'A',
                            'explanation': '(P° - P) / P° = x_solute.'
                        }
                    ]
                }
            ]
        )

        # Class 12 - Physics Chapters
        create_chapter_data(
            phy, c12, 'Electromagnetism', 'Electrostatics', 'phy-12-c1',
            [
                {'title': 'Coulombs Law & Vector Form', 'duration_seconds': 2280},
                {'title': 'Electric Field & Gauss Theorem Applications', 'duration_seconds': 2640},
                {'title': 'Electric Potential & Capacitance Essentials', 'duration_seconds': 2520},
            ],
            [
                {
                    'title': 'DPP 01: Coulomb Law & Electric Field',
                    'questions': [
                        {
                            'text': 'Two equal charges Q at distance d. Third charge q at midpoint keeps system in equilibrium when q equals:',
                            'options': {'A': '-Q/4', 'B': '-Q/2', 'C': 'Q/4', 'D': '-Q'},
                            'correct': 'A',
                            'explanation': 'Net force on end charge: k Q^2/d^2 + k Q q / (d/2)^2 = 0 => q = -Q/4.'
                        },
                        {
                            'text': 'Total electric flux through closed Gaussian surface enclosing Q is:',
                            'options': {'A': 'Q / ε₀', 'B': 'Q ε₀', 'C': 'Zero', 'D': '2 Q / ε₀'},
                            'correct': 'A',
                            'explanation': 'By Gauss Law Φ = Q / ε₀.'
                        },
                        {
                            'text': 'Electric field E at distance r from infinite line charge λ is proportional to:',
                            'options': {'A': '1/r', 'B': '1/r²', 'C': 'r', 'D': '1/r³'},
                            'correct': 'A',
                            'explanation': 'E = λ / (2 π ε₀ r).'
                        },
                        {
                            'text': 'Dipole in uniform electric field experiences:',
                            'options': {'A': 'Torque only', 'B': 'Force only', 'C': 'Both', 'D': 'Neither'},
                            'correct': 'A',
                            'explanation': 'Forces cancel giving zero net force, but produce torque τ = p x E.'
                        },
                        {
                            'text': 'Work done moving charge over equipotential surface V is:',
                            'options': {'A': 'Zero', 'B': 'q V', 'C': 'q / V', 'D': 'V / q'},
                            'correct': 'A',
                            'explanation': 'W = q ΔV = 0 since ΔV = 0.'
                        }
                    ]
                },
                {
                    'title': 'DPP 02: Potential & Capacitors',
                    'questions': [
                        {
                            'text': 'Three capacitors of 6 μF in series. Equivalent capacitance is:',
                            'options': {'A': '2 μF', 'B': '18 μF', 'C': '9 μF', 'D': '3 μF'},
                            'correct': 'A',
                            'explanation': '1/C_eq = 1/6 + 1/6 + 1/6 = 3/6 => C_eq = 2 μF.'
                        },
                        {
                            'text': 'Energy stored in a capacitor of capacitance C charged to V is:',
                            'options': {'A': '1/2 C V²', 'B': 'C V²', 'C': '1/2 C² V', 'D': '2 C V²'},
                            'correct': 'A',
                            'explanation': 'U = 1/2 C V².'
                        },
                        {
                            'text': 'Electric field E and potential V are related as:',
                            'options': {'A': 'E = -dV/dr', 'B': 'E = dV/dr', 'C': 'V = -dE/dr', 'D': 'E = V r'},
                            'correct': 'A',
                            'explanation': 'E = -dV/dr.'
                        },
                        {
                            'text': 'Potential at center of charged spherical shell of radius R and charge Q is:',
                            'options': {'A': 'k Q / R', 'B': 'Zero', 'C': 'k Q / 2R', 'D': '2 k Q / R'},
                            'correct': 'A',
                            'explanation': 'Inside conductor, potential is constant and equals surface potential k Q / R.'
                        },
                        {
                            'text': 'Capacitance of parallel plate capacitor increases when:',
                            'options': {'A': 'Dielectric slab inserted', 'B': 'Area decreased', 'C': 'Distance increased', 'D': 'Voltage decreased'},
                            'correct': 'A',
                            'explanation': 'C = K ε₀ A / d.'
                        }
                    ]
                }
            ]
        )

        self.stdout.write(self.style.SUCCESS("Database seeding completed successfully!"))
