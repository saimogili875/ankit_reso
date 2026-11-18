from django.contrib import admin
from .models import LiveClass, LiveAttendance, LiveChatMessage, HandRaise, Recording, LivePoll, LivePollOption, LivePollVote


@admin.register(LiveClass)
class LiveClassAdmin(admin.ModelAdmin):
    list_display = ('title', 'course', 'subject', 'status', 'start_time', 'peak_concurrent_users')
    list_filter = ('status', 'platform', 'course')
    search_fields = ('title', 'room_name')


@admin.register(LiveAttendance)
class LiveAttendanceAdmin(admin.ModelAdmin):
    list_display = ('student', 'live_class', 'joined_at', 'total_seconds', 'is_online')
    list_filter = ('is_online', 'live_class')


@admin.register(LiveChatMessage)
class LiveChatMessageAdmin(admin.ModelAdmin):
    list_display = ('sender_name', 'live_class', 'message', 'is_pinned', 'created_at')
    list_filter = ('live_class', 'is_pinned')


@admin.register(HandRaise)
class HandRaiseAdmin(admin.ModelAdmin):
    list_display = ('student', 'live_class', 'status', 'raised_at')
    list_filter = ('status', 'live_class')


@admin.register(Recording)
class RecordingAdmin(admin.ModelAdmin):
    list_display = ('title', 'live_class', 'status', 'duration_seconds', 'published_at')
    list_filter = ('status',)
