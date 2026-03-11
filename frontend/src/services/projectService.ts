import type { api } from './api'; import type { Project } from '../contexts/AppContext';

export const projectService = {
  async getProjects(): Promise<Project[]> {
    try {
      // return await api.request<Project[]>('/projects');
      return [];
    } catch (error) {
      return [];
    }
  },

  async updateProject(id: string, updates: Partial<Project>) {
    try {
      // return await api.request(`/projects/${id}`, {
      //   method: 'PATCH',
      //   body: JSON.stringify(updates)
      // });
      return null;
    } catch (error) {
      return null;
    }
  }
};
