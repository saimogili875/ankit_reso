'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Sparkles,
  Send,
  HelpCircle,
  CheckCircle2,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  ImageIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';

interface SubjectOption {
  id: string | number;
  name: string;
}

interface DoubtRecord {
  id: string;
  title: string;
  question_text: string;
  image_url?: string | null;
  subject?: string | number;
  subject_name?: string;
  status: 'OPEN' | 'RESOLVED';
  reply_text?: string | null;
  replied_by_name?: string | null;
  replied_at?: string | null;
  created_at: string;
}

export default function DoubtSolverPage() {
  const [doubts, setDoubts] = useState<DoubtRecord[]>([]);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form inputs
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [dRes, sRes] = await Promise.all([
        apiClient.get<DoubtRecord[] | { results: DoubtRecord[] }>('/doubts/my/').catch(() => []),
        apiClient.get<SubjectOption[] | { results: SubjectOption[] }>('/academics/subjects/').catch(() => []),
      ]);
      const loadedDoubts = asList<DoubtRecord>(dRes);
      const loadedSubjects = asList<SubjectOption>(sRes);

      setDoubts(loadedDoubts);
      setSubjects(loadedSubjects);
      if (loadedSubjects.length > 0 && !subjectId) {
        setSubjectId(String(loadedSubjects[0].id));
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load your doubts.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !questionText.trim() || !subjectId) {
      setFeedback({ type: 'error', message: 'Please fill in all required fields.' });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/doubts/', {
        title: title.trim(),
        subject: subjectId,
        question_text: questionText.trim(),
        image_url: imageUrl.trim() || null,
      });

      setFeedback({
        type: 'success',
        message: 'Your doubt has been submitted. Our JEE faculty will review and post a solution soon.',
      });
      setTitle('');
      setQuestionText('');
      setImageUrl('');
      loadData();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to submit doubt. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-brand-400" />
          <span>JEE 24/7 Doubt Resolution</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Ask physics, chemistry, or mathematics questions and receive verified step-by-step solutions from faculty educators.
        </p>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between gap-3 text-sm border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {feedback.message}
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100 uppercase tracking-wider"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Doubt Submission Form */}
      <Card className="p-6 bg-slate-900/60 border-slate-800 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider">
            <Sparkles className="w-4 h-4" />
            <span>Ask a New Doubt</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Question Title / Concept *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Confusion with Conservation of Angular Momentum in rolling problem"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Subject *
              </label>
              <select
                required
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500"
              >
                {(subjects || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Detailed Description & Where You Are Stuck *
            </label>
            <textarea
              rows={4}
              required
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Paste problem text, state given values, or describe what you tried and where your approach diverges..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 resize-none leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Problem Screenshot or Diagram URL (Optional)
            </label>
            <input
              type="text"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://... image link or diagram URL"
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
            <span className="text-xs text-slate-500 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
              Verified faculty responses directly posted to your dashboard
            </span>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-brand-500 hover:bg-brand-600 text-white gap-2 font-medium"
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>Submit Question</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* Previous Doubts List */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          <span>Your Submitted Doubts</span>
          <span className="text-xs text-slate-400 font-normal">({doubts?.length || 0})</span>
        </h2>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-brand-400" />
            <span className="text-xs">Loading your doubt history...</span>
          </div>
        ) : (doubts?.length || 0) === 0 ? (
          <Card className="p-8 text-center bg-slate-900/40 border-slate-800">
            <p className="text-sm font-medium text-slate-300">You haven&apos;t asked any doubts yet</p>
            <p className="text-xs text-slate-500 mt-1">
              Submit your first physics, chemistry, or math question above.
            </p>
          </Card>
        ) : (
          <div className="space-y-4">
            {(doubts || []).map((d) => (
              <Card key={d.id} className="p-5 bg-slate-900/50 border-slate-800 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      className={
                        d.status === 'RESOLVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }
                    >
                      {d.status === 'RESOLVED' ? 'Solved by Faculty' : 'Under Review'}
                    </Badge>
                    {d.subject_name && (
                      <Badge variant="outline" className="border-slate-700 bg-slate-800/40 text-slate-300 text-xs">
                        {d.subject_name}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(d.created_at).toLocaleString('en-IN', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-semibold text-slate-100">{d.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 whitespace-pre-wrap leading-relaxed">
                    {d.question_text}
                  </p>
                </div>

                {d.image_url && (
                  <div>
                    <a
                      href={d.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 underline"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      View Attached Screenshot
                    </a>
                  </div>
                )}

                {/* Faculty Reply */}
                {d.reply_text ? (
                  <div className="mt-3 p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/30 text-xs sm:text-sm text-emerald-300 space-y-1.5">
                    <div className="font-semibold text-emerald-200 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      Faculty Solution from {d.replied_by_name || 'Admin'}
                    </div>
                    <p className="text-slate-200 whitespace-pre-wrap leading-relaxed font-sans text-xs sm:text-sm">
                      {d.reply_text}
                    </p>
                    {d.replied_at && (
                      <div className="text-[10px] text-emerald-500/80 pt-1">
                        Answered on {new Date(d.replied_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-500 italic bg-slate-950/60 p-3 rounded-lg border border-slate-800">
                    A faculty instructor is reviewing this doubt. Solution will appear here once answered.
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
