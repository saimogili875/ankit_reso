'use client';

import React, { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Clock,
  Plus,
  Edit2,
  Trash2,
  CheckCircle,
  AlertCircle,
  Loader2,
  CheckSquare,
  Square,
} from 'lucide-react';

interface QuestionItem {
  id: string;
  question_text: string;
  question_type: string;
  difficulty: string;
  subject_name?: string;
  chapter_name?: string;
}

interface TestItem {
  id: string;
  title: string;
  description: string;
  test_type: 'FULL' | 'CHAPTER' | 'SUBJECT';
  duration_minutes: number;
  total_marks: number;
  is_published: boolean;
  exam?: string;
  exam_name?: string;
  questions_count: number;
  attempts_count: number;
  test_questions?: Array<{ question: string }>;
}

export default function AdminTestsPage() {
  const [tests, setTests] = useState<TestItem[]>([]);
  const [allQuestions, setAllQuestions] = useState<QuestionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingTest, setEditingTest] = useState<Partial<TestItem> | null>(null);
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);

  const fetchTests = async () => {
    setIsLoading(true);
    try {
      const [tRes, qRes] = await Promise.all([
        apiClient.get<TestItem[]>('/admin-panel/tests/'),
        apiClient.get<{ results?: QuestionItem[] } | QuestionItem[]>('/admin-panel/questions/'),
      ]);
      setTests(Array.isArray(tRes) ? tRes : []);
      const qList = Array.isArray(qRes) ? qRes : qRes.results || [];
      setAllQuestions(qList);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch tests';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTests();
  }, []);

  const handleOpenCreate = () => {
    setEditingTest({
      title: '',
      description: '',
      test_type: 'FULL',
      duration_minutes: 180,
      total_marks: 300,
      is_published: true,
    });
    setSelectedQuestionIds([]);
    setIsModalOpen(true);
  };

  const handleOpenEdit = async (test: TestItem) => {
    try {
      const detail = await apiClient.get<TestItem>(`/admin-panel/tests/${test.id}/`);
      setEditingTest(detail);
      const qIds = (detail.test_questions || []).map((tq) => String(tq.question));
      setSelectedQuestionIds(qIds);
      setIsModalOpen(true);
    } catch {
      setEditingTest(test);
      setSelectedQuestionIds([]);
      setIsModalOpen(true);
    }
  };

  const toggleQuestionSelect = (qId: string) => {
    setSelectedQuestionIds((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const handleSaveTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTest) return;
    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        ...editingTest,
        question_ids: selectedQuestionIds,
      };

      if (editingTest.id) {
        await apiClient.put(`/admin-panel/tests/${editingTest.id}/`, payload);
        setFeedback({ type: 'success', message: 'Test updated successfully!' });
      } else {
        await apiClient.post('/admin-panel/tests/', payload);
        setFeedback({ type: 'success', message: 'New CBT Mock Test created successfully!' });
      }
      setIsModalOpen(false);
      setEditingTest(null);
      fetchTests();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this mock test? Student attempts on it may be deleted.')) return;
    try {
      await apiClient.delete(`/admin-panel/tests/${id}/`);
      setFeedback({ type: 'success', message: 'Test deleted successfully.' });
      fetchTests();
    } catch (err: unknown) {
      setFeedback({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Clock className="w-6 h-6 text-indigo-400" />
            <span>CBT Mock Tests & PYQs</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Build timed Computer-Based Test (CBT) papers with question mappings and instant student grading
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          onClick={handleOpenCreate}
          className="gap-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-600/20"
        >
          <Plus className="w-4 h-4" />
          <span>Create Mock Test</span>
        </Button>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs flex items-center justify-between border ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{feedback.message}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="hover:opacity-75">
            ✕
          </button>
        </div>
      )}

      {/* Test List */}
      {isLoading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
        </div>
      ) : tests.length === 0 ? (
        <Card className="p-12 text-center space-y-3 bg-slate-900 border-slate-800">
          <Clock className="w-12 h-12 text-slate-500 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No Mock Tests Created Yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Click &quot;Create Mock Test&quot; above to schedule full syllabus tests or chapter tests for students.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map((test) => (
            <Card key={test.id} className="p-5 bg-slate-900 border-slate-800 space-y-4 hover:border-slate-700">
              <div className="flex items-start justify-between">
                <Badge variant={test.is_published ? 'blue' : 'slate'}>
                  {test.is_published ? 'Published to Students' : 'Draft'}
                </Badge>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(test)}
                    className="p-1.5 h-auto border-slate-700"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-300" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDeleteTest(test.id)}
                    className="p-1.5 h-auto border-rose-950 text-rose-400 hover:bg-rose-950/30"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              <div>
                <span className="text-[10px] font-bold font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900">
                  {test.test_type} • {test.duration_minutes} Mins
                </span>
                <h3 className="font-extrabold text-base text-white mt-1.5">{test.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{test.description || 'NTA CBT formatted paper'}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs">
                <div>
                  <div className="text-[10px] text-slate-500">Marks</div>
                  <div className="font-bold text-white">{test.total_marks}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Questions</div>
                  <div className="font-bold text-indigo-400">{test.questions_count}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-500">Attempts</div>
                  <div className="font-bold text-emerald-400">{test.attempts_count}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {isModalOpen && editingTest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 bg-slate-900 border-slate-800 space-y-5">
            <h3 className="text-lg font-bold text-white">
              {editingTest.id ? 'Edit CBT Mock Test' : 'Create New CBT Mock Test'}
            </h3>

            <form onSubmit={handleSaveTest} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400">Test Title</label>
                <input
                  type="text"
                  required
                  value={editingTest.title || ''}
                  onChange={(e) => setEditingTest({ ...editingTest, title: e.target.value })}
                  placeholder="e.g. JEE Main 2025 Full Syllabus Mock #01"
                  className="w-full mt-1 p-2.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={editingTest.description || ''}
                  onChange={(e) => setEditingTest({ ...editingTest, description: e.target.value })}
                  className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-400">Pattern Type</label>
                  <select
                    value={editingTest.test_type || 'FULL'}
                    onChange={(e) => setEditingTest({ ...editingTest, test_type: e.target.value as TestItem['test_type'] })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  >
                    <option value="FULL">Full Length (Mock)</option>
                    <option value="CHAPTER">Chapter Wise</option>
                    <option value="SUBJECT">Subject Wise</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">Duration (Minutes)</label>
                  <input
                    type="number"
                    value={editingTest.duration_minutes ?? 180}
                    onChange={(e) => setEditingTest({ ...editingTest, duration_minutes: parseInt(e.target.value, 10) || 180 })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-400">Total Marks</label>
                  <input
                    type="number"
                    value={editingTest.total_marks ?? 300}
                    onChange={(e) => setEditingTest({ ...editingTest, total_marks: parseInt(e.target.value, 10) || 300 })}
                    className="w-full mt-1 p-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white"
                  />
                </div>
              </div>

              {/* Question Picker */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-300">
                    Pick Questions ({selectedQuestionIds.length} Selected)
                  </label>
                  <span className="text-[11px] text-indigo-400 font-mono">
                    {allQuestions.length} Total in Bank
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-1.5 p-2 bg-slate-950 rounded-xl border border-slate-800">
                  {allQuestions.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-500">
                      No questions in bank. Add questions in Question Bank first.
                    </div>
                  ) : (
                    allQuestions.map((q) => {
                      const isChecked = selectedQuestionIds.includes(q.id);
                      return (
                        <div
                          key={q.id}
                          onClick={() => toggleQuestionSelect(q.id)}
                          className={`p-2.5 rounded-lg border text-xs cursor-pointer flex items-start gap-2.5 transition-colors ${
                            isChecked
                              ? 'border-indigo-600 bg-indigo-950/30 text-white'
                              : 'border-slate-800/80 bg-slate-900/50 hover:bg-slate-900 text-slate-300'
                          }`}
                        >
                          <div className="pt-0.5 shrink-0">
                            {isChecked ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600" />
                            )}
                          </div>
                          <div className="space-y-1">
                            <p className="line-clamp-2 leading-relaxed">{q.question_text}</p>
                            <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                              <span>{q.question_type}</span>
                              <span>•</span>
                              <span>{q.difficulty}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={Boolean(editingTest.is_published)}
                    onChange={(e) => setEditingTest({ ...editingTest, is_published: e.target.checked })}
                    className="w-4 h-4 rounded text-indigo-600"
                  />
                  <span>Publish to Student CBT Tests section immediately</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-800">
                <Button type="button" variant="outline" size="sm" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" size="sm" isLoading={isSaving} className="bg-indigo-600 font-bold">
                  Save Mock Test
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
