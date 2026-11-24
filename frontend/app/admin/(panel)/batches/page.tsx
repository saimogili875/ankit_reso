'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import {
  Layers,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  ListPlus,
  Sparkles,
  X,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { asList } from '@/lib/api-utils';
import {
  PageHeader,
  Field,
  Pill,
  Toggle,
  Notice,
  useNotice,
  Modal,
  LoadingBlock,
  EmptyState,
  inputClass,
  primaryBtn,
  ghostBtn,
  tableWrap,
  th,
  td,
} from '@/components/admin/ui';

interface BatchItemData {
  id?: string;
  item_type: string;
  title: string;
  price: string | number;
  is_addon: boolean;
}

interface BatchFeatureData {
  id?: string;
  text: string;
  order: number;
}

interface BatchAdminItem {
  id: string;
  card: string;
  card_key?: string;
  name: string;
  slug: string;
  academic_class?: string | null;
  academic_class_name?: string;
  tagline: string;
  description: string;
  image: string;
  price: string | number;
  original_price?: string | number | null;
  display_order: number;
  is_published: boolean;
  items?: BatchItemData[];
  features?: BatchFeatureData[];
}

interface CardOption {
  id: string;
  title: string;
  key: string;
}

interface ClassOption {
  id: string;
  name: string;
  code: string;
}

const ITEM_TYPES = [
  { value: 'MODULE', label: 'Complete Module' },
  { value: 'SP', label: 'Subject Practice (SP)' },
  { value: 'PP', label: 'Problem Practice (PP)' },
  { value: 'PYQ', label: 'Previous Years Questions (PYQ)' },
  { value: 'MENTAL_ABILITY', label: 'Mental Ability & Reasoning' },
  { value: 'OLYMPIAD', label: 'Olympiad Material' },
  { value: 'TEST_SERIES', label: 'Test Series' },
  { value: 'JEE_MAINS_TEST', label: 'JEE Mains Mock Tests' },
  { value: 'JEE_ADVANCED_TEST', label: 'JEE Advanced Mock Tests' },
  { value: 'SHORT_NOTES', label: 'Revision Short Notes' },
  { value: 'COACHING_TEST_SERIES', label: 'National Coaching Test Series' },
  { value: 'ADVANCED_BOOK_DIGITAL', label: 'Digital Advanced Problem Book' },
];

