'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { useAuth } from '@/hooks/use-auth';

export type Theme = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'system',
  resolvedTheme: 'dark',
  setTheme: () => {},
});

const THEME_STORAGE_KEY = 'theme';

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const [theme, setThemeState] = useState<Theme>('system');
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('dark');

  // Initialize theme from localStorage or server profile
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as Theme | null;
      const initialTheme: Theme = stored || (user?.theme as Theme) || 'system';
      setThemeState(initialTheme);
      
      const resolved = initialTheme === 'system' ? getSystemTheme() : initialTheme;
      setResolvedTheme(resolved);
      document.documentElement.classList.toggle('dark', resolved === 'dark');
    } catch {
      // localStorage may fail in restricted iframes
    }
  }, [user?.theme]);

  // Apply theme to document and update resolvedTheme
  const applyTheme = useCallback((newTheme: Theme) => {
    const resolved = newTheme === 'system' ? getSystemTheme() : newTheme;
    setResolvedTheme(resolved);
    if (resolved === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      applyTheme(newTheme);

      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, newTheme);
      } catch {
        // storage disabled
      }

      // Sync to user profile if authenticated
      if (isAuthenticated) {
        apiClient.patch('/auth/me/', { theme: newTheme }).catch(() => {
          // Non-critical, local preference still preserved
        });
      }
    },
    [applyTheme, isAuthenticated]
  );

  // System theme change listener
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, applyTheme]);

  // Sync across tabs
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_STORAGE_KEY && e.newValue) {
        const next = e.newValue as Theme;
        setThemeState(next);
        applyTheme(next);
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [applyTheme]);

  return (
    <ThemeContext.Provider value={{ theme, resolvedTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Reusable 3-way toggle button / segmented control for Light / Dark / System.
 */
export function ThemeToggle({
  variant = 'segmented',
  className = '',
}: {
  variant?: 'segmented' | 'dropdown' | 'icon';
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className={`w-28 h-8 rounded-lg bg-slate-200/50 dark:bg-slate-800/50 ${className}`} />;
  }

  if (variant === 'segmented') {
    return (
      <div
        className={`inline-flex items-center p-0.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#121216] shadow-inner ${className}`}
        role="group"
        aria-label="Theme switcher"
      >
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            theme === 'light'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Light Theme"
          aria-pressed={theme === 'light'}
        >
          <Sun className="w-3.5 h-3.5 text-amber-500" />
          <span>Light</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            theme === 'dark'
              ? 'bg-[#1E1E24] text-white shadow-sm border border-white/10'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="Dark Theme"
          aria-pressed={theme === 'dark'}
        >
          <Moon className="w-3.5 h-3.5 text-indigo-400" />
          <span>Dark</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg transition-all ${
            theme === 'system'
              ? 'bg-white dark:bg-[#1E1E24] text-slate-900 dark:text-white shadow-sm border border-black/5 dark:border-white/10'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
          }`}
          title="System Theme"
          aria-pressed={theme === 'system'}
        >
          <Laptop className="w-3.5 h-3.5 text-slate-400" />
          <span>Auto</span>
        </button>
      </div>
    );
  }

  // Icon cycle variant
  const cycleTheme = () => {
    if (theme === 'system') setTheme('light');
    else if (theme === 'light') setTheme('dark');
    else setTheme('system');
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={`flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121216] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-sm ${className}`}
      title={`Current: ${theme}. Click to change.`}
      aria-label={`Current: ${theme}. Click to change theme.`}
    >
      {theme === 'light' ? (
        <Sun className="w-4 h-4 text-amber-500" />
      ) : theme === 'dark' ? (
        <Moon className="w-4 h-4 text-indigo-400" />
      ) : (
        <Laptop className="w-4 h-4 text-slate-400" />
      )}
    </button>
  );
}
