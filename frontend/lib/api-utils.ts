/**
 * Utility functions for API response handling.
 */

/**
 * Safely extracts an array from either an unpaginated array response or
 * a DRF PageNumberPagination response ({ count, next, previous, results: [...] }).
 */
export function asList<T>(r: unknown): T[] {
  if (Array.isArray(r)) {
    return r as T[];
  }
  if (
    r &&
    typeof r === 'object' &&
    'results' in r &&
    Array.isArray((r as { results: unknown }).results)
  ) {
    return (r as { results: T[] }).results;
  }
  return [];
}

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
