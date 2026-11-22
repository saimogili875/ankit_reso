'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import {
  ShieldCheck,
  LogOut,
  ExternalLink,
  Menu,
  X,
  Loader2,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import { adminNavGroups, findNavItem, isNavActive } from '@/components/admin/admin-nav';
import { CommandSearch } from '@/components/admin/command-search';
import { ThemeToggle } from '@/components/admin/theme-toggle';

const COLLAPSE_KEY = 'admin_sidebar_collapsed';

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() || '/admin';
  const { user: adminUser, isLoading, logout } = useAuth();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [badges, setBadges] = useState<{ open_doubts_count?: number }>({});

  // Only administrators may access this layout
  useEffect(() => {
    if (!isLoading && (!adminUser || !adminUser.is_admin)) {
      router.replace('/admin/login');
    }
  }, [adminUser, isLoading, router]);

  // Remember sidebar collapse state in localStorage inside try/catch
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSE_KEY) === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSE_KEY, next ? '1' : '0');
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  };

  // Sidebar badge (open doubts)
  const loadBadges = useCallback(async () => {
    try {
      const res = await apiClient.get<{ open_doubts_count?: number }>('/admin-panel/overview/');
      setBadges({ open_doubts_count: res?.open_doubts_count ?? 0 });
    } catch {
      /* badge is optional */
    }
  }, []);

  useEffect(() => {
    if (adminUser?.is_admin) loadBadges();
  }, [adminUser, loadBadges, pathname]);

  // Close mobile drawer on navigation
  useEffect(() => setDrawerOpen(false), [pathname]);

  // Ctrl/Cmd + K shortcut opens section search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await logout();
  };

  if (isLoading || !adminUser || !adminUser.is_admin) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
          <span>Verifying administrator permissions…</span>
        </div>
      </div>
    );
  }

  const current = findNavItem(pathname);
  const displayName = adminUser.full_name || adminUser.first_name || adminUser.username || 'Administrator';
  const initials = displayName
    .split(' ')
    .map((p: string) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const renderNav = (compact: boolean) => (
    <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-4" aria-label="Admin sections">
      {adminNavGroups.map((group) => (
        <div key={group.title}>
          {group.title === 'Overview' ? null : compact ? (
            <div className="mx-2 mb-2 border-t border-slate-200 dark:border-slate-800" />
          ) : (
            <p className="px-3 mb-1 text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{group.title}</p>
          )}
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isNavActive(pathname, item.href);
              const badge = item.badgeKey ? badges[item.badgeKey] : undefined;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    title={compact ? item.label : undefined}
                    aria-current={active ? 'page' : undefined}
                    className={`relative flex items-center gap-3 rounded-xl text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      compact ? 'justify-center h-10 w-10 mx-auto' : 'px-3 py-2'
                    } ${
                      active
                        ? 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-white font-semibold shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900/60'
                    }`}
                  >
                    {active && !compact && (
                      <span className="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-r-full bg-indigo-600 dark:bg-indigo-400" />
                    )}
                    <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? 'text-indigo-600 dark:text-indigo-300' : ''}`} />
                    {!compact && <span className="flex-1 truncate">{item.label}</span>}
                    {badge ? (
                      compact ? (
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-500" />
                      ) : (
                        <span className="text-[11px] font-semibold px-1.5 min-w-[20px] text-center rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-300 border border-rose-500/20">
                          {badge}
                        </span>
                      )
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (compact: boolean) => (
    <Link href="/admin" className={`flex items-center gap-3 ${compact ? 'justify-center' : ''}`}>
      <span className="w-9 h-9 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center p-1.5 shrink-0 shadow-sm">
        <Image src="/images/logo-icon.png" alt="Adept Eduverse" width={24} height={24} className="object-contain" priority />
      </span>
      {!compact && (
        <span className="leading-tight">
          <span className="block text-sm font-bold text-slate-900 dark:text-white">Adept Eduverse</span>
          <span className="block text-xs text-slate-500 dark:text-slate-400">Admin Console</span>
        </span>
      )}
    </Link>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800/80 transition-[width] duration-200 shadow-sm ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        <div className={`h-16 flex items-center shrink-0 ${collapsed ? 'justify-center' : 'px-5'}`}>
          {brand(collapsed)}
        </div>
        {renderNav(collapsed)}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80">
          <button
            type="button"
            onClick={toggleCollapsed}
            className={`flex items-center gap-3 rounded-xl text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors ${
              collapsed ? 'justify-center h-10 w-10 mx-auto' : 'w-full px-3 py-2'
            }`}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="h-16 px-5 flex items-center justify-between shrink-0 border-b border-slate-100 dark:border-slate-800/80">
              {brand(false)}
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNav(false)}
          </aside>
        </div>
      )}

      {/* Main column */}
      <div className={`transition-[padding] duration-200 ${collapsed ? 'lg:pl-[72px]' : 'lg:pl-64'}`}>
        <header className="sticky top-0 z-30 h-16 flex items-center gap-3 px-4 sm:px-6 lg:px-8 bg-white/90 dark:bg-slate-950/90 backdrop-blur border-b border-slate-200 dark:border-slate-800/80 shadow-xs">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-2 -ml-2 rounded-xl text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-900"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-sm min-w-0">
            <span className="text-slate-400 dark:text-slate-500 hidden sm:inline">Admin</span>
            {current && current.item.href !== '/admin' && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 hidden sm:inline" />
                <span className="text-slate-500 dark:text-slate-400 hidden md:inline">{current.group}</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 dark:text-slate-600 hidden md:inline" />
              </>
            )}
            <span className="font-bold text-slate-900 dark:text-white truncate">
              {current?.item.label ?? 'Dashboard'}
            </span>
          </div>

          <div className="flex-1" />

          {/* Jump to Section Search */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 h-9 w-52 xl:w-72 px-3 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-500 hover:border-slate-300 dark:hover:border-slate-700 transition-colors shadow-xs"
          >
            <Search className="w-4 h-4 text-slate-400" />
            <span className="flex-1 text-left">Jump to section…</span>
            <kbd className="text-[10px] border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-500 dark:text-slate-400">Ctrl K</kbd>
          </button>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="sm:hidden p-2 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"
            aria-label="Search sections"
          >
            <Search className="w-5 h-5" />
          </button>

          {/* Light/Dark Mode Theme Toggle */}
          <ThemeToggle />

          {/* Student portal link */}
          <Link
            href="/"
            target="_blank"
            rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
          >
            <ExternalLink className="w-3.5 h-3.5 text-indigo-500" />
            <span>Student portal</span>
          </Link>

          {/* Account profile & Logout */}
          <div className="flex items-center gap-2.5 pl-2.5 border-l border-slate-200 dark:border-slate-800">
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-8 h-8 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shadow-xs">
                {initials || <ShieldCheck className="w-4 h-4" />}
              </span>
              <span className="hidden xl:block leading-tight max-w-[160px]">
                <span className="block text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{displayName}</span>
                <span className="block text-[11px] text-slate-500 truncate">{adminUser.email}</span>
              </span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-900 hover:bg-rose-50 dark:hover:bg-rose-950/20 disabled:opacity-50 transition-colors shadow-xs"
              title="Sign out of admin console"
            >
              {isLoggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="w-full max-w-[1680px] mx-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>

      <CommandSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
