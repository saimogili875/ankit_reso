'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart2,
  Download,
  AlertTriangle,
  Users,
  FileText,
  Sliders,
  Plus,
  Trash2,
  ExternalLink,
  X,
  Target,
} from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import { API_BASE } from '@/lib/config';
import { LoadingState } from '@/components/ui/loading-state';
import { ErrorState } from '@/components/ui/error-state';

interface TestSummaryItem {
  id: string;
  title: string;
  test_type: string;
  total_marks: number;
  duration_minutes: number;
  cutoff_score: number;
  is_published: boolean;
  publish_results_immediately: boolean;
  start_time?: string | null;
  end_time?: string | null;
  attempts_count: number;
  highest_score?: number | null;
  lowest_score?: number | null;
  avg_score?: number | null;
  avg_time_seconds?: number | null;
  pass_count: number;
  pass_percentage: number;
}

interface QuestionStat {
  question_id: string;
  order: number;
  question_text: string;
  difficulty: string;
  subject_name: string;
  chapter_name: string;
  positive_marks: number;
  negative_marks: number;
  total_attempts: number;
  correct_count: number;
  accuracy: number;
  avg_time_seconds: number;
  most_common_wrong_pick?: string | null;
  is_flagged_anomaly: boolean;
}

interface StudentRosterItem {
  attempt_id: string;
  student_id: string;
  student_name: string;
  student_email: string;
  score: number;
  total_marks: number;
  rank?: number | null;
  percentile?: number | null;
  accuracy: number;
  time_taken_seconds: number;
  status: string;
  submitted_at?: string;
}

interface TestDetailAnalytics {
  test: {
    id: string;
    title: string;
    test_type: string;
    total_marks: number;
    duration_minutes: number;
    cutoff_score: number;
    is_published: boolean;
    publish_results_immediately: boolean;
  };
  overview: {
    attempts_count: number;
    highest_score?: number | null;
    lowest_score?: number | null;
    avg_score?: number | null;
    avg_time_seconds?: number | null;
    pass_count: number;
    pass_percentage: number;
  };
  question_stats: QuestionStat[];
  toughest_questions: QuestionStat[];
  easiest_questions: QuestionStat[];
  batch_weak_chapters: Array<{
    chapter_id: string;
    chapter_name: string;
    subject_name: string;
    total_questions: number;
    correct_count: number;
    accuracy: number;
  }>;
  student_roster: StudentRosterItem[];
}

interface RankPredictorBand {
  id?: string;
  exam_type: string;
  min_marks: number;
  max_marks: number;
  predicted_rank_min: number;
  predicted_rank_max: number;
  percentile_min?: number | null;
  percentile_max?: number | null;
  notes?: string;
}

