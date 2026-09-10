import { api } from './api';

export const authService = {
  async login(username: string, password: string) {
    // Keep the double-submit CSRF header synchronized with the cookie.
    // This is especially important after the backend restarts while the
    // browser still has an older token in localStorage.
    const csrf = await api.request<{ csrfToken: string }>('/auth/csrf');
    localStorage.setItem('csrfToken', csrf.csrfToken);

    const result = await api.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (result.token) localStorage.setItem('authToken', result.token);
    if (result.csrfToken) localStorage.setItem('csrfToken', result.csrfToken);
    return result;
  },

  async getCurrentUser() {
    return api.request<any>('/auth/me');
  },

  async logout() {
    try {
      await api.request('/auth/logout', { method: 'POST' });
    } finally {
      localStorage.removeItem('authToken');
      localStorage.removeItem('csrfToken');
    }
  },
};
