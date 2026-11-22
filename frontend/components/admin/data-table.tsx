'use client';

import React, { useMemo, useState } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Inbox,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ColumnDef<T> {
  key: string;
  header: string;
  sortable?: boolean;
  sortKey?: string;
  className?: string;
  headerClassName?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

export interface DataTablePaginationProps {
  page?: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  hasNext?: boolean;
  hasPrev?: boolean;
  onNext?: () => void;
  onPrev?: () => void;
  onPageChange?: (page: number) => void;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  isLoading?: boolean;
  // Search
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  searchPlaceholder?: string;
  onSearchSubmit?: () => void;
  // Sort
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSortChange?: (columnKey: string, direction: 'asc' | 'desc') => void;
  // Pagination
  pagination?: DataTablePaginationProps;
  // Selection & Bulk
  selectable?: boolean;
  selectedIds?: string[];
  onSelectRow?: (id: string, selected: boolean) => void;
  onSelectAll?: (selected: boolean) => void;
  getRowId?: (item: T) => string;
  bulkActions?: React.ReactNode;
  // Additional controls
  filters?: React.ReactNode;
  toolbarActions?: React.ReactNode;
  // Empty State
  emptyState?: {
    icon?: React.ComponentType<{ className?: string }>;
    title?: string;
    description?: string;
    action?: React.ReactNode;
  };
  className?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  isLoading = false,
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search records...',
  onSearchSubmit,
  sortColumn,
  sortDirection,
  onSortChange,
  pagination,
  selectable = false,
  selectedIds = [],
  onSelectRow,
  onSelectAll,
  getRowId = (item) => String((item as Record<string, unknown>).id || ''),
  bulkActions,
  filters,
  toolbarActions,
  emptyState,
  className,
}: DataTableProps<T>) {
  // Local sorting if parent doesn't provide onSortChange
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDir, setInternalSortDir] = useState<'asc' | 'desc'>('asc');

  const currentSortKey = sortColumn ?? internalSortKey;
  const currentSortDir = sortDirection ?? internalSortDir;

  const handleSort = (key: string) => {
    let nextDir: 'asc' | 'desc' = 'asc';
    if (currentSortKey === key) {
      nextDir = currentSortDir === 'asc' ? 'desc' : 'asc';
    }

    if (onSortChange) {
      onSortChange(key, nextDir);
    } else {
      setInternalSortKey(key);
      setInternalSortDir(nextDir);
    }
  };

  const sortedData = useMemo(() => {
    if (onSortChange || !currentSortKey) return data;
    return [...data].sort((a, b) => {
      const recordA = a as Record<string, unknown>;
      const recordB = b as Record<string, unknown>;
      const valA = recordA[currentSortKey];
      const valB = recordB[currentSortKey];
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      const comp = String(valA) < String(valB) ? -1 : 1;
      return currentSortDir === 'asc' ? comp : -comp;
    });
  }, [data, currentSortKey, currentSortDir, onSortChange]);

  const allPageIds = useMemo(() => sortedData.map(getRowId), [sortedData, getRowId]);
  const isAllSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.includes(id));
  const isSomeSelected =
    allPageIds.some((id) => selectedIds.includes(id)) && !isAllSelected;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Top Toolbar: Search, Filters, Bulk Actions, Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-3 flex-wrap">
          {onSearchChange !== undefined && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (onSearchSubmit) onSearchSubmit();
              }}
              className="relative flex-1 min-w-[240px] max-w-md"
            >
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery ?? ''}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full pl-9 pr-8 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </form>
          )}
          {filters}
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {selectedIds.length > 0 && bulkActions}
          {toolbarActions}
        </div>
      </div>

      {/* Table Container */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <tr>
                {selectable && (
                  <th className="px-4 py-3.5 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = isSomeSelected;
                      }}
                      onChange={(e) => onSelectAll?.(e.target.checked)}
                      className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/30 dark:bg-slate-800 cursor-pointer w-4 h-4"
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                {columns.map((col) => {
                  const isSorted = currentSortKey === (col.sortKey || col.key);
                  return (
                    <th
                      key={col.key}
                      className={cn(
                        'px-4 py-3.5 select-none',
                        col.sortable && 'cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors',
                        col.headerClassName
                      )}
                      onClick={() => {
                        if (col.sortable) {
                          handleSort(col.sortKey || col.key);
                        }
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span>{col.header}</span>
                        {col.sortable && (
                          <span className="text-slate-400">
                            {isSorted ? (
                              currentSortDir === 'asc' ? (
                                <ArrowUp className="w-3.5 h-3.5 text-indigo-500" />
                              ) : (
                                <ArrowDown className="w-3.5 h-3.5 text-indigo-500" />
                              )
                            ) : (
                              <ArrowUpDown className="w-3.5 h-3.5 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-16 text-center text-slate-500 dark:text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
                      <p className="text-sm">Loading records...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (selectable ? 1 : 0)}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto px-4">
                      {emptyState?.icon ? (
                        <emptyState.icon className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-3" />
                      ) : (
                        <Inbox className="w-10 h-10 text-slate-400 dark:text-slate-500 mb-3" />
                      )}
                      <h4 className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                        {emptyState?.title || 'No records found'}
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                        {emptyState?.description || 'Try adjusting your search or filters.'}
                      </p>
                      {emptyState?.action}
                    </div>
                  </td>
                </tr>
              ) : (
                sortedData.map((item, index) => {
                  const rowId = getRowId(item);
                  const isSelected = selectedIds.includes(rowId);
                  return (
                    <tr
                      key={rowId || index}
                      className={cn(
                        'hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors',
                        isSelected && 'bg-indigo-50/40 dark:bg-indigo-950/20'
                      )}
                    >
                      {selectable && (
                        <td className="px-4 py-3.5 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(e) => onSelectRow?.(rowId, e.target.checked)}
                            className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/30 dark:bg-slate-800 cursor-pointer w-4 h-4"
                            aria-label={`Select row ${rowId}`}
                          />
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={cn(
                            'px-4 py-3.5 text-slate-700 dark:text-slate-300',
                            col.className
                          )}
                        >
                          {col.render
                            ? col.render(item, index)
                            : ((item as Record<string, unknown>)[col.key] !== undefined && (item as Record<string, unknown>)[col.key] !== null
                                ? String((item as Record<string, unknown>)[col.key])
                                : '—')}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {pagination && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 bg-slate-50/50 dark:bg-slate-800/30">
            <div>
              {pagination.totalItems !== undefined && (
                <span>
                  Total records: <strong className="text-slate-900 dark:text-slate-200">{pagination.totalItems}</strong>
                  {pagination.page && pagination.pageSize && (
                    <span>
                      {' '}&bull; Page <strong className="text-slate-900 dark:text-slate-200">{pagination.page}</strong>
                      {pagination.totalPages ? ` of ${pagination.totalPages}` : ''}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={pagination.onPrev}
                disabled={pagination.hasPrev === false || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
              <button
                type="button"
                onClick={pagination.onNext}
                disabled={pagination.hasNext === false || isLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
