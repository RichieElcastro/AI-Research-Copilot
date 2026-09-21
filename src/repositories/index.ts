import { apiClient } from '../services/apiClient';
import {
  ResearchProject,
  Variable,
  ResponseScale,
  Instrument,
  InstrumentItem,
  Questionnaire,
  QuestionnaireVersion,
  SurveySubmission,
  ProcessingRun,
  ProcessedDataset,
  ScoringRule,
  ScoringRun,
  ScoredDataset,
  AuditLog,
  PublicQuestionnaireDTO,
} from '../types';

/**
 * Repository Layer
 * Decouples domain services from specific storage mechanisms (PostgreSQL, SQLite, API, Local Cache).
 */

export const ProjectRepository = {
  async getAll(): Promise<ResearchProject[]> {
    const res = await apiClient.fetch<ResearchProject[]>('/api/projects');
    return res.success && res.data ? res.data : [];
  },

  async getById(id: string): Promise<ResearchProject | null> {
    const res = await apiClient.fetch<ResearchProject>(`/api/projects/${id}`);
    return res.success && res.data ? res.data : null;
  },

  async create(payload: Partial<ResearchProject>): Promise<ResearchProject | null> {
    const res = await apiClient.fetch<ResearchProject>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.success && res.data ? res.data : null;
  },

  async update(id: string, payload: Partial<ResearchProject>): Promise<ResearchProject | null> {
    const res = await apiClient.fetch<ResearchProject>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.success && res.data ? res.data : null;
  },

  async delete(id: string): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${id}`, { method: 'DELETE' });
    return res.success;
  },
};

export const VariableRepository = {
  async getByProject(projectId: string): Promise<Variable[]> {
    const res = await apiClient.fetch<Variable[]>(`/api/projects/${projectId}/variables`);
    return res.success && res.data ? res.data : [];
  },

  async create(projectId: string, payload: any): Promise<Variable | null> {
    const res = await apiClient.fetch<Variable>(`/api/projects/${projectId}/variables`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.success && res.data ? res.data : null;
  },

  async delete(projectId: string, id: string): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/variables/${id}`, { method: 'DELETE' });
    return res.success;
  },
};

