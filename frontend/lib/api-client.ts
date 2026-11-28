import axios from 'axios';
import { API_BASE } from './config';

// Ensure global Axios default uses withCredentials for cross-origin requests
axios.defaults.withCredentials = true;

export const API_BASE_URL = API_BASE;

/**
 * Builds a standardized API URL ensuring /api prefix is present without duplicates.
 */
export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  let cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Separate path and query string to strip any trailing slash before query parameters
  const [pathname, ...queryParts] = cleanEndpoint.split('?');
  const query = queryParts.length > 0 ? `?${queryParts.join('?')}` : '';
  let normalizedPath = pathname;
  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }
  cleanEndpoint = `${normalizedPath}${query}`;

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
  '/sign-in',
  '/sign-up',
  '/login',
  '/register',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/books',
  '/courses',
  '/admin/login',
  '/admin/forgot-password',
  '/admin/reset-password',
];

/**
 * Retrieves the current Clerk JWT session token from the browser window instance.
 */
export async function getClerkToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  try {
    const clerk = (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string | null> } } }).Clerk;
    if (clerk?.session?.getToken) {
      return await clerk.session.getToken();
    }
  } catch {
    // Ignore and fallback to session
  }
  return null;
}

/**
 * Single source of truth for clearing authentication cookies on the frontend domain.
 */
export function clearAuthCookies(): void {
  if (typeof document === 'undefined') return;
  const pastDate = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `auth_session=; path=/; expires=${pastDate}; SameSite=Lax`;
  document.cookie = `user_role=; path=/; expires=${pastDate}; SameSite=Lax`;
  document.cookie = `sessionid=; path=/; expires=${pastDate}; SameSite=Lax`;
  resetCsrfToken();
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

export function resetCsrfToken(): void {
  cachedCsrfToken = null;
  csrfFetchPromise = null;
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(^|;\\s*)(' + name + ')=([^;]*)'));
  return match ? decodeURIComponent(match[3]) : null;
}

export async function fetchCsrfToken(forceRefresh = false): Promise<string | null> {
  const cookieToken = getCookie('csrftoken');

  // If cookie exists and we're not forcing refresh, sync cached token with cookie
  if (!forceRefresh && cookieToken) {
    cachedCsrfToken = cookieToken;
    return cookieToken;
  }

  // If cookie is missing or forceRefresh requested, invalidate cached token
  if (forceRefresh || !cookieToken) {
    cachedCsrfToken = null;
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

    // Attach Clerk Bearer session token if present
    const clerkToken = await getClerkToken();
    if (clerkToken) {
      defaultHeaders['Authorization'] = `Bearer ${clerkToken}`;
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
              window.location.href = currentPath.startsWith('/admin') ? '/admin/login' : '/sign-in';
            }
          } else if (response.status === 403) {
            const detail = (typeof errorData?.detail === 'string' ? errorData.detail : '').toLowerCase();
            if (detail.includes('csrf')) {
              resetCsrfToken();
            }
            const isCredentialIssue =
              detail.includes('credentials') ||
              detail.includes('not provided') ||
              detail.includes('not authenticated') ||
              detail.includes('authentication credentials');

            if (isCredentialIssue) {
              clearAuthCookies();
              if (!isPublicRoute && !isRedirecting) {
                isRedirecting = true;
                window.location.href = currentPath.startsWith('/admin') ? '/admin/login' : '/sign-in';
              }
            } else if (currentPath.startsWith('/admin') && !isRedirecting) {
              isRedirecting = true;
              window.location.href = '/';
            }
          }
        }

        throw new ApiError(formatted, response.status, errorData);
      }

      // Reset CSRF tokens after successful login or logout (since Django rotates CSRF tokens)
      const isLoginEndpoint = endpoint.includes('/auth/login');
      const isLogoutEndpoint = endpoint.includes('/auth/logout');
      if (isLoginEndpoint || isLogoutEndpoint) {
        resetCsrfToken();
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

const toBody = (data?: unknown): BodyInit | undefined => {
  if (data === undefined || data === null) return undefined;
  if (
    typeof data === 'string' ||
    (typeof FormData !== 'undefined' && data instanceof FormData) ||
    (typeof Blob !== 'undefined' && data instanceof Blob) ||
    (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer)
  ) {
    return data as BodyInit;
  }
  return JSON.stringify(data);
};

export const apiClient = {
  get: <T = unknown>(endpoint: string) => apiFetch<T>(endpoint, { method: 'GET' }),
  post: <T = unknown>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: toBody(data) }),
  put: <T = unknown>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: toBody(data) }),
  patch: <T = unknown>(endpoint: string, data?: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: toBody(data) }),
  delete: <T = unknown>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
  // Clears the Django session. It does NOT navigate by default: callers that also need to end a
  // Clerk session must do that first, because a page navigation here would cancel the sign-out.
  logout: async (redirectTo?: string) => {
    try {
      await apiFetch('/auth/logout/', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      clearAuthCookies();
      if (redirectTo && typeof window !== 'undefined') {
        window.location.href = redirectTo;
      }
    }
  },
};

export default apiClient;
