import { api } from './api';

export type NotificationState = 'READ' | 'DISMISSED';

export const notificationService = {
  async getStates(): Promise<Record<string, NotificationState>> {
    const result = await api.request<{ states: Array<{ notificationKey: string; state: NotificationState }> }>('/notifications/state');
    return Object.fromEntries(result.states.map(row => [row.notificationKey, row.state]));
  },
  read(key: string) {
    return api.request(`/notifications/${encodeURIComponent(key)}/read`, { method: 'PUT' });
  },
  dismiss(key: string) {
    return api.request(`/notifications/${encodeURIComponent(key)}/dismiss`, { method: 'PUT' });
  },
  readAll(keys: string[]) {
    return api.request('/notifications/read-all', { method: 'PUT', body: JSON.stringify({ keys }) });
  },
  dismissAll(keys: string[]) {
    return api.request('/notifications/dismiss-all', { method: 'PUT', body: JSON.stringify({ keys }) });
  },
};
