'use client';

import React, { useEffect, useState, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, Bell, ChevronDown, GraduationCap, CheckCircle, AlertTriangle, Info, ExternalLink, User, LogOut } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';

interface Announcement {
  id: string;
  title: string;
  message: string;
  announcement_type: 'INFO' | 'IMPORTANT' | 'ALERT';
  link_url?: string;
  created_at: string;
}

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  link_url?: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationResponse {
  unread_count: number;
  notifications: NotificationItem[];
}


export const Header: React.FC = () => {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [bellTab, setBellTab] = useState<'notifications' | 'announcements'>('notifications');
  const [isBellOpen, setIsBellOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadData() {
      try {
        const [annRes, notifRes] = await Promise.all([
          apiClient.get<Announcement[]>('/announcements/').catch(() => []),
          apiClient.get<NotificationResponse>('/notifications/').catch(() => null),
        ]);
        if (isMounted) {
          if (Array.isArray(annRes)) {
            setAnnouncements(annRes);
          }
          if (notifRes) {
            setNotifications(notifRes.notifications || []);
            setUnreadCount(notifRes.unread_count || 0);
          }
        }
      } catch {
        // Handled silently
      }
    }

    loadData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setIsBellOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } finally {
      router.push('/sign-in');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiClient.post('/notifications/mark-all-read/', { mark_all: true });
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // Ignored
    }
  };

  const handleNotificationClick = async (item: NotificationItem) => {
    if (!item.is_read) {
      try {
        await apiClient.post(`/notifications/${item.id}/read/`, {});
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch {
        // Ignored
      }
    }
    setIsBellOpen(false);
    if (item.link_url) {
      if (item.link_url.startsWith('http')) {
        window.open(item.link_url, '_blank', 'noopener,noreferrer');
      } else {
        router.push(item.link_url);
      }
    }
  };

  const displayName = currentUser
    ? `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim() ||
    currentUser.username ||
    currentUser.email.split('@')[0]
    : 'Student';

  const initial = displayName.charAt(0).toUpperCase() || 'S';
  const roleLabel = currentUser?.role === 'ADMIN' ? 'Admin' : 'Student';
  const examLabel = currentUser?.student_profile?.target_exam || 'JEE Main & Advanced';

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-20 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-4">
      {/* Mobile Brand Logo */}
      <Link href="/" className="flex items-center gap-2 lg:hidden flex-shrink-0 group">
        <div className="w-9 h-9 rounded-xl bg-white/95 flex items-center justify-center p-1 shadow-sm border border-slate-700/60 group-hover:scale-105 transition-transform">
          <Image
            src="/images/logo-icon.png"
            alt="Adept Eduverse"
            width={28}
            height={28}
            className="object-contain"
          />
        </div>
      </Link>

      {/* Search Input */}
      <div className="flex-1 max-w-md">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 absolute left-3.5 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search topics, PYQs, tests, concepts..."
            className="w-full pl-10 pr-4 py-2 text-base sm:text-sm bg-slate-900 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      {/* Right Controls: Exam Selector, Bell, User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Exam Selector Pill */}
        <Link
          href="/profile"
          className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 cursor-pointer hover:border-slate-700 transition-colors min-h-[44px]"
          title="Edit Target Exam in Profile"
        >
          <GraduationCap className="w-3.5 h-3.5 text-blue-400" />
          <span>{examLabel}</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </Link>

        {/* Notification Bell Dropdown */}
        <div className="relative" ref={bellRef}>
          <button
            type="button"
            onClick={() => setIsBellOpen(!isBellOpen)}
            className="relative w-11 h-11 flex items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-[10px] font-extrabold text-white flex items-center justify-center border-2 border-slate-950 shadow-sm animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            ) : announcements.length > 0 ? (
              <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            ) : null}
          </button>

          {isBellOpen && (
            <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] sm:w-96 max-w-sm rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 overflow-hidden">
              {/* Dropdown Header with Tab Switches */}
              <div className="p-2.5 border-b border-slate-800 flex items-center justify-between gap-2 bg-slate-950/40">
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setBellTab('notifications')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${bellTab === 'notifications'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Notifications
                    {unreadCount > 0 && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-[10px] text-white font-bold">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setBellTab('announcements')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${bellTab === 'announcements'
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                      }`}
                  >
                    Notices
                    {announcements.length > 0 && (
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({announcements.length})
                      </span>
                    )}
                  </button>
                </div>

                {bellTab === 'notifications' && unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllRead}
                    className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold px-2 py-0.5 rounded hover:bg-slate-800 transition-colors"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Tab 1: Notifications */}
              {bellTab === 'notifications' && (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No notifications right now.
                    </div>
                  ) : (
                    notifications.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleNotificationClick(item)}
                        className={`p-3.5 hover:bg-slate-800/50 transition-colors cursor-pointer flex items-start gap-3 ${!item.is_read ? 'bg-slate-800/20' : ''
                          }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {!item.is_read ? (
                            <span className="w-2 h-2 rounded-full bg-blue-500 block ring-2 ring-blue-500/20" />
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-slate-700 block" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`text-xs font-semibold truncate ${!item.is_read ? 'text-slate-100 font-bold' : 'text-slate-300'
                                }`}
                            >
                              {item.title}
                            </span>
                            <span className="text-[10px] text-slate-500 shrink-0">
                              {new Date(item.created_at).toLocaleDateString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                              })}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                            {item.message}
                          </p>
                          {item.link_url && (
                            <div className="flex items-center gap-1 text-[11px] text-blue-400 hover:underline mt-1.5 font-medium">
                              <span>Open session</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 2: Announcements */}
              {bellTab === 'announcements' && (
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                  {announcements.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-500">
                      No active announcements at this time.
                    </div>
                  ) : (
                    announcements.map((a) => (
                      <div key={a.id} className="p-3.5 hover:bg-slate-800/40 transition-colors">
                        <div className="flex items-center gap-1.5 mb-1">
                          {a.announcement_type === 'ALERT' ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : a.announcement_type === 'IMPORTANT' ? (
                            <CheckCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          ) : (
                            <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          )}
                          <span className="text-xs font-semibold text-slate-100">{a.title}</span>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {a.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 pt-1">
                          <span className="text-[10px] text-slate-500">
                            {new Date(a.created_at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                          {a.link_url && (
                            <a
                              href={a.link_url}
                              className="text-[11px] text-brand-400 hover:text-brand-300 flex items-center gap-1 underline"
                            >
                              View Details
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Profile Avatar & Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="flex items-center gap-2.5 pl-2 border-l border-slate-800 hover:opacity-90 transition-opacity cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center border border-blue-400/40 shadow-sm">
              {initial}
            </div>
            <div className="hidden md:block text-left">
              <span className="text-xs font-bold text-slate-100 block -mb-0.5 truncate max-w-[120px]">
                {displayName}
              </span>
              <span className="text-[10px] text-slate-400 block font-medium">
                {roleLabel}
              </span>
            </div>
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-52 rounded-xl bg-slate-900 border border-slate-800 shadow-2xl z-50 py-1.5">
              <div className="px-3 py-2 border-b border-slate-800">
                <p className="text-xs font-semibold text-slate-100 truncate">{displayName}</p>
                <p className="text-[11px] text-slate-400 truncate font-mono">{currentUser?.email}</p>
              </div>

              <Link
                href="/profile"
                onClick={() => setIsProfileMenuOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition-colors"
              >
                <User className="w-3.5 h-3.5 text-slate-400" />
                View & Edit Profile
              </Link>

              {currentUser?.is_admin && (
                <Link
                  href="/admin"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs text-amber-400 hover:bg-slate-800 transition-colors font-medium"
                >
                  <GraduationCap className="w-3.5 h-3.5" />
                  Admin Dashboard
                </Link>
              )}

              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors text-left border-t border-slate-800/80 mt-1"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
