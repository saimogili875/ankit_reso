'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useUser, useClerk } from '@clerk/nextjs';
import { apiClient, clearAuthCookies } from '@/lib/api-client';

export interface StudentProfileData {
  target_exam?: string;
  target_year?: number | string;
  bio?: string;
  [key: string]: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  username: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  phone?: string | null;
  phone_number?: string | null;
  is_verified?: boolean;
  is_email_verified?: boolean;
  is_phone_verified?: boolean;
  is_admin?: boolean;
  student_profile?: StudentProfileData | null;
  [key: string]: unknown;
}

interface CurrentUserResponse {
  authenticated: boolean;
  user: AuthUser | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<AuthUser | null>;
  logout: () => Promise<void>;
  setUser: React.Dispatch<React.SetStateAction<AuthUser | null>>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isFetchingRef = useRef(false);
  const isMountedRef = useRef(true);

  const fetchUser = useCallback(async (): Promise<AuthUser | null> => {
    if (isFetchingRef.current) return null;
    isFetchingRef.current = true;
    try {
      const res = await apiClient.get<CurrentUserResponse>('/auth/me/');
      if (!isMountedRef.current) return null;
      if (res && res.authenticated && res.user) {
        setUser(res.user);
        return res.user;
      } else {
        setUser(null);
        clearAuthCookies();
        return null;
      }
    } catch {
      if (isMountedRef.current) {
        setUser(null);
        clearAuthCookies();
      }
      return null;
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchUser();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchUser]);

  const { signOut } = useClerk();

  useEffect(() => {
    if (clerkLoaded) {
      if (!clerkUser) {
        setUser(null);
        clearAuthCookies();
        setIsLoading(false);
      } else {
        fetchUser();
      }
    }
  }, [fetchUser, clerkLoaded, clerkUser]);

  const logout = useCallback(async () => {
    try {
      clearAuthCookies();
      await apiClient.logout();
    } catch {
      // Ignored
    } finally {
      setUser(null);
      // End the Clerk session and land on the public home page
      await signOut({ redirectUrl: '/' });
    }
  }, [signOut]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: Boolean(user),
    refresh: fetchUser,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
