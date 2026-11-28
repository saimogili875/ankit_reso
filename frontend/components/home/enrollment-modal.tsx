'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useEnrollment } from '@/hooks/use-enrollment';
import { CheckCircle2, X, CreditCard, AlertCircle, Loader2 } from 'lucide-react';
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

  if (!isOpen) return null;

  const handleFreeEnrollment = async () => {
    setIsSubmitting(true);
    setPaymentError('');

    try {
      const res = await enroll(courseId);
      if (res.success) {
        setSuccess(true);
      } else {
        setPaymentError('Payment required to enroll in this course. Please proceed with Razorpay checkout.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Enrollment failed.';
      if (msg.includes('402') || msg.toLowerCase().includes('payment required')) {
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
          name: user?.full_name || `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.username || 'Student',
          email: user?.email || '',
          contact: (user?.phone as string) || (user?.phone_number as string) || '',
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
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border-t sm:border border-[#E3E7EE] dark:border-slate-800 rounded-t-3xl sm:rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-8">
        
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 transition-colors"
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
              <h3 className="font-heading text-xl font-bold text-[#101828] dark:text-slate-100">
                You are already enrolled!
              </h3>
              <p className="text-xs text-[#5B6475] dark:text-slate-400 max-w-sm mx-auto">
                You have full access to all video lectures, DPP problems, and CBT mocks in this course.
              </p>
            </div>

            <Button
              onClick={() => {
                onClose();
                router.push('/learn');
              }}
              className="w-full bg-[#2B2FB8] text-white hover:bg-[#232799] font-bold text-sm min-h-[44px]"
            >
              Start Learning Now
            </Button>
          </div>
        ) : success ? (
          /* STATE 2: SUCCESS ENROLLED */
          <div className="space-y-6 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h3 className="font-heading text-xl font-bold text-[#101828] dark:text-slate-100">
                Enrollment Successful!
              </h3>
              <p className="text-xs text-[#5B6475] dark:text-slate-400 max-w-sm mx-auto">
                Congratulations! You are now enrolled in <strong>{courseTitle}</strong>.
              </p>
            </div>

            <Button
              onClick={() => {
                onClose();
                router.push('/learn');
              }}
              className="w-full bg-[#2B2FB8] text-white hover:bg-[#232799] font-bold text-sm min-h-[44px]"
            >
              Open Curriculum
            </Button>
          </div>
        ) : (
          /* STATE 3: CONFIRMATION / PAYMENT SELECTION */
          <div className="space-y-5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#2B2FB8] dark:text-blue-400 block mb-1">
                Course Enrollment
              </span>
              <h3 className="font-heading text-xl font-bold text-[#101828] dark:text-slate-100">
                {courseTitle}
              </h3>
              <p className="text-xs text-[#5B6475] dark:text-slate-400 mt-1">
                {courseSubtitle}
              </p>
            </div>

            {/* Price Banner */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-[#E3E7EE] dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs text-[#5B6475] dark:text-slate-400 block">Total Admission Fee</span>
                <span className="text-xl font-black text-[#101828] dark:text-white">
                  {requiresPayment ? `₹${priceNum}` : 'FREE (No Charge)'}
                </span>
              </div>
              <Badge className={requiresPayment ? 'bg-[#2B2FB8] text-white' : 'bg-emerald-600 text-white'}>
                {requiresPayment ? 'Standard Course' : 'Open Access'}
              </Badge>
            </div>

            {/* Error / Alert Display */}
            {paymentError && (
              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-rose-700 dark:text-rose-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{paymentError}</span>
              </div>
            )}

            {/* Actions */}
            <div className="pt-2">
              {requiresPayment ? (
                <Button
                  onClick={handleRazorpayCheckout}
                  disabled={isSubmitting}
                  className="w-full bg-[#2B2FB8] hover:bg-[#232799] text-white font-bold text-sm gap-2 min-h-[48px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Opening Payment Gateway...</span>
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-4 h-4" />
                      <span>Pay ₹{priceNum} via Razorpay</span>
                    </>
                  )}
                </Button>
              ) : (
                <Button
                  onClick={handleFreeEnrollment}
                  disabled={isSubmitting}
                  className="w-full bg-[#2B2FB8] hover:bg-[#232799] text-white font-bold text-sm gap-2 min-h-[48px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Enrolling...</span>
                    </>
                  ) : (
                    <span>Confirm Free Enrollment</span>
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
