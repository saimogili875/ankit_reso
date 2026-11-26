function resolveApiBase(): string {
  // In the browser, always use same-origin /api to ensure cookies and sessions work seamlessly
  // across all hostnames (localhost, 127.0.0.1, LAN IP, or custom domain) without cross-site issues.
  if (typeof window !== 'undefined') {
    return '/api';
  }

  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const configuredBackend = (
    process.env.INTERNAL_API_URL ||
    process.env.BACKEND_ORIGIN ||
    (envUrl && envUrl.startsWith('http') ? envUrl : '')
  ).trim();

  if (isProduction) {
    if (!configuredBackend || configuredBackend.includes('localhost') || configuredBackend.includes('127.0.0.1')) {
      throw new Error(
        `[CRITICAL CONNECTION ERROR] Server-side rendering (SSR) in production requires ` +
        `BACKEND_ORIGIN or INTERNAL_API_URL (or an absolute NEXT_PUBLIC_API_URL) pointing to the ` +
        `production backend API, not localhost.`
      );
    }
  }

  const backend = (configuredBackend || 'http://localhost:8000/api').replace(/\/+$/, '');
  return backend.endsWith('/api') ? backend : `${backend}/api`;
}

export const API_BASE = resolveApiBase();
