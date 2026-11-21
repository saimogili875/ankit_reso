function resolveApiBase(): string {
  // In the browser, always use same-origin /api to ensure cookies and sessions work seamlessly
  // across all hostnames (localhost, 127.0.0.1, LAN IP, or custom domain) without cross-site issues.
  if (typeof window !== 'undefined') {
    return '/api';
  }

  // On the server (SSR), use an absolute URL to reach the backend
  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  const backend = (
    process.env.INTERNAL_API_URL ||
    process.env.BACKEND_ORIGIN ||
    (envUrl && envUrl.startsWith('http') ? envUrl : 'http://localhost:8000/api')
  ).trim().replace(/\/+$/, '');

  return backend.endsWith('/api') ? backend : `${backend}/api`;
}

export const API_BASE = resolveApiBase();
