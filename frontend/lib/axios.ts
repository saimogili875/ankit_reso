import axios from 'axios';
import { API_BASE_URL, fetchCsrfToken } from './api-client';

// Configure global Axios defaults
axios.defaults.withCredentials = true;

export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Request interceptor to attach CSRF token for mutating requests
axiosInstance.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
    const token = await fetchCsrfToken();
    if (token) {
      if (typeof config.headers.set === 'function') {
        config.headers.set('X-CSRFToken', token);
      } else {
        (config.headers as Record<string, string | number | boolean>)['X-CSRFToken'] = token;
      }
    }
  }
  return config;
});

export default axiosInstance;
