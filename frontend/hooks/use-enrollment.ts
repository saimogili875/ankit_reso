'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';

export interface EnrollmentRecord {
  courseId: string;
  enrolledAt: string;
  status: 'active';
}

interface EnrolledCourseApi {
  id: string;
  title: string;
  slug?: string;
  created_at?: string;
}

export function useEnrollment() {
  const [enrollments, setEnrollments] = useState<Record<string, EnrollmentRecord>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Sync state with Django API only (no localStorage fallback)
  const loadEnrollments = useCallback(async () => {
    try {
      const res = await apiClient.get<EnrolledCourseApi[]>('/academics/enrollment/my-courses/');
      if (Array.isArray(res)) {
        const remoteMap: Record<string, EnrollmentRecord> = {};
        res.forEach((course) => {
          const cid = String(course.id || course.slug || 'jee-complete');
          remoteMap[cid] = {
            courseId: cid,
            enrolledAt: course.created_at || new Date().toISOString(),
            status: 'active',
          };
        });
        setEnrollments(remoteMap);
      } else {
        setEnrollments({});
      }
    } catch {
      setEnrollments({});
    } finally {
      setIsInitialized(true);
    }
  }, []);

  useEffect(() => {
    loadEnrollments();
  }, [loadEnrollments]);

  const isEnrolled = useCallback(
    (courseId?: string): boolean => {
      if (!courseId) return Object.keys(enrollments).length > 0;
      return !!enrollments[courseId] || Object.keys(enrollments).length > 0;
    },
    [enrollments]
  );

  const enroll = useCallback(
    async (courseId: string = 'jee-complete'): Promise<{ success: boolean; alreadyEnrolled: boolean }> => {
      try {
        const res = await apiClient.post<{ already_enrolled?: boolean }>('/academics/enrollment/enroll/', {
          course_id: courseId,
        });
        const alreadyEnrolled = Boolean(res?.already_enrolled);
        await loadEnrollments();
        return { success: true, alreadyEnrolled };
      } catch (e) {
        console.warn('API enrollment failed:', e);
        return { success: false, alreadyEnrolled: false };
      }
    },
    [loadEnrollments]
  );

  return {
    isEnrolled,
    enroll,
    enrollments,
    isInitialized,
    refetch: loadEnrollments,
  };
}
