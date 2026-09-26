'use client';

import { useState, useEffect, useCallback } from 'react';
import { MAIN_COURSE } from '@/lib/demo-data';
import { apiClient } from '@/lib/api-client';

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

  // Sync state with Django API and localStorage fallback
  const loadEnrollments = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Load local cache immediately for zero-lag UI
    let localCache: Record<string, EnrollmentRecord> = {};
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        localCache = JSON.parse(stored);
        setEnrollments(localCache);
      }
    } catch (e) {
      console.warn('LocalStorage read error:', e);
    }

    // Sync with Django REST API `/api/enrollment/my-courses/`
    try {
      const res = await apiClient.get('/enrollment/my-courses/');
      if (Array.isArray(res)) {
        const remoteMap: Record<string, EnrollmentRecord> = { ...localCache };
        res.forEach((course: Record<string, unknown>) => {
          const cid = String(course.id || course.slug || MAIN_COURSE.id);
          remoteMap[cid] = {
            courseId: cid,
            enrolledAt: new Date().toISOString(),
            status: 'active',
          };
          // Also map default main course ID
          remoteMap[MAIN_COURSE.id] = {
            courseId: MAIN_COURSE.id,
            enrolledAt: new Date().toISOString(),
            status: 'active',
          };
        });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(remoteMap));
        setEnrollments(remoteMap);
      }
    } catch (apiErr) {
      // API fallback
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
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [loadEnrollments]);

  const isEnrolled = useCallback(
    (courseId: string = MAIN_COURSE.id): boolean => {
      return !!enrollments[courseId] || !!enrollments[MAIN_COURSE.id];
    },
    [enrollments]
  );

  const enroll = useCallback(
    async (courseId: string = MAIN_COURSE.id): Promise<{ success: boolean; alreadyEnrolled: boolean }> => {
      if (typeof window === 'undefined') return { success: false, alreadyEnrolled: false };

      let apiAlreadyEnrolled = false;

      // Make API POST request to Django backend
      try {
        const res = await apiClient.post<Record<string, boolean>>('/enrollment/enroll/', { course_id: courseId });
        if (res && res.already_enrolled) {
          apiAlreadyEnrolled = true;
        }
      } catch (e) {
        console.warn('API enrollment network fallback:', e);
      }

      try {
        const current = localStorage.getItem(STORAGE_KEY);
        const parsed: Record<string, EnrollmentRecord> = current ? JSON.parse(current) : {};

        if (parsed[courseId] || apiAlreadyEnrolled) {
          return { success: false, alreadyEnrolled: true };
        }

        const newRecord: EnrollmentRecord = {
          courseId,
          enrolledAt: new Date().toISOString(),
          status: 'active',
        };

        const updated = { ...parsed, [courseId]: newRecord, [MAIN_COURSE.id]: newRecord };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        setEnrollments(updated);

        window.dispatchEvent(new Event(EVENT_NAME));
        return { success: true, alreadyEnrolled: false };
      } catch (e) {
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
