'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useEnrollment } from '@/hooks/use-enrollment';
import { useActiveCourse } from '@/hooks/use-active-course';
import { CourseSwitcher } from '@/components/courses/CourseSwitcher';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { HlsVideoPlayer } from '@/components/video/hls-player';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  PlayCircle,
  ArrowLeft,
  Atom,
  FlaskConical,
  Calculator,
  Sparkles,
  Lock,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ClassChoice = 'class11' | 'class12';

interface ApiSubject {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

interface ApiChapter {
  id: string;
  name: string;
  slug: string;
  description?: string;
  order: number;
}

interface ApiLecture {
  id: string;
  title: string;
  description: string;
  lecture_number: number;
  duration_seconds: number;
  is_published: boolean;
  video_url?: string;
}

export default function LearnPage() {
  const { isEnrolled } = useEnrollment();
  const {
    enrolledCourses,
    allCourses,
    activeCourse,
    setActiveCourse,
    isEnrolledInAny,
    enrolledCount,
  } = useActiveCourse();

  const enrolled = isEnrolledInAny || isEnrolled();

  // Navigation step states
  const [selectedCourse, setSelectedCourse] = useState<boolean>(false);

  // Auto-enter course if enrolled in 1+ courses
  useEffect(() => {
    if (activeCourse && enrolledCount > 0) {
      setSelectedCourse(true);
    }
  }, [activeCourse, enrolledCount]);
  const [selectedClass, setSelectedClass] = useState<ClassChoice | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<ApiSubject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<ApiChapter | null>(null);
  const [activeLecture, setActiveLecture] = useState<ApiLecture | null>(null);

  // Data states
  const [subjects, setSubjects] = useState<ApiSubject[]>([]);
  const [chapters, setChapters] = useState<ApiChapter[]>([]);
  const [lectures, setLectures] = useState<ApiLecture[]>([]);
  const [playbackData, setPlaybackData] = useState<{
    video_id?: string;
    manifest_url?: string;
    vtt_url?: string;
    poster_url?: string;
    youtube_video_id?: string;
    last_position_seconds?: number;
    duration_seconds?: number;
    completed?: boolean;
  } | null>(null);
  const [completedLectures, setCompletedLectures] = useState<Record<string, boolean>>({});

  // Loading states
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingLectures, setIsLoadingLectures] = useState(false);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);

  // 1. Fetch Subjects on mount
  useEffect(() => {
    let isMounted = true;
    setIsLoadingSubjects(true);
    apiClient.get<ApiSubject[] | { results?: ApiSubject[] }>('/academics/subjects/')
      .then((data) => {
        if (!isMounted) return;
        setSubjects(asList<ApiSubject>(data));
      })
      .catch((err) => {
        console.warn('Failed to load subjects:', err);
      })
      .finally(() => {
        if (isMounted) setIsLoadingSubjects(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Fetch Chapters when subject & class selected
  useEffect(() => {
    if (!selectedSubject) {
      setChapters([]);
      return;
    }

    let isMounted = true;
    setIsLoadingChapters(true);
    const query = selectedClass ? `?class=${selectedClass}` : '';
    apiClient.get<ApiChapter[]>(`/academics/subjects/${selectedSubject.id}/chapters/${query}`)
      .then((data) => {
        if (!isMounted) return;
        setChapters(asList<ApiChapter>(data));
      })
      .catch((err) => {
        console.warn('Failed to load chapters:', err);
        if (isMounted) setChapters([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingChapters(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedSubject, selectedClass]);

  // 3. Fetch Lectures when chapter selected
  useEffect(() => {
    if (!selectedChapter) {
      setLectures([]);
      return;
    }

    let isMounted = true;
    setIsLoadingLectures(true);
    apiClient.get<ApiLecture[]>(`/academics/chapters/${selectedChapter.id}/lectures/`)
      .then((data) => {
        if (!isMounted) return;
        setLectures(asList<ApiLecture>(data));
      })
      .catch((err) => {
        console.warn('Failed to load lectures:', err);
        if (isMounted) setLectures([]);
      })
      .finally(() => {
        if (isMounted) setIsLoadingLectures(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedChapter]);

  // 4. Fetch Secure Playback data when lecture is active
  useEffect(() => {
    if (!activeLecture) {
      setPlaybackData(null);
      return;
    }

    let isMounted = true;
    setIsLoadingVideo(true);
    apiClient.get<{
      video_id?: string;
      manifest_url?: string;
      vtt_url?: string;
      poster_url?: string;
      youtube_video_id?: string;
      last_position_seconds?: number;
      duration_seconds?: number;
      completed?: boolean;
    }>(`/content/lectures/${activeLecture.id}/playback/`)
      .then((data) => {
        if (!isMounted) return;
        setPlaybackData(data);
        if (data.completed) {
          setCompletedLectures((prev) => ({ ...prev, [activeLecture.id]: true }));
        }
      })
      .catch(() => {
        // Fallback to legacy endpoint if playback not yet available
        apiClient.get<{ video_url?: string; r2_url?: string }>(`/content/lectures/${activeLecture.id}/video/`)
          .then((fallback) => {
            if (!isMounted) return;
            const url = fallback?.video_url || fallback?.r2_url || '';
            const isYt = url.includes('youtube.com') || url.includes('youtu.be');
            setPlaybackData({
              video_id: activeLecture.id,
              manifest_url: isYt ? undefined : url,
              youtube_video_id: isYt ? url : undefined,
            });
          })
          .catch(() => {
            if (isMounted) setPlaybackData(null);
          });
      })
      .finally(() => {
        if (isMounted) setIsLoadingVideo(false);
      });

    return () => {
      isMounted = false;
    };
  }, [activeLecture]);

  const toggleComplete = async (lectureId: string) => {
    const nextStatus = !completedLectures[lectureId];
    setCompletedLectures((prev) => ({ ...prev, [lectureId]: nextStatus }));
    try {
      await apiClient.post('/progress/video/', {
        lecture_id: lectureId,
        watched_seconds: activeLecture?.duration_seconds || 120,
        completed: nextStatus,
      });
    } catch {
      // Non-blocking progress persistence
    }
  };

  const handleVideoEnded = async () => {
    if (!activeLecture) return;
    setCompletedLectures((prev) => ({ ...prev, [activeLecture.id]: true }));
    try {
      await apiClient.post('/progress/video/', {
        lecture_id: activeLecture.id,
        watched_seconds: activeLecture.duration_seconds || 1800,
        completed: true,
      });
    } catch {
      // Non-blocking
    }
  };

  const getSubjectIcon = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('phys')) return Atom;
    if (lower.includes('chem')) return FlaskConical;
    return Calculator;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '—';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs > 0 ? `${secs}s` : ''}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1 font-medium">
            <Link href="/" className="hover:text-blue-400 transition-colors">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="text-slate-200 font-semibold">Learn</span>
            {selectedClass && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</span>
              </>
            )}
            {selectedSubject && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span>{selectedSubject.name}</span>
              </>
            )}
            {selectedChapter && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-600" />
                <span className="truncate max-w-[140px]">{selectedChapter.name}</span>
              </>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <span>Learn & Video Lectures</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </h1>
        </div>

        {selectedCourse && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (activeLecture) setActiveLecture(null);
              else if (selectedChapter) setSelectedChapter(null);
              else if (selectedSubject) setSelectedSubject(null);
              else if (selectedClass) setSelectedClass(null);
              else setSelectedCourse(false);
            }}
            className="gap-1.5 text-xs border-slate-800 text-slate-300 hover:bg-slate-900"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back</span>
          </Button>
        )}
      </div>

      {/* Course Switcher */}
      <CourseSwitcher
        activeCourse={activeCourse}
        courses={enrolledCount > 0 ? enrolledCourses : allCourses}
        onSelectCourse={(c) => {
          setActiveCourse(c);
          setSelectedCourse(true);
          setSelectedClass(null);
          setSelectedSubject(null);
          setSelectedChapter(null);
          setActiveLecture(null);
        }}
        isEnrolledInAny={isEnrolledInAny}
        enrolledCount={enrolledCount}
      />

      {/* VIEW 1: NOT ENROLLED */}
      {!enrolled ? (
        <div className="space-y-6">
          <Card className="p-8 text-center space-y-4 max-w-2xl mx-auto border-blue-900/40 bg-slate-900/90 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <Badge variant="blue">Courses Catalog</Badge>
              <h2 className="text-2xl font-extrabold text-white">Select a Course to Unlock</h2>
              <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
                You are currently previewing available courses. Enroll in a batch or course to unlock all video lectures, chapter notes, and mock tests.
              </p>
            </div>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
            {allCourses.map((c) => (
              <Card key={c.id} className="p-5 space-y-4 bg-slate-900/90 border-slate-800 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="blue">{c.exam_type || 'JEE'}</Badge>
                    <span className="font-bold text-amber-400 text-sm">
                      {c.is_free ? 'Free' : `₹${c.price}`}
                    </span>
                  </div>
                  <h3 className="font-extrabold text-lg text-slate-100">{c.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{c.description || 'Structured JEE syllabus concepts'}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-800 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setActiveCourse(c);
                      setSelectedCourse(true);
                    }}
                    className="text-xs border-slate-700 text-slate-300 hover:text-white"
                  >
                    View Previews
                  </Button>
                  <Link href={`/courses`}>
                    <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs">
                      Enroll / Buy
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : activeLecture && selectedChapter ? (
        /* VIEW 6: VIDEO PLAYER VIEW */
        <div className="space-y-6 max-w-5xl mx-auto">
          <div className="w-full">
            {isLoadingVideo ? (
              <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video flex flex-col items-center justify-center gap-2 text-slate-400">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                <span className="text-xs">Connecting to secure video stream...</span>
              </div>
            ) : playbackData && (playbackData.manifest_url || playbackData.youtube_video_id) ? (
              <HlsVideoPlayer
                videoId={playbackData.video_id}
                lectureId={activeLecture.id}
                title={activeLecture.title}
                manifestUrl={playbackData.manifest_url}
                youtubeVideoId={playbackData.youtube_video_id}
                posterUrl={playbackData.poster_url}
                vttUrl={playbackData.vtt_url}
                initialPositionSeconds={playbackData.last_position_seconds || 0}
                durationSeconds={playbackData.duration_seconds || activeLecture.duration_seconds}
                onEnded={handleVideoEnded}
                onProgressUpdate={(watched, lastPos, pct) => {
                  if (pct >= 90) {
                    setCompletedLectures((prev) => ({ ...prev, [activeLecture.id]: true }));
                  }
                }}
              />
            ) : (
              <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video flex flex-col items-center justify-center text-center p-8 space-y-2">
                <AlertCircle className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="text-sm font-semibold text-slate-200">No video media linked to this lecture yet</p>
                <p className="text-xs text-slate-400">Content faculty will link the lecture video shortly.</p>
              </div>
            )}
          </div>

          <Card className="space-y-4 bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="blue">Lecture {activeLecture.lecture_number}</Badge>
                  <span className="text-xs text-slate-400 font-mono">
                    {formatDuration(activeLecture.duration_seconds)}
                  </span>
                </div>
                <h2 className="text-xl font-extrabold text-white">{activeLecture.title}</h2>
                <p className="text-xs text-slate-400">{activeLecture.description || 'No description provided.'}</p>
              </div>

              <Button
                variant={completedLectures[activeLecture.id] ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => toggleComplete(activeLecture.id)}
                className="gap-2 text-xs font-semibold shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{completedLectures[activeLecture.id] ? 'Completed ✓' : 'Mark as Completed'}</span>
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = lectures.findIndex((l) => l.id === activeLecture.id);
                  if (idx > 0) setActiveLecture(lectures[idx - 1]);
                }}
                disabled={lectures.findIndex((l) => l.id === activeLecture.id) <= 0}
                className="text-xs border-slate-800 text-slate-300"
              >
                ← Previous Lecture
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedChapter(null)}
                className="text-xs border-slate-800 text-slate-300"
              >
                Back to Chapters
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const idx = lectures.findIndex((l) => l.id === activeLecture.id);
                  if (idx >= 0 && idx < lectures.length - 1) setActiveLecture(lectures[idx + 1]);
                }}
                disabled={lectures.findIndex((l) => l.id === activeLecture.id) >= lectures.length - 1}
                className="text-xs border-slate-800 text-slate-300"
              >
                Next Lecture →
              </Button>
            </div>
          </Card>
        </div>
      ) : selectedChapter ? (
        /* VIEW 5: LECTURES LIST IN CHAPTER */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Badge variant="blue">{selectedSubject?.name}</Badge>
              <h2 className="text-xl font-extrabold text-white mt-1">
                {selectedChapter.name}
              </h2>
              <p className="text-xs text-slate-400">{selectedChapter.description || 'Select a lecture to stream video'}</p>
            </div>
          </div>

          {isLoadingLectures ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : lectures.length === 0 ? (
            <Card className="p-8 text-center space-y-2 bg-slate-900 border-slate-800">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No lectures added yet</h3>
              <p className="text-xs text-slate-400">Lectures for this chapter will appear here once added by faculty.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {lectures.map((lecture) => (
                <Card
                  key={lecture.id}
                  hoverEffect
                  onClick={() => setActiveLecture(lecture)}
                  className="cursor-pointer space-y-3 bg-slate-900 border-slate-800 hover:border-blue-500/50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                      <PlayCircle className="w-5 h-5" />
                    </div>
                    <div className="flex items-center gap-2">
                      {completedLectures[lecture.id] && (
                        <span className="text-[10px] bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded-full font-bold">
                          Completed ✓
                        </span>
                      )}
                      <span className="text-xs text-slate-400 font-mono">
                        {formatDuration(lecture.duration_seconds)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-bold text-sm text-slate-100">
                      Lecture {lecture.lecture_number}: {lecture.title}
                    </h4>
                    <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">{lecture.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-400">
                    <span>Watch Lecture</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : selectedSubject && selectedClass ? (
        /* VIEW 4: CHAPTERS LIST IN SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="blue" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">{selectedSubject.name} Chapters</h2>
            <p className="text-xs text-slate-400">Select a chapter to access video lectures</p>
          </div>

          {isLoadingChapters ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : chapters.length === 0 ? (
            <Card className="p-8 text-center space-y-2 bg-slate-900 border-slate-800">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No chapters added yet</h3>
              <p className="text-xs text-slate-400">Chapters for {selectedSubject.name} will appear here once added in the Admin Panel.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {chapters.map((chap, idx) => (
                <Card
                  key={chap.id}
                  hoverEffect
                  onClick={() => setSelectedChapter(chap)}
                  className="cursor-pointer space-y-3 bg-slate-900 border-slate-800 hover:border-blue-500/50"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-blue-400 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-900">
                      Chapter {idx + 1}
                    </span>
                  </div>

                  <div>
                    <h4 className="font-bold text-base text-slate-100">{chap.name}</h4>
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2">{chap.description || 'Structured JEE syllabus concepts'}</p>
                  </div>

                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-blue-400">
                    <span>View Lectures</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : selectedClass ? (
        /* VIEW 3: SELECT SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="blue" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">Select Subject</h2>
            <p className="text-xs text-slate-400">Choose Physics, Chemistry, or Mathematics</p>
          </div>

          {isLoadingSubjects ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : subjects.length === 0 ? (
            <Card className="p-8 text-center space-y-2 bg-slate-900 border-slate-800">
              <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">No subjects added yet</h3>
              <p className="text-xs text-slate-400">Please create subjects in the Admin Panel.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subjects.map((subj) => {
                const Icon = getSubjectIcon(subj.name);

                return (
                  <Card
                    key={subj.id}
                    hoverEffect
                    onClick={() => setSelectedSubject(subj)}
                    className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-blue-500/50 p-6"
                  >
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-slate-100">{subj.name}</h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                        {subj.description || `Master JEE concepts in ${subj.name}`}
                      </p>
                    </div>
                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-blue-400">
                      <span>Select Subject</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      ) : selectedCourse ? (
        /* VIEW 2: SELECT CLASS */
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">Select Class</h2>
            <p className="text-xs text-slate-400">Choose Class 11 or Class 12 syllabus</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl">
            <Card
              hoverEffect
              onClick={() => setSelectedClass('class11')}
              className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-blue-500/50 p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-white">CLASS 11</h3>
                <p className="text-xs text-slate-400 mt-1">Physics, Chemistry & Mathematics</p>
              </div>
              <Button variant="primary" className="w-full font-bold">
                <span>Start Learning →</span>
              </Button>
            </Card>

            <Card
              hoverEffect
              onClick={() => setSelectedClass('class12')}
              className="cursor-pointer space-y-4 bg-slate-900 border-slate-800 hover:border-blue-500/50 p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-2xl font-extrabold text-white">CLASS 12</h3>
                <p className="text-xs text-slate-400 mt-1">Physics, Chemistry & Mathematics</p>
              </div>
              <Button variant="primary" className="w-full font-bold bg-indigo-600 hover:bg-indigo-500">
                <span>Start Learning →</span>
              </Button>
            </Card>
          </div>
        </div>
      ) : (
        /* VIEW 1: MY ENROLLED COURSES LIST */
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">My Enrolled Courses</h2>
            <p className="text-xs text-slate-400">Courses unlocked via your registration</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
            {enrolledCourses.map((c) => (
              <Card key={c.id} className="p-6 space-y-5 bg-slate-900 border-slate-800 hover:border-blue-500/40 transition-colors flex flex-col justify-between">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <Badge variant="blue">{c.exam_type || 'JEE'}</Badge>
                    <h3 className="font-extrabold text-lg text-slate-100">{c.title}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2">{c.description || 'Structured JEE syllabus concepts'}</p>
                  </div>
                  <Badge variant="emerald" className="px-3 py-1 shrink-0">✓ Enrolled</Badge>
                </div>

                <div className="pt-3 border-t border-slate-800 flex justify-end">
                  <Button
                    variant="primary"
                    onClick={() => {
                      setActiveCourse(c);
                      setSelectedCourse(true);
                    }}
                    className="gap-2 px-5 py-2.5 text-xs font-bold shadow-lg shadow-blue-600/20"
                  >
                    <span>Open Course</span>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
