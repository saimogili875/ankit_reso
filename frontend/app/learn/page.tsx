'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useEnrollment } from '@/hooks/use-enrollment';
import { MAIN_COURSE, DEMO_SUBJECTS, Subject, Chapter, Lecture } from '@/lib/demo-data';
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
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

type ClassChoice = 'class11' | 'class12';

export default function LearnPage() {
  const { isEnrolled } = useEnrollment();
  const enrolled = isEnrolled(MAIN_COURSE.id);

  // Flow Step States
  const [selectedCourse, setSelectedCourse] = useState<boolean>(false);
  const [selectedClass, setSelectedClass] = useState<ClassChoice | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [activeLecture, setActiveLecture] = useState<Lecture | null>(null);
  const [resolvedVideoUrl, setResolvedVideoUrl] = useState<string>('');
  const [completedLectures, setCompletedLectures] = useState<Record<string, boolean>>({});

  React.useEffect(() => {
    if (!activeLecture) return;
    setResolvedVideoUrl(activeLecture.videoUrl);
    // Fetch real secure video URL from Django backend via storage_service
    import('@/lib/api-client').then(({ apiClient }) => {
      apiClient.get<Record<string, string>>(`/content/lectures/${activeLecture.id}/video/`)
        .then((data) => {
          if (data && data.video_url) {
            setResolvedVideoUrl(data.video_url);
          }
        })
        .catch(() => {});
    });
  }, [activeLecture]);

  const toggleComplete = (lectureId: string) => {
    setCompletedLectures((prev) => ({ ...prev, [lectureId]: !prev[lectureId] }));
  };

  const getSubjectIcon = (id: string) => {
    switch (id) {
      case 'physics':
        return Atom;
      case 'chemistry':
        return FlaskConical;
      default:
        return Calculator;
    }
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
                <span className="truncate max-w-[140px]">{selectedChapter.title}</span>
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

      {/* VIEW 1: NOT ENROLLED IN COURSE */}
      {!enrolled ? (
        <Card className="p-8 sm:p-12 text-center space-y-5 max-w-2xl mx-auto border-blue-900/40 bg-slate-900/90 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto shadow-inner">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <Badge variant="blue">Single Course Access</Badge>
            <h2 className="text-2xl font-extrabold text-white">No Enrolled Courses Found</h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto leading-relaxed">
              Enroll in the <strong>JEE Main + Advanced Complete Preparation Course</strong> on the Home page for Free to unlock all video lectures and practice problems.
            </p>
          </div>
          <div className="pt-2">
            <Link href="/">
              <Button variant="primary" className="gap-2 px-6 py-3 font-bold shadow-lg shadow-blue-600/30">
                <BookOpen className="w-4 h-4" />
                <span>Explore & Enroll Free on Home</span>
              </Button>
            </Link>
          </div>
        </Card>
      ) : activeLecture && selectedChapter ? (
        /* VIEW 6: VIDEO PLAYER VIEW */
        <div className="space-y-6 max-w-5xl mx-auto">
          {/* HTML5 Video Player Container */}
          <div className="rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-2xl aspect-video relative group">
            <video
              src={resolvedVideoUrl || activeLecture.videoUrl}
              poster={activeLecture.thumbnailUrl}
              controls
              autoPlay
              className="w-full h-full object-contain"
            >
              Your browser does not support video playback.
            </video>
          </div>

          {/* Lecture Info & Meta Actions */}
          <Card className="space-y-4 bg-slate-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="blue">Lecture {activeLecture.lectureNumber}</Badge>
                  <span className="text-xs text-slate-400 font-mono">{activeLecture.duration}</span>
                </div>
                <h2 className="text-xl font-extrabold text-white">{activeLecture.title}</h2>
                <p className="text-xs text-slate-400">{activeLecture.description}</p>
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
                  const idx = selectedChapter.lectures.findIndex((l) => l.id === activeLecture.id);
                  if (idx > 0) setActiveLecture(selectedChapter.lectures[idx - 1]);
                }}
                disabled={selectedChapter.lectures.findIndex((l) => l.id === activeLecture.id) === 0}
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
                  const idx = selectedChapter.lectures.findIndex((l) => l.id === activeLecture.id);
                  if (idx < selectedChapter.lectures.length - 1) setActiveLecture(selectedChapter.lectures[idx + 1]);
                }}
                disabled={selectedChapter.lectures.findIndex((l) => l.id === activeLecture.id) === selectedChapter.lectures.length - 1}
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
                Chapter {selectedChapter.chapterNumber}: {selectedChapter.title}
              </h2>
              <p className="text-xs text-slate-400">{selectedChapter.description}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selectedChapter.lectures.map((lecture) => (
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
                    <span className="text-xs text-slate-400 font-mono">{lecture.duration}</span>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-sm text-slate-100">
                    Lecture 0{lecture.lectureNumber}: {lecture.title}
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
        </div>
      ) : selectedSubject && selectedClass ? (
        /* VIEW 4: CHAPTERS LIST IN SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="blue" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">{selectedSubject.name} Chapters</h2>
            <p className="text-xs text-slate-400">Select a chapter to access video lectures</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {selectedSubject.chapters[selectedClass].map((chap) => (
              <Card
                key={chap.id}
                hoverEffect
                onClick={() => setSelectedChapter(chap)}
                className="cursor-pointer space-y-3 bg-slate-900 border-slate-800 hover:border-blue-500/50"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-blue-400 bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-900">
                    Chapter 0{chap.chapterNumber}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">{chap.lectures.length} Lectures</span>
                </div>

                <div>
                  <h4 className="font-bold text-base text-slate-100">{chap.title}</h4>
                  <p className="text-xs text-slate-400 mt-1">{chap.description}</p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs font-bold text-blue-400">
                  <span>View Lectures</span>
                  <ChevronRight className="w-4 h-4" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      ) : selectedClass ? (
        /* VIEW 3: SELECT SUBJECT */
        <div className="space-y-6">
          <div>
            <Badge variant="blue" className="capitalize">{selectedClass === 'class11' ? 'Class 11' : 'Class 12'}</Badge>
            <h2 className="text-xl font-extrabold text-white mt-1">Select Subject</h2>
            <p className="text-xs text-slate-400">Choose Physics, Chemistry, or Mathematics</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {DEMO_SUBJECTS.map((subj) => {
              const Icon = getSubjectIcon(subj.id);

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
                    <p className="text-xs text-slate-400 mt-1">
                      {subj.chapters[selectedClass].length} Chapters Available
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
            <p className="text-xs text-slate-400">Courses unlocked via your single registration</p>
          </div>

          <div className="max-w-2xl">
            <Card className="p-6 space-y-5 bg-slate-900 border-slate-800 hover:border-blue-500/40 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <Badge variant="blue">JEE Main & Advanced</Badge>
                  <h3 className="font-extrabold text-lg text-slate-100">{MAIN_COURSE.title}</h3>
                  <p className="text-xs text-slate-400">Class 11 + Class 12 • Physics • Chemistry • Mathematics</p>
                </div>
                <Badge variant="emerald" className="px-3 py-1 shrink-0">✓ Enrolled</Badge>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => setSelectedCourse(true)}
                  className="gap-2 px-5 py-2.5 text-xs font-bold shadow-lg shadow-blue-600/20"
                >
                  <span>Open Course</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
