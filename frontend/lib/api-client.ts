import axios from 'axios';

// Ensure global Axios default uses withCredentials for cross-origin requests
axios.defaults.withCredentials = true;

const rawBaseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api').trim().replace(/\/+$/, '');
export const API_BASE_URL = rawBaseUrl.endsWith('/api') ? rawBaseUrl : `${rawBaseUrl}/api`;

/**
 * Builds a standardized API URL ensuring /api prefix is present without duplicates.
 */
export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  if (cleanEndpoint.startsWith('/api/')) {
    const origin = API_BASE_URL.replace(/\/api$/, '');
    return `${origin}${cleanEndpoint}`;
  }
  return `${API_BASE_URL}${cleanEndpoint}`;
}

// Track in-flight redirects to prevent infinite redirection loops
let isRedirecting = false;

const PUBLIC_PATHS = [
  '/',
  '/landing',
  '/login',
  '/register',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
];

/**
 * Single source of truth for clearing authentication cookies on the frontend domain.
 */
export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;
  const pastDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `auth_session=; path=/; expires=${pastDate}; SameSite=Lax`;
  document.cookie = `user_role=; path=/; expires=${pastDate}; SameSite=Lax`;
  document.cookie = `sessionid=; path=/; expires=${pastDate}; SameSite=Lax`;
}

/**
 * Single source of truth for setting frontend-domain session state cookies for Next.js middleware.
 */
export function setAuthCookies(role: string, rememberMe = false): void {
  if (typeof document === 'undefined') return;
  const maxAge = rememberMe ? '; max-age=1209600' : '';
  document.cookie = `auth_session=1; path=/; SameSite=Lax${maxAge}`;
  document.cookie = `user_role=${role}; path=/; SameSite=Lax${maxAge}`;
}

let cachedCsrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export async function fetchCsrfToken(): Promise<string | null> {
  // Check cookie first
  const cookieToken = getCookie('csrftoken');
  if (cookieToken) {
    cachedCsrfToken = cookieToken;
    return cookieToken;
  }

  if (cachedCsrfToken) return cachedCsrfToken;

  if (csrfFetchPromise) return csrfFetchPromise;

  csrfFetchPromise = (async () => {
    try {
      const url = buildApiUrl('/auth/csrf/');
      const res = await fetch(url, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.csrfToken) {
          cachedCsrfToken = data.csrfToken;
          return data.csrfToken;
        }
      }
      return getCookie('csrftoken') || null;
    } catch {
      return null;
    } finally {
      csrfFetchPromise = null;
    }
  })();

  return csrfFetchPromise;
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status = 500, data: unknown = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

// In-flight GET request deduplication cache to prevent duplicate concurrent round-trips
const inflightGetRequests = new Map<string, Promise<unknown>>();

export function formatApiError(errorData: Record<string, unknown> | null | undefined, status: number): string {
  if (!errorData || typeof errorData !== 'object') {
    return `API Error (${status})`;
  }

  // 1. Direct message / detail / error string
  if (typeof errorData.detail === 'string' && errorData.detail.trim()) {
    return errorData.detail;
  }
  if (typeof errorData.error === 'string' && errorData.error.trim()) {
    return errorData.error;
  }
  if (typeof errorData.message === 'string' && errorData.message.trim()) {
    return errorData.message;
  }

  // 2. Wrapped inside {"errors": {...}}
  const targetObj = (errorData.errors && typeof errorData.errors === 'object')
    ? (errorData.errors as Record<string, unknown>)
    : errorData;

  const messages: string[] = [];

  for (const [key, value] of Object.entries(targetObj)) {
    if (key === 'error' || key === 'message' || key === 'detail') continue;

    if (Array.isArray(value)) {
      const strVals = value.map((v) => (typeof v === 'string' ? v : JSON.stringify(v))).filter(Boolean);
      if (strVals.length > 0) {
        if (key === 'non_field_errors' || key === '__all__') {
          messages.push(strVals.join(' '));
        } else {
          messages.push(`${key}: ${strVals.join(' ')}`);
        }
      }
    } else if (typeof value === 'string' && value.trim()) {
      if (key === 'non_field_errors' || key === '__all__') {
        messages.push(value);
      } else {
        messages.push(`${key}: ${value}`);
      }
    } else if (value && typeof value === 'object') {
      const nested = formatApiError(value as Record<string, unknown>, status);
      messages.push(`${key}: ${nested}`);
    }
  }

  if (messages.length > 0) {
    return messages.join(' | ');
  }

  return `API Error (${status})`;
}

