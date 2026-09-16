const BASE_URL = String(import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');

type ApiErrorBody = {
  error?: string | { message?: string; fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] };
  message?: string;
};

const readErrorMessage = (body: ApiErrorBody | null, status: number) => {
  if (typeof body?.error === 'string') return body.error;
  if (body?.error && typeof body.error === 'object') {
    if (body.error.message) return body.error.message;
    const fieldMessage = Object.values(body.error.fieldErrors || {}).flat().find(Boolean);
    if (fieldMessage) return fieldMessage;
    const formMessage = body.error.formErrors?.find(Boolean);
    if (formMessage) return formMessage;
  }
  return body?.message || `Request gagal (${status})`;
};

export const api = {
  /**
   * Generic fetch wrapper with error handling and logging
   */
  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    
    // In "Zero Re-typing" architecture, we log all requests for audit trails
    console.log(`[ERP-CORE] ${options.method || 'GET'} Request to ${endpoint}`);

    try {
      const token = localStorage.getItem('authToken');
      const csrfToken = localStorage.getItem('csrfToken');
      const isFormData =
        typeof FormData !== 'undefined' && options.body instanceof FormData;

      const headers = new Headers(options.headers || {});

      if (!isFormData && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }

      if (csrfToken && !headers.has('X-CSRF-Token')) {
        headers.set('X-CSRF-Token', csrfToken);
      }

      const response = await fetch(url, {
        ...options,
        credentials: 'include',
        headers,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null) as ApiErrorBody | null;
        throw new Error(readErrorMessage(body, response.status));
      }

      if (response.status === 204) return undefined as T;
      return await response.json() as T;
    } catch (error) {
      console.error(`[API Error] ${endpoint}:`, error);
      throw error;
    }
  },

  /**
   * Robust Mock Fallback for Zero-Downtime Development
   */
  async health(): Promise<boolean> {
    const response = await fetch(`${BASE_URL}/health`);
    return response.ok;
  }
};
