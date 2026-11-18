'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Loader2,
  Clock,
  User,
  Send,
  Trash2,
  Image as ImageIcon,
  CheckCircle2,
} from 'lucide-react';

interface DoubtItem {
  id: string;
  student: string;
  student_email: string;
  student_name: string;
  subject: number;
  subject_name?: string;
  title: string;
  question_text: string;
  image_url?: string | null;
  status: 'OPEN' | 'RESOLVED';
  reply_text?: string | null;
  replied_by?: string | null;
  replied_by_name?: string | null;
  replied_at?: string | null;
  created_at: string;
}

export default function AdminDoubtsPage() {
  const [doubts, setDoubts] = useState<DoubtItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('ALL');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Reply Modal
  const [activeDoubt, setActiveDoubt] = useState<DoubtItem | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const fetchDoubts = async () => {
    setIsLoading(true);
    try {
      const data = await apiClient.get<DoubtItem[]>('/admin-panel/doubts/');
      setDoubts(data || []);
    } catch {
      setFeedback({ type: 'error', message: 'Failed to load doubts.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDoubts();
  }, []);

  const openReplyModal = (doubt: DoubtItem) => {
    setActiveDoubt(doubt);
    setReplyText(doubt.reply_text || '');
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDoubt) return;
    if (!replyText.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a reply before submitting.' });
      return;
    }

    setIsSubmittingReply(true);
    try {
      await apiClient.post(`/admin-panel/doubts/${activeDoubt.id}/reply/`, {
        reply_text: replyText.trim(),
      });
      setFeedback({ type: 'success', message: 'Reply sent and doubt marked resolved!' });
      setActiveDoubt(null);
      fetchDoubts();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to send reply.' });
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this doubt ticket?')) return;
    try {
      await apiClient.delete(`/admin-panel/doubts/${id}/`);
      setFeedback({ type: 'success', message: 'Doubt deleted successfully.' });
      fetchDoubts();
    } catch {
      setFeedback({ type: 'error', message: 'Failed to delete doubt.' });
    }
  };

  const filteredDoubts = doubts.filter((d) => {
    if (statusFilter === 'ALL') return true;
    return d.status === statusFilter;
  });

  const openCount = doubts.filter((d) => d.status === 'OPEN').length;
  const resolvedCount = doubts.filter((d) => d.status === 'RESOLVED').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100 flex items-center gap-2">
            <MessageSquare className="w-6 h-6 text-brand-400" />
            Doubt Solver Support Desk
          </h1>
          <p className="text-sm text-slate-400">
            Review and resolve academic doubts submitted by enrolled JEE students.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20 px-3 py-1 text-xs">
            {openCount} Open
          </Badge>
          <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3 py-1 text-xs">
            {resolvedCount} Resolved
          </Badge>
        </div>
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

      {/* Tabs */}
      <div className="flex border-b border-slate-800 gap-4">
        <button
          onClick={() => setStatusFilter('ALL')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'ALL'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          All Tickets ({doubts.length})
        </button>
        <button
          onClick={() => setStatusFilter('OPEN')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'OPEN'
              ? 'border-amber-500 text-amber-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Open Doubts ({openCount})
        </button>
        <button
          onClick={() => setStatusFilter('RESOLVED')}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            statusFilter === 'RESOLVED'
              ? 'border-emerald-500 text-emerald-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          Resolved ({resolvedCount})
        </button>
      </div>

      {/* List */}
      <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <p className="text-sm">Loading doubts...</p>
          </div>
        ) : filteredDoubts.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30 text-emerald-400" />
            <p className="text-base font-medium text-slate-300">No doubts in this queue</p>
            <p className="text-sm text-slate-500 mt-1">
              All student doubts have been reviewed and answered.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredDoubts.map((d) => (
              <div
                key={d.id}
                className="p-5 hover:bg-slate-800/20 transition-colors flex flex-col md:flex-row md:items-start justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={
                        d.status === 'RESOLVED'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }
                    >
                      {d.status}
                    </Badge>
                    {d.subject_name && (
                      <Badge variant="outline" className="border-slate-700 bg-slate-800/40 text-slate-300">
                        {d.subject_name}
                      </Badge>
                    )}
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(d.created_at).toLocaleString('en-IN', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>

                  <h3 className="text-base font-semibold text-slate-100">{d.title}</h3>
                  <p className="text-sm text-slate-300 whitespace-pre-wrap">{d.question_text}</p>

                  {d.image_url && (
                    <div className="pt-1">
                      <a
                        href={d.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-brand-400 hover:text-brand-300 underline"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        View Attached Problem Screenshot
                      </a>
                    </div>
                  )}

                  <div className="text-xs text-slate-400 flex items-center gap-1 pt-1">
                    <User className="w-3.5 h-3.5 text-slate-500" />
                    <span>Submitted by</span>
                    <span className="text-slate-200 font-medium">{d.student_name}</span>
                    <span className="text-slate-500 font-mono">({d.student_email})</span>
                  </div>

                  {d.reply_text && (
                    <div className="mt-3 p-3 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-xs text-emerald-300">
                      <div className="font-semibold text-emerald-200 flex items-center gap-1 mb-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                        Faculty Reply by {d.replied_by_name || 'Admin'}
                      </div>
                      <p className="text-slate-300 whitespace-pre-wrap">{d.reply_text}</p>
                    </div>
                  )}
                </div>

                <div className="flex md:flex-col items-center gap-2 shrink-0">
                  <Button
                    onClick={() => openReplyModal(d)}
                    className="bg-brand-500 hover:bg-brand-600 text-white text-xs h-9 px-4"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    {d.status === 'RESOLVED' ? 'Edit Reply' : 'Answer Doubt'}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(d.id)}
                    className="h-9 w-9 p-0 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Reply Modal */}
      {activeDoubt && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-brand-400" />
                  Answer Student Doubt
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Replying will notify the student and mark the query as Resolved.
                </p>
              </div>
              <button
                onClick={() => setActiveDoubt(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendReply} className="p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-4 rounded-lg bg-slate-950 border border-slate-800">
                <div className="text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
                  {activeDoubt.subject_name || 'Academics'} • Student Question
                </div>
                <h4 className="text-sm font-semibold text-slate-100 mb-1">{activeDoubt.title}</h4>
                <p className="text-xs text-slate-300 whitespace-pre-wrap">{activeDoubt.question_text}</p>
                {activeDoubt.image_url && (
                  <div className="mt-2">
                    <img
                      src={activeDoubt.image_url}
                      alt="Student question attachment"
                      className="max-h-60 rounded border border-slate-800 object-contain"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Faculty Answer & Step-by-Step Solution *
                </label>
                <textarea
                  rows={6}
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Explain the concept clearly, write out equations, or provide solving steps..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-sm text-slate-100 focus:outline-none focus:border-brand-500 leading-relaxed font-sans"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setActiveDoubt(null)}
                  className="border-slate-800 text-slate-300"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmittingReply}
                  className="bg-brand-500 hover:bg-brand-600 text-white"
                >
                  {isSubmittingReply && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Submit Solution
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