export async function apiFetch<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(endpoint);
  const method = (options.method || 'GET').toUpperCase();

  // Deduplicate concurrent GET requests
  if (method === 'GET' && inflightGetRequests.has(url)) {
    return inflightGetRequests.get(url) as Promise<T>;
  }

  const executeFetch = async (): Promise<T> => {
    const defaultHeaders: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (options.body && typeof options.body === 'string') {
      defaultHeaders['Content-Type'] = 'application/json';
    }

    // Add CSRF token for mutating methods
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      const token = await fetchCsrfToken();
      if (token) {
        defaultHeaders['X-CSRFToken'] = token;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15-second timeout

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...((options.headers as Record<string, string>) || {}),
      },
      credentials: 'include',
      signal: options.signal || controller.signal,
    };

    try {
      const response = await fetch(url, config);
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const formatted = formatApiError(errorData, response.status);

        // Handle 401/403 redirects according to authentication policy
        const isAuthCheckEndpoint = endpoint.includes('/auth/me');
        const isAuthEndpoint =
          endpoint.includes('/auth/login') ||
          endpoint.includes('/auth/register') ||
          endpoint.includes('/auth/signup') ||
          endpoint.includes('/auth/csrf') ||
          isAuthCheckEndpoint;

        if (typeof window !== 'undefined' && !isAuthEndpoint) {
          const currentPath = window.location.pathname;
          const isPublicRoute = PUBLIC_PATHS.some((path) =>
            path === '/' ? currentPath === '/' : currentPath === path || currentPath.startsWith(`${path}/`)
          );

          if (response.status === 401) {
            clearAuthCookies();
            if (!isPublicRoute && !isRedirecting) {
              isRedirecting = true;
              window.location.href = '/login';
            }
          } else if (response.status === 403) {
            const detail = (typeof errorData?.detail === 'string' ? errorData.detail : '').toLowerCase();
            const isCredentialIssue =
              detail.includes('credentials') ||
              detail.includes('not provided') ||
              detail.includes('not authenticated') ||
              detail.includes('authentication credentials');

            if (isCredentialIssue) {
              clearAuthCookies();
              if (!isPublicRoute && !isRedirecting) {
                isRedirecting = true;
                window.location.href = '/login';
              }
            } else if (currentPath.startsWith('/admin') && !isRedirecting) {
              isRedirecting = true;
              window.location.href = '/';
            }
          }
        }

        throw new ApiError(formatted, response.status, errorData);
      }

      // Return empty object for 204 No Content
      if (response.status === 204) {
        return {} as T;
      }
      return await response.json();
    } catch (error: unknown) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        const timeoutError = new ApiError('Request timed out after 15 seconds. Please try again.', 408);
        console.warn(`[API Client Timeout] ${method} ${url}`);
        throw timeoutError;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[API Client Warning] ${method} ${url}:`, message);
      throw error;
    }
  };

  if (method === 'GET') {
    const fetchPromise = executeFetch().finally(() => {
      inflightGetRequests.delete(url);
    });
    inflightGetRequests.set(url, fetchPromise);
    return fetchPromise;
  }

  return executeFetch();
}

export const apiClient = {
  get: <T = unknown>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),
  post: <T = unknown>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data || {}) }),
  put: <T = unknown>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(data || {}) }),
  patch: <T = unknown>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data || {}) }),
  delete: <T = unknown>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
  logout: async () => {
    try {
      await apiFetch('/auth/logout/', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearAuthCookies();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  },
};

export default apiClient;
