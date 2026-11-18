'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEnrollment } from '@/hooks/use-enrollment';
import { CheckCircle2, Sparkles, BookOpen, Edit3, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle?: string;
  courseSubtitle?: string;
  courseId?: string;
}

export const EnrollmentModal: React.FC<EnrollmentModalProps> = ({
  isOpen,
  onClose,
  courseTitle = 'JEE Main + Advanced Complete Course',
  courseSubtitle = 'Structured learning, video lectures, and practice problems for JEE preparation',
  courseId = 'jee-complete',
}) => {
  const router = useRouter();
  const { isEnrolled, enroll } = useEnrollment();
  const alreadyEnrolled = isEnrolled(courseId);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleConfirmEnrollment = async () => {
    setIsSubmitting(true);
    await enroll(courseId);
    setIsSubmitting(false);
    setSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-blue-950/40 space-y-6">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* STATE 1: ALREADY ENROLLED */}
        {alreadyEnrolled && !success ? (
          <div className="space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <Badge variant="emerald" className="px-3 py-1">Already Enrolled ✓</Badge>
              <h3 className="text-xl font-extrabold text-white">You already have access to this course</h3>
              <p className="text-xs text-slate-300 max-w-sm mx-auto">
                Your course enrollment unlocks both video lectures in Learn and Daily Practice Problems in Practice.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  router.push('/learn');
                }}
                className="gap-2 py-2.5 text-xs font-bold"
              >
                <BookOpen className="w-4 h-4" />
                <span>Go to Learn</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  router.push('/practice');
                }}
                className="gap-2 py-2.5 text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>Go to Practice</span>
              </Button>
            </div>
          </div>
        ) : success ? (
          /* STATE 2: ENROLLMENT SUCCESS */
          <div className="space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <Badge variant="blue" className="px-3 py-1">Enrollment Complete</Badge>
              <h3 className="text-xl font-extrabold text-white">Welcome to the Course!</h3>
              <p className="text-xs text-slate-300">
                You now have full access to Learn lectures and Practice DPPs for:
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-blue-400">
                {courseTitle}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="primary"
                onClick={() => {
                  onClose();
                  router.push('/learn');
                }}
                className="gap-2 py-2.5 text-xs font-bold"
              >
                <BookOpen className="w-4 h-4" />
                <span>Start Learning</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  router.push('/practice');
                }}
                className="gap-2 py-2.5 text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <Edit3 className="w-4 h-4 text-emerald-400" />
                <span>Start Practice</span>
              </Button>
            </div>
          </div>
        ) : (
          /* STATE 3: CONFIRM ENROLLMENT FORM */
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-extrabold text-white">Confirm Course Enrollment</h3>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <Badge variant="blue">JEE Main & Advanced 2025</Badge>
              <h4 className="font-bold text-base text-slate-100">{courseTitle}</h4>
              <p className="text-xs text-slate-400">{courseSubtitle}</p>

              <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs">
                <span className="text-slate-400">Course Price:</span>
                <span className="text-lg font-black text-emerald-400">₹0 (Free)</span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span>Unlocks Video Lectures in <strong>Learn</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Unlocks Daily Practice Problems in <strong>Practice</strong></span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
              <Button variant="outline" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleConfirmEnrollment}
                isLoading={isSubmitting}
                className="font-bold px-5"
              >
                Confirm Enrollment
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
