'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { 
  BookOpen, 
  Plus, 
  Edit3, 
  Upload, 
  FileText, 
  CheckCircle2, 
  X, 
  Loader2, 
  RefreshCw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { 
  PageHeader, 
  Notice, 
  useNotice, 
  Field, 
  Toggle, 
  Pill, 
  primaryBtn, 
  ghostBtn, 
  inputClass, 
  errMsg 
} from '@/components/admin/ui';
import { apiClient, ApiError } from '@/lib/api-client';

interface BookProductAdmin {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  cover_image: string;
  class_label: string;
  digital_price: number | string;
  hardcopy_price: number | string;
  gst_percent: number | string;
  pdf_key: string;
  is_published: boolean;
  display_order: number;
  stock_hardcopy: number | null;
  highlights: string[];
  badge: string;
  created_at: string;
  updated_at: string;
}

export default function AdminBooksPage() {
  const { notice, success, error, clear } = useNotice();
  const [books, setBooks] = useState<BookProductAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit/Create Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookProductAdmin | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [formSlug, setFormSlug] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formSubtitle, setFormSubtitle] = useState('');
  const [formClassLabel, setFormClassLabel] = useState('Class 10th');
  const [formDigitalPrice, setFormDigitalPrice] = useState('299.00');
  const [formHardcopyPrice, setFormHardcopyPrice] = useState('399.00');
  const [formGstPercent, setFormGstPercent] = useState('18.00');
  const [formBadge, setFormBadge] = useState('Bestseller');
  const [formStock, setFormStock] = useState('');
  const [formOrder, setFormOrder] = useState('0');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formHighlightsText, setFormHighlightsText] = useState('');

  // Media upload state
  const [uploadingCoverId, setUploadingCoverId] = useState<number | null>(null);
  const [uploadingPdfId, setUploadingPdfId] = useState<number | null>(null);
  const [unpublishCandidate, setUnpublishCandidate] = useState<BookProductAdmin | null>(null);

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiClient.get<BookProductAdmin[] | { results: BookProductAdmin[] }>('/api/admin/books/products/');
      const items = Array.isArray(data) ? data : (data.results || []);
      setBooks(items);
    } catch (err) {
      error(errMsg(err, 'Failed to load books catalog.'));
    } finally {
      setLoading(false);
    }
  }, [error]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  const openCreateModal = () => {
    setEditingBook(null);
    setFormSlug('');
    setFormTitle('');
    setFormSubtitle('');
    setFormClassLabel('Class 10th');
    setFormDigitalPrice('299.00');
    setFormHardcopyPrice('399.00');
    setFormGstPercent('18.00');
    setFormBadge('');
    setFormStock('');
    setFormOrder('0');
    setFormIsPublished(true);
    setFormHighlightsText('');
    setIsModalOpen(true);
  };

  const openEditModal = (book: BookProductAdmin) => {
    setEditingBook(book);
    setFormSlug(book.slug);
    setFormTitle(book.title);
    setFormSubtitle(book.subtitle || '');
    setFormClassLabel(book.class_label || 'Class 10th');
    setFormDigitalPrice(String(book.digital_price));
    setFormHardcopyPrice(String(book.hardcopy_price));
    setFormGstPercent(String(book.gst_percent || '18.00'));
    setFormBadge(book.badge || '');
    setFormStock(book.stock_hardcopy !== null ? String(book.stock_hardcopy) : '');
    setFormOrder(String(book.display_order || '0'));
    setFormIsPublished(book.is_published);
    setFormHighlightsText((book.highlights || []).join('\n'));
    setIsModalOpen(true);
  };

  const handleSaveBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      error('Title is required.');
      return;
    }

    const payload = {
      slug: formSlug.trim() || formTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      title: formTitle.trim(),
      subtitle: formSubtitle.trim(),
      class_label: formClassLabel.trim(),
      digital_price: parseFloat(formDigitalPrice) || 299.0,
      hardcopy_price: parseFloat(formHardcopyPrice) || 399.0,
      gst_percent: parseFloat(formGstPercent) || 18.0,
      badge: formBadge.trim(),
      stock_hardcopy: formStock.trim() ? parseInt(formStock, 10) : null,
      display_order: parseInt(formOrder, 10) || 0,
      is_published: formIsPublished,
      highlights: formHighlightsText.split('\n').map((s) => s.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (editingBook) {
        await apiClient.patch(`/api/admin/books/products/${editingBook.id}/`, payload);
        success(`Updated "${payload.title}".`);
      } else {
        await apiClient.post('/api/admin/books/products/', payload);
        success(`Created book "${payload.title}".`);
      }
      setIsModalOpen(false);
      fetchBooks();
    } catch (err) {
      error(errMsg(err, 'Failed to save book.'));
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (book: BookProductAdmin) => {
    try {
      await apiClient.patch(`/api/admin/books/products/${book.id}/`, {
        is_published: !book.is_published,
      });
      success(`"${book.title}" is now ${!book.is_published ? 'Published' : 'Hidden'}.`);
      setBooks((prev) =>
        prev.map((b) => (b.id === book.id ? { ...b, is_published: !b.is_published } : b))
      );
    } catch (err) {
      error(errMsg(err, 'Failed to update publication status.'));
    }
  };

  const handleCoverUpload = async (bookId: number, file: File) => {
    const formData = new FormData();
    formData.append('cover', file);
    setUploadingCoverId(bookId);
    try {
      await apiClient.post<{ message: string }>(`/api/admin/books/products/${bookId}/upload-cover/`, formData);
      success('Cover image uploaded and converted to WebP successfully!');
      fetchBooks();
    } catch (err) {
      error(errMsg(err, 'Failed to upload cover image.'));
    } finally {
      setUploadingCoverId(null);
    }
  };

  const handlePdfUpload = async (bookId: number, file: File) => {
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('auto_cover', 'true');
    setUploadingPdfId(bookId);
    try {
      await apiClient.post<{ message: string }>(`/api/admin/books/products/${bookId}/upload-pdf/`, formData);
      success('Private PDF uploaded to secure cloud storage!');
      fetchBooks();
    } catch (err) {
      error(errMsg(err, 'Failed to upload PDF.'));
    } finally {
      setUploadingPdfId(null);
    }
  };

  const handleDeleteBook = async (book: BookProductAdmin) => {
    if (!confirm(`Are you sure you want to delete "${book.title}"?`)) return;
    try {
      await apiClient.delete(`/api/admin/books/products/${book.id}/`);
      success(`Deleted "${book.title}".`);
      setUnpublishCandidate(null);
      fetchBooks();
    } catch (err: unknown) {
      const msg = errMsg(err, 'Failed to delete book.');
      error(msg);
      if (
        (err instanceof ApiError && (err.data as { action?: string })?.action === 'unpublish') ||
        msg.toLowerCase().includes('unpublish') ||
        msg.toLowerCase().includes('order')
      ) {
        setUnpublishCandidate(book);
      }
    }
  };

  return (
    <div className="space-y-6">
      <Notice notice={notice} onClose={clear} />

      {unpublishCandidate && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-800/60 bg-amber-950/40 p-4 text-amber-200 text-sm shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <p className="font-semibold text-white">Cannot delete &quot;{unpublishCandidate.title}&quot;</p>
              <p className="text-xs text-amber-300/80">This book has existing student orders. You can hide/unpublish it from the store catalog instead.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                await handleTogglePublish(unpublishCandidate);
                setUnpublishCandidate(null);
              }}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
            >
              {unpublishCandidate.is_published ? 'Unpublish Book' : 'Publish Book'}
            </button>
            <button
              type="button"
              onClick={() => setUnpublishCandidate(null)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <PageHeader
        icon={BookOpen}
        title="Books & Publications Catalog"
        description="Manage official books, digital PDFs, physical stock, prices and Cloudflare R2 files."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchBooks}
              disabled={loading}
              className={ghostBtn}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className={primaryBtn}
            >
              <Plus className="w-4 h-4" /> Add New Book
            </button>
          </div>
        }
      />

      {/* Books Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 overflow-hidden shadow-sm">
        {loading && books.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-500 mb-3" />
            <p className="text-sm">Loading publications...</p>
          </div>
        ) : books.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-3">
            <BookOpen className="w-12 h-12 mx-auto text-slate-600" />
            <h3 className="text-base font-bold text-white">No books in catalog</h3>
            <p className="text-xs max-w-sm mx-auto">Create a publication or run seed_books to populate the standard catalog.</p>
            <button type="button" onClick={openCreateModal} className={primaryBtn}>
              <Plus className="w-4 h-4" /> Create First Book
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950/70 border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3.5 px-4">Book Details</th>
                  <th className="py-3.5 px-4">Class</th>
                  <th className="py-3.5 px-4">Digital Price</th>
                  <th className="py-3.5 px-4">Hardcopy Price</th>
                  <th className="py-3.5 px-4">Cloud PDF</th>
                  <th className="py-3.5 px-4 text-center">Status</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {books.map((book) => (
                  <tr key={book.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Cover & Title */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-16 rounded-lg bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {book.cover_image ? (
                            <Image
                              src={book.cover_image}
                              alt={book.title}
                              fill
                              className="object-cover"
                              sizes="48px"
                            />
                          ) : (
                            <BookOpen className="w-5 h-5 text-slate-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white flex items-center gap-1.5">
                            <span>{book.title}</span>
                            {book.badge && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                {book.badge}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{book.slug}</div>
                        </div>
                      </div>
                    </td>

                    {/* Class */}
                    <td className="py-3.5 px-4 text-slate-300">
                      {book.class_label || '—'}
                    </td>

                    {/* Digital */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">₹{book.digital_price}</div>
                      <div className="text-[10px] text-slate-500">+{book.gst_percent}% GST</div>
                    </td>

                    {/* Hardcopy */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-white">₹{book.hardcopy_price}</div>
                      <div className="text-[10px] text-slate-500">
                        {book.stock_hardcopy !== null ? `${book.stock_hardcopy} in stock` : 'Unlimited print'}
                      </div>
                    </td>

                    {/* PDF Key */}
                    <td className="py-3.5 px-4">
                      {book.pdf_key ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> PDF Attached
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-rose-400">
                          Missing PDF
                        </span>
                      )}
                    </td>

                    {/* Published Toggle */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(book)}
                        className="inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pill tone={book.is_published ? 'green' : 'slate'}>
                          {book.is_published ? 'Published' : 'Draft'}
                        </Pill>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Cover Upload */}
                        <label
                          title="Upload new cover image"
                          className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                        >
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            disabled={uploadingCoverId === book.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleCoverUpload(book.id, file);
                            }}
                          />
                          {uploadingCoverId === book.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                        </label>

                        {/* PDF Upload */}
                        <label
                          title="Upload PDF file"
                          className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white cursor-pointer transition-colors"
                        >
                          <input
                            type="file"
                            accept="application/pdf"
                            className="hidden"
                            disabled={uploadingPdfId === book.id}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handlePdfUpload(book.id, file);
                            }}
                          />
                          {uploadingPdfId === book.id ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </label>

                        {/* Edit Details */}
                        <button
                          type="button"
                          onClick={() => openEditModal(book)}
                          title="Edit details"
                          className="p-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>

                        {/* Delete Book */}
                        <button
                          type="button"
                          onClick={() => handleDeleteBook(book)}
                          title="Delete book"
                          className="p-1.5 rounded-lg border border-slate-700 hover:bg-rose-950/40 hover:border-rose-800/80 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Edit / Create Book Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                {editingBook ? `Edit "${editingBook.title}"` : 'Create New Publication'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Title *">
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Advanced Question Bank"
                    className={inputClass}
                  />
                </Field>

                <Field label="URL Slug *">
                  <input
                    type="text"
                    value={formSlug}
                    onChange={(e) => setFormSlug(e.target.value)}
                    placeholder="e.g. adv-qb-10"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Subtitle">
                <input
                  type="text"
                  value={formSubtitle}
                  onChange={(e) => setFormSubtitle(e.target.value)}
                  placeholder="e.g. Comprehensive Board & Foundation Mastery"
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Class Label">
                  <input
                    type="text"
                    value={formClassLabel}
                    onChange={(e) => setFormClassLabel(e.target.value)}
                    placeholder="Class 10th"
                    className={inputClass}
                  />
                </Field>
                <Field label="Digital Price (₹)">
                  <input
                    type="number"
                    step="0.01"
                    value={formDigitalPrice}
                    onChange={(e) => setFormDigitalPrice(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Hardcopy Price (₹)">
                  <input
                    type="number"
                    step="0.01"
                    value={formHardcopyPrice}
                    onChange={(e) => setFormHardcopyPrice(e.target.value)}
                    className={inputClass}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="GST (%)">
                  <input
                    type="number"
                    step="0.01"
                    value={formGstPercent}
                    onChange={(e) => setFormGstPercent(e.target.value)}
                    className={inputClass}
                  />
                </Field>
                <Field label="Badge (e.g. Bestseller)">
                  <input
                    type="text"
                    value={formBadge}
                    onChange={(e) => setFormBadge(e.target.value)}
                    placeholder="Bestseller"
                    className={inputClass}
                  />
                </Field>
                <Field label="Hardcopy Stock">
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    placeholder="Blank = Unlimited"
                    className={inputClass}
                  />
                </Field>
              </div>

              <Field label="Key Highlights (one bullet point per line)">
                <textarea
                  rows={4}
                  value={formHighlightsText}
                  onChange={(e) => setFormHighlightsText(e.target.value)}
                  placeholder="1,200+ curated problems&#10;Step-by-step solutions by Ankit Sir&#10;10 years CBSE papers"
                  className={inputClass}
                />
              </Field>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <div className="flex items-center gap-3">
                  <Toggle
                    checked={formIsPublished}
                    onChange={setFormIsPublished}
                    label="Published"
                  />
                  <span className="text-xs text-slate-300 font-medium">
                    {formIsPublished ? 'Published on Website' : 'Draft / Hidden'}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className={ghostBtn}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className={primaryBtn}
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {editingBook ? 'Save Changes' : 'Create Book'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