export default function AdminBatchesPage() {
  const [batches, setBatches] = useState<BatchAdminItem[]>([]);
  const [cardsList, setCardsList] = useState<CardOption[]>([]);
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { notice, success, error, clear } = useNotice();

  // Modals
  const [editingBatch, setEditingBatch] = useState<BatchAdminItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isItemsModalOpen, setIsItemsModalOpen] = useState(false);
  const [isFeaturesModalOpen, setIsFeaturesModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Edit Batch Form fields
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCardId, setFormCardId] = useState('');
  const [formClassId, setFormClassId] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPrice, setFormPrice] = useState('0');
  const [formOriginalPrice, setFormOriginalPrice] = useState('');
  const [formDisplayOrder, setFormDisplayOrder] = useState(0);
  const [formPublished, setFormPublished] = useState(true);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);

  // Items Editor State
  const [currentItems, setCurrentItems] = useState<BatchItemData[]>([]);

  // Features Editor State
  const [currentFeatures, setCurrentFeatures] = useState<string[]>([]);
  const [newFeatureText, setNewFeatureText] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [batchesRes, cardsRes, classesRes] = await Promise.all([
        apiClient.get<BatchAdminItem[]>('/admin-panel/batches/'),
        apiClient.get<CardOption[]>('/admin-panel/pricing-cards/'),
        apiClient.get<ClassOption[]>('/admin-panel/classes/'),
      ]);
      setBatches(asList(batchesRes));
      setCardsList(asList(cardsRes));
      setClassesList(asList(classesRes));
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to load batches data.');
    } finally {
      setIsLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Open Create/Edit Batch
  const handleOpenEdit = (batch?: BatchAdminItem) => {
    if (batch) {
      setEditingBatch(batch);
      setFormName(batch.name);
      setFormSlug(batch.slug);
      setFormCardId(batch.card);
      setFormClassId(batch.academic_class || '');
      setFormTagline(batch.tagline || '');
      setFormDesc(batch.description || '');
      setFormPrice(String(batch.price));
      setFormOriginalPrice(batch.original_price ? String(batch.original_price) : '');
      setFormDisplayOrder(batch.display_order || 0);
      setFormPublished(batch.is_published);
    } else {
      setEditingBatch(null);
      setFormName('');
      setFormSlug('');
      setFormCardId(cardsList[0]?.id || '');
      setFormClassId('');
      setFormTagline('');
      setFormDesc('');
      setFormPrice('2000');
      setFormOriginalPrice('4000');
      setFormDisplayOrder((batches.length + 1));
      setFormPublished(true);
    }
    setSelectedImageFile(null);
    setIsEditModalOpen(true);
  };

  const handleSaveBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim() || !formCardId) {
      error('Name, slug, and Category Card are required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: formName.trim(),
        slug: formSlug.trim().toLowerCase(),
        card: formCardId,
        academic_class: formClassId || null,
        tagline: formTagline.trim(),
        description: formDesc.trim(),
        price: Number(formPrice) || 0,
        original_price: formOriginalPrice ? Number(formOriginalPrice) : null,
        display_order: Number(formDisplayOrder) || 0,
        is_published: formPublished,
      };

      let savedId: string;
      if (editingBatch) {
        await apiClient.patch(`/admin-panel/batches/${editingBatch.id}/`, payload);
        savedId = editingBatch.id;
        success(`Updated "${formName}" successfully.`);
      } else {
        const created = await apiClient.post<{ id: string }>(`/admin-panel/batches/`, payload);
        savedId = created.id;
        success(`Created "${formName}" successfully.`);
      }

      // If image file selected, upload now
      if (selectedImageFile && savedId) {
        const formData = new FormData();
        formData.append('image', selectedImageFile);
        await apiClient.post(`/admin-panel/batches/${savedId}/upload-image/`, formData);
        success(`Image uploaded and optimized to WebP successfully.`);
      }

      setIsEditModalOpen(false);
      loadData();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to save batch.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Items Editor
  const handleOpenItems = (batch: BatchAdminItem) => {
    setEditingBatch(batch);
    setCurrentItems(batch.items ? JSON.parse(JSON.stringify(batch.items)) : []);
    setIsItemsModalOpen(true);
  };

  const handleAddItemRow = () => {
    setCurrentItems((prev) => [
      ...prev,
      { item_type: 'MODULE', title: 'New Curriculum Module', price: 500, is_addon: false },
    ]);
  };

  const handleRemoveItemRow = (idx: number) => {
    setCurrentItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveItems = async () => {
    if (!editingBatch) return;
    setIsSaving(true);
    try {
      await apiClient.post(`/admin-panel/batches/${editingBatch.id}/sync-items/`, {
        items: currentItems,
      });
      success(`Updated curriculum items for ${editingBatch.name}.`);
      setIsItemsModalOpen(false);
      loadData();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to save items.');
    } finally {
      setIsSaving(false);
    }
  };

  // Open Features Editor
  const handleOpenFeatures = (batch: BatchAdminItem) => {
    setEditingBatch(batch);
    const bullets = (batch.features || []).map((f) => f.text);
    setCurrentFeatures(bullets);
    setNewFeatureText('');
    setIsFeaturesModalOpen(true);
  };

  const handleAddFeature = () => {
    if (!newFeatureText.trim()) return;
    setCurrentFeatures((prev) => [...prev, newFeatureText.trim()]);
    setNewFeatureText('');
  };

  const handleRemoveFeature = (idx: number) => {
    setCurrentFeatures((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSaveFeatures = async () => {
    if (!editingBatch) return;
    setIsSaving(true);
    try {
      await apiClient.post(`/admin-panel/batches/${editingBatch.id}/sync-features/`, {
        features: currentFeatures,
      });
      success(`Updated feature bullets for ${editingBatch.name}.`);
      setIsFeaturesModalOpen(false);
      loadData();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to save features.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (batch: BatchAdminItem) => {
    try {
      await apiClient.patch(`/admin-panel/batches/${batch.id}/`, {
        is_published: !batch.is_published,
      });
      success(`"${batch.name}" is now ${!batch.is_published ? 'Published' : 'Hidden'}.`);
      loadData();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  return (
    <div className="space-y-6">
      <Notice notice={notice} onClose={clear} />

      <PageHeader
        icon={Layers}
        title="Batches &amp; Pricing"
        description="Configure batches, set curriculum item prices, add-on digital books, upload cover images (auto-converted to 1200px WebP), and publish live."
        actions={
          <button type="button" onClick={() => handleOpenEdit()} className={primaryBtn}>
            <Plus className="h-4 w-4" />
            <span>New Batch</span>
          </button>
        }
      />

      {isLoading ? (
        <LoadingBlock label="Loading batches..." />
      ) : batches.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No Batches Configured"
          description="Create your first batch or seed standard batches using seed_pricing."
          action={
            <button type="button" onClick={() => handleOpenEdit()} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              <span>Create First Batch</span>
            </button>
          }
        />
      ) : (
        <div className={tableWrap}>
          <table className="w-full">
            <thead className="bg-slate-950/60 border-b border-slate-800">
              <tr>
                <th className={th}>Batch Details</th>
                <th className={th}>Category / Class</th>
                <th className={th}>Price</th>
                <th className={th}>Curriculum Items</th>
                <th className={th}>Features</th>
                <th className={th}>Order</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {batches.map((batch) => {
                const regularCount = (batch.items || []).filter((i) => !i.is_addon).length;
                const addonCount = (batch.items || []).filter((i) => i.is_addon).length;

                return (
                  <tr key={batch.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className={td}>
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-20 rounded-lg overflow-hidden bg-slate-950 border border-slate-700 shrink-0">
                          {batch.image ? (
                            <Image src={batch.image} alt={batch.name} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-slate-500 text-[10px]">
                              No Img
                            </div>
                          )}
                        </div>
                        <div>
                          <span className="font-semibold text-white block">{batch.name}</span>
                          <span className="text-xs text-slate-400 font-mono block">/{batch.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td className={td}>
                      <div className="space-y-1">
                        <Pill tone="indigo">{batch.card_key || 'Category'}</Pill>
                        {batch.academic_class_name && (
                          <span className="block text-[11px] text-slate-400 font-medium">
                            {batch.academic_class_name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      <div>
                        <span className="font-black text-amber-400 text-sm block">
                          ₹{Number(batch.price).toLocaleString('en-IN')}
                        </span>
                        {batch.original_price && (
                          <span className="text-[11px] text-slate-500 line-through block">
                            ₹{Number(batch.original_price).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className={td}>
                      <button
                        type="button"
                        onClick={() => handleOpenItems(batch)}
                        className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium hover:underline cursor-pointer"
                      >
                        <ListPlus className="h-3.5 w-3.5" />
                        <span>
                          {regularCount} items {addonCount > 0 ? `(+${addonCount} add-on)` : ''}
                        </span>
                      </button>
                    </td>
                    <td className={td}>
                      <button
                        type="button"
                        onClick={() => handleOpenFeatures(batch)}
                        className="inline-flex items-center gap-1.5 text-xs text-amber-400 hover:text-amber-300 font-medium hover:underline cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{(batch.features || []).length} bullets</span>
                      </button>
                    </td>
                    <td className={td}>
                      <span className="font-mono text-xs">{batch.display_order}</span>
                    </td>
                    <td className={td}>
                      <button
                        type="button"
                        onClick={() => handleTogglePublish(batch)}
                        className="cursor-pointer"
                        title="Click to toggle publish"
                      >
                        <Pill tone={batch.is_published ? 'green' : 'slate'}>
                          {batch.is_published ? 'Published' : 'Draft / Hidden'}
                        </Pill>
                      </button>
                    </td>
                    <td className={`${td} text-right`}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(batch)}
                          className={ghostBtn}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                          <span>Edit</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ===================================================================
          1. CREATE / EDIT BATCH MODAL
          =================================================================== */}
      <Modal
        open={isEditModalOpen}
        title={editingBatch ? `Edit Batch: ${editingBatch.name}` : 'Create New Batch'}
        description="Update batch pricing, category association, syllabus details, and upload image (WebP auto-optimized)."
        onClose={() => setIsEditModalOpen(false)}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={handleSaveBatch}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Batch'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSaveBatch} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Batch Name *">
              <input
                type="text"
                value={formName}
                onChange={(e) => {
                  setFormName(e.target.value);
                  if (!editingBatch && !formSlug) {
                    setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }
                }}
                className={inputClass}
                required
              />
            </Field>

            <Field label="URL Slug *">
              <input
                type="text"
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value.toLowerCase())}
                className={inputClass}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Pricing Category Card *">
              <select
                value={formCardId}
                onChange={(e) => setFormCardId(e.target.value)}
                className={inputClass}
                required
              >
                <option value="">Select Category Card</option>
                {cardsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} ({c.key})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Academic Class (Optional for Dropper)">
              <select
                value={formClassId}
                onChange={(e) => setFormClassId(e.target.value)}
                className={inputClass}
              >
                <option value="">None / Dropper</option>
                {classesList.map((cl) => (
                  <option key={cl.id} value={cl.id}>
                    {cl.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Tagline / Short Subtitle">
            <input
              type="text"
              value={formTagline}
              onChange={(e) => setFormTagline(e.target.value)}
              className={inputClass}
              placeholder="e.g. Class 10 CBSE 100/100 Target + JEE Foundation Bridge"
            />
          </Field>

          <Field label="Description">
            <textarea
              rows={2}
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field label="Selling Price (₹) *">
              <input
                type="number"
                min={0}
                step="0.01"
                value={formPrice}
                onChange={(e) => setFormPrice(e.target.value)}
                className={inputClass}
                required
              />
            </Field>

            <Field label="Original Price (₹ - Optional MRP)">
              <input
                type="number"
                min={0}
                step="0.01"
                value={formOriginalPrice}
                onChange={(e) => setFormOriginalPrice(e.target.value)}
                className={inputClass}
                placeholder="e.g. 6000"
              />
            </Field>

            <Field label="Display Order">
              <input
                type="number"
                value={formDisplayOrder}
                onChange={(e) => setFormDisplayOrder(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Batch Cover Image (JPG, PNG, WebP up to 5 MB)">
            <div className="flex items-center gap-3">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setSelectedImageFile(e.target.files[0]);
                  }
                }}
                className="text-xs text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
              />
              {editingBatch?.image && !selectedImageFile && (
                <span className="text-[11px] text-slate-400">Current: {editingBatch.image.slice(-25)}</span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Image is validated and automatically converted to high-quality 1200px WebP before Cloudflare R2 storage.
            </p>
          </Field>

          <div className="flex items-center gap-3 pt-2">
            <Toggle checked={formPublished} onChange={setFormPublished} label="Published Live" />
            <span className="text-xs text-slate-300 font-medium">
              {formPublished ? 'Visible to Students on Website' : 'Hidden Draft'}
            </span>
          </div>
        </form>
      </Modal>

      {/* ===================================================================
          2. CURRICULUM ITEMS EDITOR MODAL
          =================================================================== */}
      <Modal
        open={isItemsModalOpen}
        title={`Curriculum Items: ${editingBatch?.name || ''}`}
        description="Add, edit, or remove the component modules, mock tests, and digital add-on books for this batch."
        onClose={() => setIsItemsModalOpen(false)}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => setIsItemsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={handleSaveItems}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Curriculum Items'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              Itemized components shown in batch tables and included in purchases:
            </span>
            <button
              type="button"
              onClick={handleAddItemRow}
              className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Item</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
            {currentItems.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-col sm:flex-row items-start sm:items-center gap-2.5 p-3 rounded-xl bg-slate-950/60 border border-slate-800"
              >
                <select
                  value={item.item_type}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCurrentItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, item_type: val } : it))
                    );
                  }}
                  className={`${inputClass} sm:w-48 shrink-0`}
                >
                  {ITEM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  placeholder="Component title..."
                  value={item.title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCurrentItems((prev) =>
                      prev.map((it, i) => (i === idx ? { ...it, title: val } : it))
                    );
                  }}
                  className={`${inputClass} flex-1`}
                />

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative w-24">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">₹</span>
                    <input
                      type="number"
                      min={0}
                      value={item.price}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, price: val } : it))
                        );
                      }}
                      className={`${inputClass} pl-6`}
                    />
                  </div>

                  <label className="flex items-center gap-1 text-[11px] text-slate-300 whitespace-nowrap cursor-pointer">
                    <input
                      type="checkbox"
                      checked={item.is_addon}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setCurrentItems((prev) =>
                          prev.map((it, i) => (i === idx ? { ...it, is_addon: checked } : it))
                        );
                      }}
                      className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-0"
                    />
                    <span>Add-on</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleRemoveItemRow(idx)}
                    className="p-2 rounded-lg text-rose-400 hover:bg-rose-950/40 hover:text-rose-300"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* ===================================================================
          3. FEATURE BULLETS EDITOR MODAL
          =================================================================== */}
      <Modal
        open={isFeaturesModalOpen}
        title={`Feature Bullets: ${editingBatch?.name || ''}`}
        description="Edit the checkmark bullet points highlighted on the batch card and detail view."
        onClose={() => setIsFeaturesModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => setIsFeaturesModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={handleSaveFeatures}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Features'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="e.g. 18 hours of weekly live instruction dissecting complex mathematical topics."
              value={newFeatureText}
              onChange={(e) => setNewFeatureText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddFeature();
                }
              }}
              className={inputClass}
            />
            <button
              type="button"
              onClick={handleAddFeature}
              className={primaryBtn}
            >
              <Plus className="h-4 w-4" />
              <span>Add</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[50vh] overflow-y-auto">
            {currentFeatures.map((feat, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-200"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-amber-400 font-bold">{idx + 1}.</span>
                  <span>{feat}</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveFeature(idx)}
                  className="p-1 rounded text-rose-400 hover:text-rose-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </div>
  );
}
