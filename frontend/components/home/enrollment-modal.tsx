'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEnrollment } from '@/hooks/use-enrollment';
import { CheckCircle2, Sparkles, BookOpen, Edit3, X, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { processRazorpayPayment } from '@/lib/razorpay';
import { useAuth } from '@/hooks/use-auth';

export interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseTitle?: string;
  courseSubtitle?: string;
  courseId?: string;
  price?: number | string;
  isFree?: boolean;
}

export const EnrollmentModal: React.FC<EnrollmentModalProps> = ({
  isOpen,
  onClose,
  courseTitle = 'JEE Main + Advanced Complete Course',
  courseSubtitle = 'Structured learning, video lectures, and practice problems for JEE preparation',
  courseId = 'jee-complete',
  price = 0,
  isFree = true,
}) => {
  const router = useRouter();
  const { user } = useAuth();
  const { isEnrolled, enroll, refetch } = useEnrollment();
  const alreadyEnrolled = isEnrolled(courseId);

  const priceNum = Number(price) || 0;
  const requiresPayment = !isFree && priceNum > 0;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentRequiredAlert, setPaymentRequiredAlert] = useState(false);

  if (!isOpen) return null;

  const handleFreeEnrollment = async () => {
    setIsSubmitting(true);
    setPaymentError('');
    setPaymentRequiredAlert(false);

    try {
      const res = await enroll(courseId);
      if (res.success) {
        setSuccess(true);
      } else {
        // If free enrollment failed because course requires payment
        setPaymentRequiredAlert(true);
        setPaymentError('Payment required to enroll in this course. Please proceed with Razorpay checkout.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enrollment failed.';
      if (msg.includes('402') || msg.toLowerCase().includes('payment required')) {
        setPaymentRequiredAlert(true);
        setPaymentError('Payment required: This course requires an active purchase.');
      } else {
        setPaymentError(msg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRazorpayCheckout = async () => {
    setIsSubmitting(true);
    setPaymentError('');

    try {
      await processRazorpayPayment({
        courseId,
        courseTitle,
        description: `Enrollment in ${courseTitle}`,
        prefill: {
          name: user?.full_name || user?.username || 'Student',
          email: user?.email || 'student@example.com',
          contact: user?.phone || user?.phone_number || '',
        },
      });

      await refetch();
      setSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Payment could not be completed.';
      setPaymentError(msg);
    } finally {
      setIsSubmitting(false);
    }
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
                Your course enrollment unlocks full access to curriculum lectures and practice problem sets.
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
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <Badge variant="emerald" className="px-3 py-1">Enrollment Complete</Badge>
              <h3 className="text-xl font-extrabold text-white">Welcome to the Batch!</h3>
              <p className="text-xs text-slate-300">
                You now have full access to Learn video lectures and Practice DPPs for:
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
                className="gap-2 py-2.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white"
              >
                <BookOpen className="w-4 h-4" />
                <span>Start Learning</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  onClose();
                  router.push('/schedule');
                }}
                className="gap-2 py-2.5 text-xs font-bold border-slate-700 text-slate-200 hover:bg-slate-800"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>View Schedule</span>
              </Button>
            </div>
          </div>
        ) : (
          /* STATE 3: CONFIRM ENROLLMENT / CHECKOUT FORM */
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-400" />
              <h3 className="text-lg font-extrabold text-white">
                {requiresPayment || paymentRequiredAlert ? 'Complete Course Purchase' : 'Confirm Free Enrollment'}
              </h3>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={requiresPayment ? 'purple' : 'emerald'}>
                  {requiresPayment ? 'Premium Course' : 'Free Batch'}
                </Badge>
                <span className="text-xs font-bold text-slate-400">Standard Checkout</span>
              </div>
              <h4 className="font-bold text-base text-slate-100">{courseTitle}</h4>
              <p className="text-xs text-slate-400">{courseSubtitle}</p>

              <div className="pt-2 border-t border-slate-900 flex justify-between items-center text-xs">
                <span className="text-slate-400">Total Payable:</span>
                <span className={`text-lg font-black ${requiresPayment ? 'text-blue-400' : 'text-emerald-400'}`}>
                  {requiresPayment ? `₹${priceNum.toLocaleString('en-IN')}` : '₹0 (Free)'}
                </span>
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-400" />
                <span>Unlocks Full Video Lectures in <strong>Learn</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Unlocks Daily Practice Problems & Solutions in <strong>Practice</strong></span>
              </div>
            </div>

            {paymentError && (
              <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-2.5">
              <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>

              {requiresPayment || paymentRequiredAlert ? (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleRazorpayCheckout}
                  disabled={isSubmitting}
                  className="font-bold px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white gap-2 shadow-lg shadow-blue-900/30"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4" />
                  )}
                  <span>Pay ₹{priceNum || 1} & Enroll</span>
                </Button>
              ) : (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleFreeEnrollment}
                  disabled={isSubmitting}
                  className="font-bold px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white gap-2 shadow-lg shadow-emerald-900/30"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  <span>Free Instant Access</span>
                </Button>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
