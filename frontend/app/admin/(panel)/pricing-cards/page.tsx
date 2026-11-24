'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Tag, Edit2, Loader2, Layers } from 'lucide-react';
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

interface PricingCardAdminItem {
  id: string;
  key: string;
  title: string;
  tagline: string;
  badge: string;
  rotate_seconds: number;
  cta_label: string;
  cta_url: string;
  is_published: boolean;
  order: number;
  batches_count?: number;
  features?: Array<{ id: string; text: string; order: number }>;
}

export default function AdminPricingCardsPage() {
  const [cards, setCards] = useState<PricingCardAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { notice, success, error, clear } = useNotice();

  // Edit / Modal state
  const [editingCard, setEditingCard] = useState<PricingCardAdminItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [formKey, setFormKey] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formBadge, setFormBadge] = useState('');
  const [formRotateSec, setFormRotateSec] = useState(5);
  const [formCtaLabel, setFormCtaLabel] = useState('');
  const [formCtaUrl, setFormCtaUrl] = useState('');
  const [formOrder, setFormOrder] = useState(0);
  const [formPublished, setFormPublished] = useState(true);

  const loadCards = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get<PricingCardAdminItem[]>('/admin-panel/pricing-cards/');
      setCards(asList(res));
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to load pricing cards.');
    } finally {
      setIsLoading(false);
    }
  }, [error]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  const handleOpenEdit = (card: PricingCardAdminItem) => {
    setEditingCard(card);
    setFormKey(card.key);
    setFormTitle(card.title);
    setFormTagline(card.tagline || '');
    setFormBadge(card.badge || '');
    setFormRotateSec(card.rotate_seconds || 5);
    setFormCtaLabel(card.cta_label || '');
    setFormCtaUrl(card.cta_url || '');
    setFormOrder(card.order || 0);
    setFormPublished(card.is_published);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      error('Title is required.');
      return;
    }
    setIsSaving(true);
    try {
      if (editingCard) {
        await apiClient.patch(`/admin-panel/pricing-cards/${editingCard.id}/`, {
          title: formTitle.trim(),
          tagline: formTagline.trim(),
          badge: formBadge.trim(),
          rotate_seconds: Number(formRotateSec) || 5,
          cta_label: formCtaLabel.trim(),
          cta_url: formCtaUrl.trim(),
          order: Number(formOrder) || 0,
          is_published: formPublished,
        });
        success(`Updated "${formTitle}" successfully.`);
      }
      setIsModalOpen(false);
      loadCards();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to save pricing card.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTogglePublish = async (card: PricingCardAdminItem) => {
    try {
      await apiClient.patch(`/admin-panel/pricing-cards/${card.id}/`, {
        is_published: !card.is_published,
      });
      success(`"${card.title}" is now ${!card.is_published ? 'Published' : 'Hidden'}.`);
      loadCards();
    } catch (err: unknown) {
      error(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  return (
    <div className="space-y-6">
      <Notice notice={notice} onClose={clear} />

      <PageHeader
        icon={Tag}
        title="Pricing Cards"
        description="Manage top-level pricing categories shown on the landing page (School, Senior, Dropper) and carousel auto-advance timings."
        actions={
          <Link href="/admin/batches" className={ghostBtn}>
            <Layers className="h-4 w-4" />
            <span>Manage Individual Batches &rarr;</span>
          </Link>
        }
      />

      {isLoading ? (
        <LoadingBlock label="Loading pricing categories..." />
      ) : cards.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No Pricing Cards Found"
          description="Run seed_pricing or initialize cards for School, Senior, and Dropper programs."
        />
      ) : (
        <div className={tableWrap}>
          <table className="w-full">
            <thead className="bg-slate-950/60 border-b border-slate-800">
              <tr>
                <th className={th}>Card Category</th>
                <th className={th}>Key / Badge</th>
                <th className={th}>Carousel Speed</th>
                <th className={th}>CTA Target</th>
                <th className={th}>Order</th>
                <th className={th}>Status</th>
                <th className={`${th} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {cards.map((card) => (
                <tr key={card.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className={td}>
                    <div>
                      <span className="font-semibold text-white block">{card.title}</span>
                      <span className="text-xs text-slate-400 block line-clamp-1">{card.tagline}</span>
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex items-center gap-2">
                      <Pill tone="indigo">{card.key}</Pill>
                      {card.badge && <Pill tone="amber">{card.badge}</Pill>}
                    </div>
                  </td>
                  <td className={td}>
                    <span className="text-xs text-slate-300 font-mono">
                      {card.rotate_seconds}s interval
                    </span>
                  </td>
                  <td className={td}>
                    <span className="text-xs text-slate-300 block font-medium">{card.cta_label}</span>
                    <span className="text-[11px] text-slate-500 font-mono block">{card.cta_url}</span>
                  </td>
                  <td className={td}>
                    <span className="font-mono text-xs">{card.order}</span>
                  </td>
                  <td className={td}>
                    <button
                      type="button"
                      onClick={() => handleTogglePublish(card)}
                      className="cursor-pointer"
                      title="Click to toggle publish"
                    >
                      <Pill tone={card.is_published ? 'green' : 'slate'}>
                        {card.is_published ? 'Published' : 'Draft / Hidden'}
                      </Pill>
                    </button>
                  </td>
                  <td className={`${td} text-right`}>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(card)}
                        className={ghostBtn}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
      <Modal
        open={isModalOpen}
        title={`Edit Pricing Card: ${editingCard?.title || ''}`}
        description="Update card titles, taglines, badges, carousel rotation interval, and CTA destination."
        onClose={() => setIsModalOpen(false)}
        footer={
          <>
            <button
              type="button"
              className={ghostBtn}
              onClick={() => setIsModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primaryBtn}
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave} className="space-y-4">
          <Field label="Category Key (Read-only)">
            <input type="text" value={formKey} disabled className={inputClass} />
          </Field>

          <Field label="Card Title *">
            <input
              type="text"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className={inputClass}
              required
            />
          </Field>

          <Field label="Tagline / Subtitle">
            <input
              type="text"
              value={formTagline}
              onChange={(e) => setFormTagline(e.target.value)}
              className={inputClass}
              placeholder="e.g. Evening live classes designed around school hours..."
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Badge Label">
              <input
                type="text"
                value={formBadge}
                onChange={(e) => setFormBadge(e.target.value)}
                className={inputClass}
                placeholder="e.g. Most Popular"
              />
            </Field>

            <Field label="Carousel Auto-Advance (Seconds)">
              <input
                type="number"
                min={2}
                max={60}
                value={formRotateSec}
                onChange={(e) => setFormRotateSec(Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="CTA Button Label">
              <input
                type="text"
                value={formCtaLabel}
                onChange={(e) => setFormCtaLabel(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="CTA Destination URL">
              <input
                type="text"
                value={formCtaUrl}
                onChange={(e) => setFormCtaUrl(e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4 items-center pt-2">
            <Field label="Display Order">
              <input
                type="number"
                value={formOrder}
                onChange={(e) => setFormOrder(Number(e.target.value))}
                className={inputClass}
              />
            </Field>

            <div className="flex items-center gap-3 pt-4">
              <Toggle checked={formPublished} onChange={setFormPublished} label="Published Live" />
              <span className="text-xs text-slate-300 font-medium">
                {formPublished ? 'Visible on Website' : 'Hidden Draft'}
              </span>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
