/**
 * Shared API configuration.
 *
 * Validates that NEXT_PUBLIC_API_URL is configured in production builds/runtimes
 * to prevent silent runtime fallbacks to localhost.
 */

function resolveApiBase(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL;

  if (process.env.NODE_ENV === 'production') {
    if (!envUrl || !envUrl.trim()) {
      throw new Error(
        'CRITICAL CONFIG ERROR: NEXT_PUBLIC_API_URL is unset in production. ' +
        'Set NEXT_PUBLIC_API_URL to "/api" (for same-origin rewrites) or to the full backend API base URL (e.g. "https://api.yourdomain.com/api").'
      );
    }
  }

  const raw = (envUrl || 'http://localhost:8000/api').trim().replace(/\/+$/, '');
  return raw.endsWith('/api') ? raw : `${raw}/api`;
}

export const API_BASE = resolveApiBase();
