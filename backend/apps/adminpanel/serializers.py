import re
from rest_framework import serializers
from django.db import transaction
from django.utils.text import slugify

from apps.academics.models import (
    Exam, AcademicClass, Subject, Category, Chapter, Topic, Lecture, Course, Enrollment
)
from apps.content.models import (
    Video, HeroSlide, QuickAccessItem, Announcement, Doubt,
    LiveClass, LiveAttendance, ScheduleEvent, Notification
)
from apps.questions.models import (
    Question, QuestionOption, PYQ, DPP, DPPQuestion
)
from apps.materials.models import StudyMaterial
from apps.tests.models import Test, TestQuestion, TestAttempt
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

    subject_name = serializers.CharField(source='subject.name', read_only=True)
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    topic_name = serializers.CharField(source='topic.name', read_only=True)

    class Meta:
        model = Question
        fields = [
            'id', 'topic', 'topic_name', 'subject', 'subject_name',
            'chapter', 'chapter_name', 'question_text', 'solution_text',
            'solution_video_url', 'difficulty', 'question_type',
            'options', 'pyq_meta', 'pyq_exam', 'pyq_year', 'pyq_shift_or_paper',
            'created_at', 'updated_at'
        ]

    def validate(self, data):
        question_text = data.get('question_text')
        if question_text is not None and not question_text.strip():
            raise serializers.ValidationError({"question_text": "Question text cannot be empty."})

        # Derive subject from chapter or topic if missing
        subject = data.get('subject')
        chapter = data.get('chapter')
        topic = data.get('topic')

        if not subject:
            if chapter and chapter.category and chapter.category.subject:
                data['subject'] = chapter.category.subject
            elif topic and topic.chapter and topic.chapter.category and topic.chapter.category.subject:
                data['subject'] = topic.chapter.category.subject

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
    category_name = serializers.CharField(source='category.name', read_only=True)
    subject_id = serializers.IntegerField(source='category.subject.id', read_only=True)
    subject_name = serializers.CharField(source='category.subject.name', read_only=True)
    academic_class_name = serializers.CharField(source='academic_class.name', read_only=True)
    lectures_count = serializers.SerializerMethodField()
    dpps_count = serializers.SerializerMethodField()
    questions_count = serializers.SerializerMethodField()

    class Meta:
        model = Chapter
        fields = [
            'id', 'category', 'category_name', 'subject_id', 'subject_name',
            'academic_class', 'academic_class_name', 'name', 'slug', 'order',
            'description', 'lectures_count', 'dpps_count', 'questions_count',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']

    def get_lectures_count(self, obj):
        return obj.lectures.count()

    def get_dpps_count(self, obj):
        return obj.dpps.count()

    def get_questions_count(self, obj):
        return obj.questions.count()

    def validate(self, data):
        name = data.get('name') or getattr(self.instance, 'name', '')
        if not name.strip():
            raise serializers.ValidationError({"name": "Chapter name is required."})

        # Auto-generate slug if not set or on create
        base_slug = slugify(name)
        slug = base_slug
        counter = 1
        qs = Chapter.objects.filter(slug=slug)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        while qs.exists():
            slug = f"{base_slug}-{counter}"
            counter += 1
            qs = Chapter.objects.filter(slug=slug)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
        data['slug'] = slug
        return data


class AdminLectureSerializer(serializers.ModelSerializer):
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    subject_name = serializers.CharField(source='chapter.category.subject.name', read_only=True)
    video = serializers.SerializerMethodField()

    class Meta:
        model = Lecture
        fields = [
            'id', 'chapter', 'chapter_name', 'subject_name', 'lecture_number',
            'title', 'slug', 'description', 'duration_seconds', 'is_published',
            'order', 'video', 'created_at', 'updated_at'
        ]
        read_only_fields = ['slug', 'created_at', 'updated_at']

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
    topic_name = serializers.CharField(source='topic.name', read_only=True)

    class Meta:
        model = Video
        fields = [
            'id', 'lecture', 'lecture_title', 'topic', 'topic_name',
            'title', 'description', 'duration_seconds', 'video_source_type',
            'youtube_video_id', 'r2_object_key', 'thumbnail_key',
            'is_free_preview', 'created_at', 'updated_at'
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
            if not r2_key or not str(r2_key).strip():
                raise serializers.ValidationError({"r2_object_key": "Cloudflare R2 object key is required for Cloud hosted videos."})

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
    subject_name = serializers.CharField(source='chapter.category.subject.name', read_only=True)
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
            'id', 'chapter', 'chapter_name', 'subject_name', 'dpp_number',
            'title', 'description', 'duration_minutes', 'is_published',
            'questions_count', 'dpp_questions', 'question_ids',
            'positive_marks', 'negative_marks', 'created_at', 'updated_at'
        ]

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


class AdminSubjectSerializer(serializers.ModelSerializer):
    categories_count = serializers.SerializerMethodField()
    chapters_count = serializers.SerializerMethodField()

    class Meta:
        model = Subject
        fields = [
            'id', 'name', 'slug', 'description', 'icon',
            'color_hex', 'topics', 'order', 'is_visible',
            'categories_count', 'chapters_count', 'created_at'
        ]

    def get_categories_count(self, obj):
        return obj.categories.count()

    def get_chapters_count(self, obj):
        return Chapter.objects.filter(category__subject=obj).count()

    def create(self, validated_data):
        if not validated_data.get('slug'):
            validated_data['slug'] = slugify(validated_data['name'])
        return super().create(validated_data)


class AdminCourseSerializer(serializers.ModelSerializer):
    enrolled_count = serializers.SerializerMethodField()
    classes_names = serializers.SerializerMethodField()
    subjects_names = serializers.SerializerMethodField()

    class Meta:
        model = Course
        fields = [
            'id', 'title', 'slug', 'subtitle', 'description',
            'thumbnail_url', 'exam_type', 'price', 'original_price',
            'discount_badge', 'is_free', 'features', 'start_date', 'end_date',
            'status', 'is_published', 'allow_self_enrollment',
            'classes', 'subjects', 'classes_names', 'subjects_names',
            'enrolled_count', 'created_at', 'updated_at'
        ]

    def get_enrolled_count(self, obj):
        return obj.enrollments.count()

    def get_classes_names(self, obj):
        return [c.name for c in obj.classes.all()]

    def get_subjects_names(self, obj):
        return [s.name for s in obj.subjects.all()]

    def create(self, validated_data):
        if not validated_data.get('slug'):
            validated_data['slug'] = slugify(validated_data['title'])
        if 'status' in validated_data:
            validated_data['is_published'] = (validated_data['status'] == 'PUBLISHED')
        return super().create(validated_data)

    def update(self, instance, validated_data):
        if 'status' in validated_data:
            validated_data['is_published'] = (validated_data['status'] == 'PUBLISHED')
        return super().update(instance, validated_data)


class AdminAcademicClassSerializer(serializers.ModelSerializer):
    chapters_count = serializers.SerializerMethodField()

    class Meta:
        model = AcademicClass
        fields = ['id', 'name', 'code', 'order', 'chapters_count', 'created_at']

    def get_chapters_count(self, obj):
        return obj.chapters.count()


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

    class Meta:
        model = Test
        fields = [
            'id', 'title', 'description', 'exam', 'exam_name',
            'course', 'course_title',
            'test_type', 'duration_minutes', 'total_marks', 'cutoff_score',
            'start_time', 'end_time', 'publish_results_immediately',
            'instructions', 'is_published',
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
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)

    class Meta:
        model = StudyMaterial
        fields = [
            'id', 'title', 'description', 'material_type',
            'subject', 'subject_name', 'chapter', 'chapter_name',
            'r2_object_key', 'file_size_bytes', 'is_published', 'created_at', 'updated_at'
        ]


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


class AdminLiveClassSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    attendances_count = serializers.SerializerMethodField()

    class Meta:
        model = LiveClass
        fields = [
            'id', 'course', 'course_title', 'title', 'description',
            'subject', 'subject_name', 'chapter', 'chapter_name',
            'teacher', 'start_time', 'end_time', 'platform', 'join_url',
            'status', 'recording_url', 'recording_published', 'recording_lecture',
            'attendances_count', 'created_at', 'updated_at'
        ]

    def get_attendances_count(self, obj):
        return obj.attendances.count()


class AdminLiveAttendanceSerializer(serializers.ModelSerializer):
    student_email = serializers.CharField(source='student.email', read_only=True)
    student_name = serializers.SerializerMethodField()
    live_class_title = serializers.CharField(source='live_class.title', read_only=True)

    class Meta:
        model = LiveAttendance
        fields = ['id', 'live_class', 'live_class_title', 'student', 'student_name', 'student_email', 'joined_at']

    def get_student_name(self, obj):
        name = f"{obj.student.first_name} {obj.student.last_name}".strip()
        return name or obj.student.username


class AdminScheduleEventSerializer(serializers.ModelSerializer):
    course_title = serializers.CharField(source='course.title', read_only=True)
    subject_name = serializers.CharField(source='subject.name', read_only=True)
    chapter_name = serializers.CharField(source='chapter.name', read_only=True)
    live_class_title = serializers.CharField(source='live_class.title', read_only=True)
    test_title = serializers.CharField(source='test.title', read_only=True)
    dpp_title = serializers.CharField(source='dpp.title', read_only=True)
    lecture_title = serializers.CharField(source='lecture.title', read_only=True)

    class Meta:
        model = ScheduleEvent
        fields = [
            'id', 'course', 'course_title', 'event_type', 'title', 'description',
            'subject', 'subject_name', 'chapter', 'chapter_name',
            'start_time', 'end_time', 'link',
            'live_class', 'live_class_title',
            'test', 'test_title',
            'dpp', 'dpp_title',
            'lecture', 'lecture_title',
            'is_published', 'created_at', 'updated_at'
        ]


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


