export type Role = 'STUDENT' | 'ADMIN' | 'INSTRUCTOR';
export type TargetExam = 'JEE_MAIN' | 'JEE_ADVANCED' | 'BOTH';
export type VideoSourceType = 'YOUTUBE' | 'CLOUD';
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionType = 'SINGLE' | 'MULTIPLE' | 'NUMERICAL';

export interface StudentProfile {
  target_exam: TargetExam;
  target_year: number;
  avatar_url?: string;
  bio?: string;
}

export interface User {
  id: string;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  role: Role;
  phone_number?: string;
  is_verified: boolean;
  student_profile?: StudentProfile;
}

export interface Subject {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color_hex: string;
}

export interface Chapter {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  order: number;
}

export interface Video {
  id: string;
  title: string;
  description?: string;
  duration_seconds: number;
  video_source_type: VideoSourceType;
  youtube_video_id?: string;
  r2_object_key?: string;
  thumbnail_key?: string;
  is_free_preview: boolean;
}

export interface Question {
  id: string;
  question_text: string;
  solution_text?: string;
  difficulty: Difficulty;
  question_type: QuestionType;
}

export interface Test {
  id: string;
  title: string;
  description?: string;
  test_type: 'FULL' | 'CHAPTER' | 'SUBJECT';
  duration_minutes: number;
  total_marks: number;
  is_published: boolean;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  message?: string;
  status: number;
}
