const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

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
      const url = `${API_BASE_URL}/auth/csrf/`;
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
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_BASE_URL}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;

  const method = (options.method || 'GET').toUpperCase();

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

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...((options.headers as Record<string, string>) || {}),
    },
    credentials: 'include',
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const formatted = formatApiError(errorData, response.status);

      // Handle 401/403 redirects according to authentication policy
      const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/register') || endpoint.includes('/auth/csrf');
      if (typeof window !== 'undefined' && !isAuthEndpoint) {
        if (response.status === 401) {
          // Clear session cookies and redirect to login
          document.cookie = 'auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
          if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
            window.location.href = '/login';
          }
        } else if (response.status === 403) {
          if (window.location.pathname.startsWith('/admin')) {
            window.location.href = '/';
          } else if (!window.location.pathname.startsWith('/login')) {
            window.location.href = '/login';
          }
        }
      }

      throw new Error(formatted);
    }
    // Return empty object for 204 No Content
    if (response.status === 204) {
      return {} as T;
    }
    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[API Client Warning] ${method} ${url}:`, message);
    throw error;
  }
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
      if (typeof document !== 'undefined') {
        document.cookie = 'auth_session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      }
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
  },
};

export default apiClient;