export const ScaleRepository = {
  async getByProject(projectId: string): Promise<ResponseScale[]> {
    const res = await apiClient.fetch<ResponseScale[]>(`/api/projects/${projectId}/scales`);
    return res.success && res.data ? res.data : [];
  },

  async create(projectId: string, payload: any): Promise<ResponseScale | null> {
    const res = await apiClient.fetch<ResponseScale>(`/api/projects/${projectId}/scales`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.success && res.data ? res.data : null;
  },
};

export const InstrumentRepository = {
  async getByProject(projectId: string): Promise<Instrument[]> {
    const res = await apiClient.fetch<Instrument[]>(`/api/projects/${projectId}/instruments`);
    return res.success && res.data ? res.data : [];
  },

  async getById(projectId: string, id: string): Promise<(Instrument & { items: InstrumentItem[] }) | null> {
    const res = await apiClient.fetch<Instrument & { items: InstrumentItem[] }>(`/api/projects/${projectId}/instruments/${id}`);
    return res.success && res.data ? res.data : null;
  },

  async create(projectId: string, payload: any): Promise<Instrument | null> {
    const res = await apiClient.fetch<Instrument>(`/api/projects/${projectId}/instruments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.success && res.data ? res.data : null;
  },

  async approve(projectId: string, id: string): Promise<{ success: boolean; versionId?: string; error?: string }> {
    const res = await apiClient.fetch<{ versionId: string }>(`/api/projects/${projectId}/instruments/${id}/approve`, {
      method: 'POST',
    });
    return { success: res.success, versionId: res.data?.versionId, error: res.error };
  },

  async addItem(projectId: string, instrumentId: string, item: any): Promise<InstrumentItem | null> {
    const res = await apiClient.fetch<InstrumentItem>(`/api/projects/${projectId}/instruments/${instrumentId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
    return res.success && res.data ? res.data : null;
  },

  async deleteItem(projectId: string, instrumentId: string, itemId: string): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/instruments/${instrumentId}/items/${itemId}`, {
      method: 'DELETE',
    });
    return res.success;
  },
};

export const QuestionnaireRepository = {
  async getByProject(projectId: string): Promise<Questionnaire[]> {
    const res = await apiClient.fetch<Questionnaire[]>(`/api/projects/${projectId}/questionnaires`);
    return res.success && res.data ? res.data : [];
  },

  async getVersions(projectId: string, id: string): Promise<QuestionnaireVersion[]> {
    const res = await apiClient.fetch<QuestionnaireVersion[]>(`/api/projects/${projectId}/questionnaires/${id}/versions`);
    return res.success && res.data ? res.data : [];
  },

  async create(projectId: string, payload: any): Promise<Questionnaire | null> {
    const res = await apiClient.fetch<Questionnaire>(`/api/projects/${projectId}/questionnaires`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return res.success && res.data ? res.data : null;
  },

  async publish(projectId: string, id: string, payload: any): Promise<{ success: boolean; versionId?: string; error?: string }> {
    const res = await apiClient.fetch<{ versionId: string }>(`/api/projects/${projectId}/questionnaires/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, versionId: res.data?.versionId, error: res.error };
  },

  async pause(projectId: string, id: string): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}/pause`, { method: 'POST' });
    return res.success;
  },

  async resume(projectId: string, id: string): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}/resume`, { method: 'POST' });
    return res.success;
  },

  async close(projectId: string, id: string): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}/close`, { method: 'POST' });
    return res.success;
  },
};

export const SubmissionRepository = {
  async getPublicSurvey(slug: string): Promise<{ success: boolean; data?: PublicQuestionnaireDTO; error?: string; status?: number }> {
    try {
      const res = await fetch(`/api/public/surveys/${slug}`);
      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || 'Failed to load public survey', status: res.status };
      }
      return { success: true, data: json.data, status: res.status };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network error', status: 0 };
    }
  },

  async submitPublicSurvey(slug: string, payload: any): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`/api/public/surveys/${slug}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) {
        return { success: false, error: json.error || 'Submission rejected' };
      }
      return { success: true, data: json.data };
    } catch (e: any) {
      return { success: false, error: e.message || 'Network submission error' };
    }
  },

  async getByProject(projectId: string, questionnaireId?: string): Promise<SurveySubmission[]> {
    let url = `/api/projects/${projectId}/submissions`;
    if (questionnaireId) url += `?questionnaireId=${questionnaireId}`;
    const res = await apiClient.fetch<SurveySubmission[]>(url);
    return res.success && res.data ? res.data : [];
  },

  async updateValidation(projectId: string, id: string, validationStatus: string, notes?: string): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/submissions/${id}/validation`, {
      method: 'PUT',
      body: JSON.stringify({ validationStatus, researcherDecisionNotes: notes }),
    });
    return res.success;
  },
};

export const ProcessingRepository = {
  async getRuns(projectId: string): Promise<ProcessingRun[]> {
    const res = await apiClient.fetch<ProcessingRun[]>(`/api/projects/${projectId}/processing/runs`);
    return res.success && res.data ? res.data : [];
  },

  async getDataset(projectId: string, runId: string): Promise<{ columns: any[]; records: any[] } | null> {
    const res = await apiClient.fetch<{ columns: any[]; records: any[] }>(`/api/projects/${projectId}/processing/runs/${runId}/dataset`);
    return res.success && res.data ? res.data : null;
  },

  async saveRun(projectId: string, payload: any): Promise<{ success: boolean; runId?: string; error?: string }> {
    const res = await apiClient.fetch<{ runId: string }>(`/api/projects/${projectId}/processing/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, runId: res.data?.runId, error: res.error };
  },
};

export const ScoringRepository = {
  async getRules(projectId: string): Promise<ScoringRule[]> {
    const res = await apiClient.fetch<ScoringRule[]>(`/api/projects/${projectId}/scoring/rules`);
    return res.success && res.data ? res.data : [];
  },

  async saveRule(projectId: string, payload: any): Promise<{ success: boolean; id?: string }> {
    const res = await apiClient.fetch<{ id: string }>(`/api/projects/${projectId}/scoring/rules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, id: res.data?.id };
  },

  async getRuns(projectId: string): Promise<ScoringRun[]> {
    const res = await apiClient.fetch<ScoringRun[]>(`/api/projects/${projectId}/scoring/runs`);
    return res.success && res.data ? res.data : [];
  },

  async getDataset(projectId: string, runId: string): Promise<{ columns: any[]; records: any[]; summaryStatistics?: any } | null> {
    const res = await apiClient.fetch<{ columns: any[]; records: any[]; summaryStatistics?: any }>(`/api/projects/${projectId}/scoring/runs/${runId}/dataset`);
    return res.success && res.data ? res.data : null;
  },

  async saveRun(projectId: string, payload: any): Promise<{ success: boolean; runId?: string; error?: string }> {
    const res = await apiClient.fetch<{ runId: string }>(`/api/projects/${projectId}/scoring/run`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, runId: res.data?.runId, error: res.error };
  },
};

export const AuditRepository = {
  async getByProject(projectId: string): Promise<AuditLog[]> {
    const res = await apiClient.fetch<AuditLog[]>(`/api/projects/${projectId}/audit-logs`);
    return res.success && res.data ? res.data : [];
  },
};
