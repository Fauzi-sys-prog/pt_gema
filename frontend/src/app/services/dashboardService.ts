import { api } from './api';

export type ExecutiveDashboardSummary = {
  generatedAt: string;
  currentYear: number;
  years: Array<{ year: string; revenue: number; expense: number; profit: number; projects: number }>;
  monthly: Array<{ month: number; revenue: number; expense: number }>;
  segments: Array<{ name: string; value: number }>;
  metrics: {
    activeProjects: number;
    totalProjects: number;
    employees: number;
    stockItems: number;
    invoiceCount: number;
  };
  lastUpdatedAt: string | null;
};

export const dashboardService = {
  getExecutiveSummary: () => api.request<ExecutiveDashboardSummary>('/dashboard/executive-summary'),
};
