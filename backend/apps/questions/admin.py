from django.contrib import admin
from .models import Question, QuestionOption, PYQ, DPP, DPPQuestion

class QuestionOptionInline(admin.TabularInline):
    model = QuestionOption
    extra = 4

@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['id', 'subject', 'difficulty', 'question_type']
    list_filter = ['subject', 'difficulty', 'question_type']
    search_fields = ['question_text']
    inlines = [QuestionOptionInline]

class DPPQuestionInline(admin.TabularInline):
    model = DPPQuestion
    extra = 1

@admin.register(DPP)
class DPPAdmin(admin.ModelAdmin):
    list_display = ['title', 'chapter', 'dpp_number', 'duration_minutes', 'is_published']
    list_filter = ['is_published', 'chapter__category__subject']
    search_fields = ['title']
    inlines = [DPPQuestionInline]

@admin.register(PYQ)
class PYQAdmin(admin.ModelAdmin):
    list_display = ['question', 'exam', 'year', 'shift_or_paper']
