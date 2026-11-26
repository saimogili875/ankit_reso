'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';

export interface CourseData {
  id: string;
  title: string;
  slug?: string;
  price?: string | number;
  original_price?: string | number;
  is_free?: boolean;
  exam_type?: string;
  thumbnail_url?: string;
  description?: string;
  features?: string[];
  is_enrolled?: boolean;
}

const LOCAL_STORAGE_KEY = 'adept_last_selected_course_id';

export function useActiveCourse() {
  const [enrolledCourses, setEnrolledCourses] = useState<CourseData[]>([]);
  const [allCourses, setAllCourses] = useState<CourseData[]>([]);
  const [activeCourse, setActiveCourseState] = useState<CourseData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Initialize courses and restore last selected course
  const initCourses = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Fetch user profile (for server-persisted last_selected_course_id)
      let serverSavedCourseId = '';
      try {
        const meRes = await apiClient.get<{ authenticated?: boolean; user?: { student_profile?: { last_selected_course_id?: string } } }>('/auth/me/');
        if (meRes?.authenticated && meRes.user?.student_profile?.last_selected_course_id) {
          serverSavedCourseId = meRes.user.student_profile.last_selected_course_id;
        }
      } catch {
        // Fall back to localStorage
      }

      const localSavedCourseId = typeof window !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_KEY) || '' : '';
      const targetCourseId = serverSavedCourseId || localSavedCourseId;

      // 2. Fetch enrolled courses & all published courses
      const [myRes, allRes] = await Promise.all([
        apiClient.get<CourseData[]>('/academics/enrollment/my-courses/').catch(() => []),
        apiClient.get<CourseData[]>('/courses/').catch(() => []),
      ]);

      const myCoursesList = asList<CourseData>(myRes).map((c) => ({ ...c, is_enrolled: true }));
      const allCoursesList = asList<CourseData>(allRes);

      setEnrolledCourses(myCoursesList);
      setAllCourses(allCoursesList);

      // 3. Determine active course according to Phase 2 rules:
      // - Enrolled in 1 course: open straight into it.
      // - Enrolled in 2+ courses: match targetCourseId or first enrolled course.
      // - Enrolled in 0: match targetCourseId in allCourses or first course in allCourses.
      if (myCoursesList.length === 1) {
        setActiveCourseState(myCoursesList[0]);
      } else if (myCoursesList.length > 1) {
        const matched = myCoursesList.find((c) => c.id === targetCourseId || c.slug === targetCourseId);
        setActiveCourseState(matched || myCoursesList[0]);
      } else if (allCoursesList.length > 0) {
        const matched = allCoursesList.find((c) => c.id === targetCourseId || c.slug === targetCourseId);
        setActiveCourseState(matched || allCoursesList[0]);
      } else {
        setActiveCourseState(null);
      }
    } catch (err) {
      console.error('[useActiveCourse] failed to load courses:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    initCourses();
  }, [initCourses]);

  // Set active course with server + localStorage persistence
  const setActiveCourse = useCallback((course: CourseData) => {
    setActiveCourseState(course);
    if (typeof window !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, course.id);
    }
    // Non-blocking server sync
    apiClient.post('/auth/select-course/', { course_id: course.id }).catch(() => {
      // Ignored if user is guest
    });
  }, []);

  return {
    enrolledCourses,
    allCourses,
    activeCourse,
    setActiveCourse,
    isEnrolledInAny: enrolledCourses.length > 0,
    enrolledCount: enrolledCourses.length,
    isLoading,
    refreshCourses: initCourses,
  };
}
