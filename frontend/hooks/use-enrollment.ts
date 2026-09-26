'use client';

import { useState, useEffect, useCallback } from 'react';
import { MAIN_COURSE } from '@/lib/demo-data';

const STORAGE_KEY = 'ankit_jee_enrollments_v1';
const EVENT_NAME = 'ankit_jee_enrollment_change';

export interface EnrollmentRecord {
  courseId: string;
  enrolledAt: string;
  status: 'active';
}

export function useEnrollment() {
  const [enrollments, setEnrollments] = useState<Record<string, EnrollmentRecord>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Load initial enrollment state from localStorage
  const loadEnrollments = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setEnrollments(JSON.parse(stored));
      } else {
        setEnrollments({});
      }
    } catch (e) {
      console.error('Failed to load enrollments from localStorage:', e);
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    loadEnrollments();

    const handleStorageChange = () => {
      loadEnrollments();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener(EVENT_NAME, handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener(EVENT_NAME, handleStorageChange);
    };
  }, [loadEnrollments]);

  const isEnrolled = useCallback(
    (courseId: string = MAIN_COURSE.id): boolean => {
      return !!enrollments[courseId];
    },
    [enrollments]
  );

  const enroll = useCallback(
    (courseId: string = MAIN_COURSE.id): { success: boolean; alreadyEnrolled: boolean } => {
      if (typeof window === 'undefined') return { success: false, alreadyEnrolled: false };

      try {
        const current = localStorage.getItem(STORAGE_KEY);
        const parsed: Record<string, EnrollmentRecord> = current ? JSON.parse(current) : {};

        if (parsed[courseId]) {
          return { success: false, alreadyEnrolled: true };
        }

        const newRecord: EnrollmentRecord = {
          courseId,
          enrolledAt: new Date().toISOString(),
          status: 'active',
        };

        const updated = { ...parsed, [courseId]: newRecord };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setEnrollments(updated);

        // Dispatch custom event for reactive UI updates across all components
        window.dispatchEvent(new Event(EVENT_NAME));

        return { success: true, alreadyEnrolled: false };
      } catch (e) {
        console.error('Failed to save enrollment:', e);
        return { success: false, alreadyEnrolled: false };
      }
    },
    []
  );

  return {
    isEnrolled,
    enroll,
    enrollments,
    isInitialized,
    mainCourseEnrolled: isEnrolled(MAIN_COURSE.id),
  };
}