export default function AdminTestAnalyticsPage() {
  const [tests, setTests] = useState<TestSummaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Detail Modal
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<TestDetailAnalytics | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Predictor Calibration Modal
  const [isPredictorModalOpen, setIsPredictorModalOpen] = useState(false);
  const [predictorBands, setPredictorBands] = useState<RankPredictorBand[]>([]);
  const [isSavingBand, setIsSavingBand] = useState(false);
  const [bandForm, setBandForm] = useState<RankPredictorBand>({
    exam_type: 'JEE_MAIN',
    min_marks: 150,
    max_marks: 189,
    predicted_rank_min: 5000,
    predicted_rank_max: 15000,
    percentile_min: 96.5,
    percentile_max: 98.5,
    notes: 'JEE Advanced qualifying range',
  });

  const loadTests = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get<TestSummaryItem[]>('/admin-panel/test-analytics/');
      setTests(asList<TestSummaryItem>(data));
    } catch (err: unknown) {
      console.error('[Admin Test Analytics loadTests error]', err);
      const msg = err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to load test analytics.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  const openDetailModal = async (testId: string) => {
    setSelectedTestId(testId);
    setIsLoadingDetail(true);
    try {
      const res = await apiClient.get<TestDetailAnalytics>(`/admin-panel/test-analytics/${testId}/`);
      setDetailData(res);
    } catch (err: unknown) {
      console.error('[openDetailModal error]', err);
      alert(err instanceof Error ? err.message : 'Failed to load test details.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const loadPredictorBands = async () => {
    try {
      const res = await apiClient.get<RankPredictorBand[]>('/admin-panel/rank-predictor/');
      setPredictorBands(asList<RankPredictorBand>(res));
    } catch (err: unknown) {
      console.error('[loadPredictorBands error]', err);
      alert(err instanceof Error ? err.message : 'Failed to load rank predictor table.');
    }
  };

  const handleCreateBand = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBand(true);
    try {
      await apiClient.post('/admin-panel/rank-predictor/', bandForm);
      await loadPredictorBands();
      setBandForm({
        exam_type: 'JEE_MAIN',
        min_marks: 100,
        max_marks: 139,
        predicted_rank_min: 20000,
        predicted_rank_max: 45000,
        percentile_min: 90.0,
        percentile_max: 94.0,
        notes: '',
      });
    } catch {
      alert('Failed to save calibration band.');
    } finally {
      setIsSavingBand(false);
    }
  };

  const handleDeleteBand = async (id?: string) => {
    if (!id || !confirm('Delete this calibration band?')) return;
    try {
      await apiClient.delete(`/admin-panel/rank-predictor/${id}/`);
      await loadPredictorBands();
    } catch {
      alert('Failed to delete calibration band.');
    }
  };

  const handleExportCSV = (testId: string) => {
    window.open(`${API_BASE}/admin-panel/test-analytics/${testId}/export/`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-purple-950/60 border border-purple-900/60 text-purple-400">
              <BarChart2 className="w-5 h-5" />
            </span>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-100 tracking-tight">
              Test Series Analytics & Distractor Evaluation
            </h1>
          </div>
          <p className="text-xs text-slate-400">
            Batch performance, distractor analysis, question difficulty calibration, and score curves.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsPredictorModalOpen(true);
            loadPredictorBands();
          }}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-500 text-white flex items-center gap-2 shadow-md shadow-purple-600/20 transition-colors shrink-0"
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Rank Predictor Calibration</span>
        </button>
      </div>

      {/* Tests Analytics Table */}
      {isLoading ? (
        <LoadingState message="Loading test analytics from database..." />
      ) : error ? (
        <ErrorState title="Error" message={error} onRetry={loadTests} />
      ) : tests.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <FileText className="w-10 h-10 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No test papers created yet</h3>
          <p className="text-xs text-slate-400">Create a test in CBT Mock Tests to view batch analytics.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-slate-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-4 font-semibold">Test Paper</th>
                <th className="p-4 font-semibold text-center">Attempts</th>
                <th className="p-4 font-semibold text-center">Average Score</th>
                <th className="p-4 font-semibold text-center">Highest / Lowest</th>
                <th className="p-4 font-semibold text-center">Pass Rate (Cutoff)</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-200">
              {tests.map((t) => (
                <tr key={t.id} className="hover:bg-slate-800/40">
                  <td className="p-4">
                    <div className="font-bold text-slate-100 text-sm line-clamp-1">{t.title}</div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
                      <span className="uppercase">{t.test_type}</span>
                      <span>•</span>
                      <span>{t.duration_minutes}m</span>
                      <span>•</span>
                      <span>{t.total_marks} Marks</span>
                    </div>
                  </td>

                  <td className="p-4 text-center font-bold text-purple-400">
                    {t.attempts_count} students
                  </td>

                  <td className="p-4 text-center font-extrabold text-blue-400">
                    {t.avg_score !== null ? `${t.avg_score} / ${t.total_marks}` : '—'}
                  </td>

                  <td className="p-4 text-center font-mono">
                    <span className="text-emerald-400 font-bold">{t.highest_score ?? '—'}</span> /{' '}
                    <span className="text-rose-400">{t.lowest_score ?? '—'}</span>
                  </td>

                  <td className="p-4 text-center">
                    <div className="font-bold text-slate-200">{t.pass_percentage}%</div>
                    <span className="text-[10px] text-slate-500 font-mono">Cutoff: {t.cutoff_score}</span>
                  </td>

                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDetailModal(t.id)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-800 font-bold text-xs transition-colors"
                      >
                        Inspect Analytics
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportCSV(t.id)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
                        title="Export CSV"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* DETAIL MODAL: QUESTION-WISE STATS & ROSTER */}
      {selectedTestId && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">
                  {detailData?.test.title || 'Test Analytics Inspection'}
                </h3>
                <span className="text-xs text-slate-400">
                  Comprehensive distractor breakdown, topper anomaly detection, and student roster.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleExportCSV(selectedTestId)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-800 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTestId(null)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {isLoadingDetail ? (
                <LoadingState message="Aggregating distractor metrics..." />
              ) : !detailData ? (
                <p className="text-xs text-slate-400">No data available.</p>
              ) : (
                <>
                  {/* Overview Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase">Total Submissions</span>
                      <span className="text-xl font-bold text-purple-400">{detailData.overview.attempts_count}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase">Class Average</span>
                      <span className="text-xl font-bold text-blue-400">{detailData.overview.avg_score ?? '—'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase">Topper Score</span>
                      <span className="text-xl font-bold text-emerald-400">{detailData.overview.highest_score ?? '—'}</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center">
                      <span className="text-[10px] text-slate-400 block uppercase">Cutoff Cleared</span>
                      <span className="text-xl font-bold text-amber-400">{detailData.overview.pass_percentage}%</span>
                    </div>
                  </div>

                  {/* Question-Wise Performance & Distractor Table */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-400" />
                      Question-Wise Accuracy & Distractor Analysis
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-3">#</th>
                            <th className="p-3">Question Snippet</th>
                            <th className="p-3 text-center">Accuracy</th>
                            <th className="p-3 text-center">Avg Time</th>
                            <th className="p-3">Most Common Wrong Pick (Distractor)</th>
                            <th className="p-3 text-center">Anomaly Flag</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {detailData.question_stats.map((qs) => (
                            <tr key={qs.question_id} className="hover:bg-slate-900/40">
                              <td className="p-3 font-bold text-slate-400">{qs.order}</td>
                              <td className="p-3 max-w-xs truncate font-medium text-slate-200">
                                {qs.question_text}
                              </td>
                              <td className="p-3 text-center font-bold font-mono">
                                <span className={qs.accuracy >= 60 ? 'text-emerald-400' : qs.accuracy >= 30 ? 'text-amber-400' : 'text-rose-400'}>
                                  {qs.accuracy}%
                                </span>
                              </td>
                              <td className="p-3 text-center font-mono text-slate-400">{qs.avg_time_seconds}s</td>
                              <td className="p-3 text-xs text-rose-300">
                                {qs.most_common_wrong_pick || '—'}
                              </td>
                              <td className="p-3 text-center">
                                {qs.is_flagged_anomaly ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center justify-center gap-1 mx-auto w-fit">
                                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                                    Review
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-slate-500 font-mono">Normal</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Student Submissions Roster */}
                  <div className="space-y-3 pt-3">
                    <h4 className="text-sm font-bold text-slate-200 flex items-center gap-2">
                      <Users className="w-4 h-4 text-purple-400" />
                      Student Submission Roster ({detailData.student_roster.length})
                    </h4>

                    <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                          <tr>
                            <th className="p-3">Rank</th>
                            <th className="p-3">Student Name & Email</th>
                            <th className="p-3 text-center">Score / Max</th>
                            <th className="p-3 text-center">Accuracy</th>
                            <th className="p-3 text-center">Time Taken</th>
                            <th className="p-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-slate-300">
                          {detailData.student_roster.map((st) => (
                            <tr key={st.attempt_id} className="hover:bg-slate-900/40">
                              <td className="p-3 font-extrabold text-purple-400 font-mono">
                                {st.rank ? `#${st.rank}` : '—'}
                              </td>
                              <td className="p-3">
                                <div className="font-bold text-slate-100">{st.student_name}</div>
                                <span className="text-[10px] text-slate-400 font-mono">{st.student_email}</span>
                              </td>
                              <td className="p-3 text-center font-bold text-blue-400">
                                {st.score} / {st.total_marks}
                              </td>
                              <td className="p-3 text-center font-bold text-amber-400 font-mono">
                                {st.accuracy}%
                              </td>
                              <td className="p-3 text-center font-mono text-slate-400">
                                {Math.floor(st.time_taken_seconds / 60)}m {st.time_taken_seconds % 60}s
                              </td>
                              <td className="p-3 text-right">
                                <Link
                                  href={`/tests/${st.attempt_id}/result`}
                                  target="_blank"
                                  className="text-blue-400 hover:text-blue-300 underline font-semibold inline-flex items-center gap-1"
                                >
                                  <span>View Report</span>
                                  <ExternalLink className="w-3 h-3" />
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* RANK PREDICTOR CALIBRATION MODAL */}
      {isPredictorModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div>
                <h3 className="text-base font-extrabold text-slate-100">
                  Rank Predictor Calibration Table
                </h3>
                <p className="text-xs text-slate-400">
                  Configure real marks-to-rank bands for student All India Rank forecasting.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsPredictorModalOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Add Band Form */}
              <form onSubmit={handleCreateBand} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <span className="text-xs font-bold text-slate-200 block">Add New Score Band</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Min Marks *</label>
                    <input
                      type="number"
                      required
                      value={bandForm.min_marks}
                      onChange={(e) => setBandForm({ ...bandForm, min_marks: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Max Marks *</label>
                    <input
                      type="number"
                      required
                      value={bandForm.max_marks}
                      onChange={(e) => setBandForm({ ...bandForm, max_marks: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Rank Min *</label>
                    <input
                      type="number"
                      required
                      value={bandForm.predicted_rank_min}
                      onChange={(e) => setBandForm({ ...bandForm, predicted_rank_min: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Rank Max *</label>
                    <input
                      type="number"
                      required
                      value={bandForm.predicted_rank_max}
                      onChange={(e) => setBandForm({ ...bandForm, predicted_rank_max: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end pt-1">
                  <button
                    type="submit"
                    disabled={isSavingBand}
                    className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Calibration Band
                  </button>
                </div>
              </form>

              {/* Existing Bands Table */}
              <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="p-3">Marks Range</th>
                      <th className="p-3">Predicted Rank</th>
                      <th className="p-3">Percentile Band</th>
                      <th className="p-3">Notes</th>
                      <th className="p-3 text-right">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300 font-mono">
                    {predictorBands.map((b) => (
                      <tr key={b.id} className="hover:bg-slate-900/40">
                        <td className="p-3 font-bold text-blue-400">
                          {b.min_marks} – {b.max_marks}
                        </td>
                        <td className="p-3 font-bold text-purple-400">
                          {b.predicted_rank_min?.toLocaleString()} – {b.predicted_rank_max?.toLocaleString()}
                        </td>
                        <td className="p-3 text-emerald-400">
                          {b.percentile_min ? `${b.percentile_min}% – ${b.percentile_max}%` : '—'}
                        </td>
                        <td className="p-3 text-[11px] text-slate-400 max-w-xs truncate font-sans">
                          {b.notes || '—'}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteBand(b.id)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-950/40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
