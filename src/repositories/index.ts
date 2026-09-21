import { apiClient } from '../services/apiClient';
import {
  ResearchProject,
  Variable,
  Dimension,
  Indicator,
  ResponseScale,
  Instrument,
  InstrumentItem,
  InstrumentVersion,
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

  async getById(id: string): Promise<{ success: boolean; data?: ResearchProject; error?: string; status: number }> {
    const res = await apiClient.fetch<ResearchProject>(`/api/projects/${id}`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async create(payload: Partial<ResearchProject>): Promise<{ success: boolean; data?: ResearchProject; error?: string; status: number }> {
    const res = await apiClient.fetch<ResearchProject>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async update(id: string, payload: Partial<ResearchProject>): Promise<{ success: boolean; data?: ResearchProject; error?: string; status: number }> {
    const res = await apiClient.fetch<ResearchProject>(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async delete(id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error, status: res.status };
  },
};

export const VariableRepository = {
  async getByProject(projectId: string): Promise<{ success: boolean; data?: Variable[]; error?: string; status: number }> {
    const res = await apiClient.fetch<Variable[]>(`/api/projects/${projectId}/variables`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async create(projectId: string, payload: any): Promise<{ success: boolean; data?: Variable; error?: string; status: number }> {
    const res = await apiClient.fetch<Variable>(`/api/projects/${projectId}/variables`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async update(projectId: string, id: string, payload: any): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/variables/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async delete(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/variables/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error, status: res.status };
  },

  async addDimension(projectId: string, variableId: string, payload: any): Promise<{ success: boolean; data?: Dimension; error?: string; status: number }> {
    const res = await apiClient.fetch<Dimension>(`/api/projects/${projectId}/variables/${variableId}/dimensions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, data: res.data, error: res.error, status: res.status };
  },

  async updateDimension(projectId: string, id: string, payload: any): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/dimensions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async deleteDimension(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/dimensions/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error, status: res.status };
  },

  async addIndicator(projectId: string, dimensionId: string, payload: any): Promise<{ success: boolean; data?: Indicator; error?: string; status: number }> {
    const res = await apiClient.fetch<Indicator>(`/api/projects/${projectId}/dimensions/${dimensionId}/indicators`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, data: res.data, error: res.error, status: res.status };
  },

  async updateIndicator(projectId: string, id: string, payload: any): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/indicators/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async deleteIndicator(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/indicators/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error, status: res.status };
  },
};

export const ScaleRepository = {
  async getByProject(projectId: string): Promise<{ success: boolean; data?: ResponseScale[]; error?: string; status: number }> {
    const res = await apiClient.fetch<ResponseScale[]>(`/api/projects/${projectId}/scales`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async create(projectId: string, payload: any): Promise<{ success: boolean; data?: ResponseScale; error?: string; status: number }> {
    const res = await apiClient.fetch<ResponseScale>(`/api/projects/${projectId}/scales`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async update(projectId: string, id: string, payload: any): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/scales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async delete(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/scales/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error, status: res.status };
  },
};

export const InstrumentRepository = {
  async getByProject(projectId: string): Promise<{ success: boolean; data?: Instrument[]; error?: string; status: number }> {
    const res = await apiClient.fetch<Instrument[]>(`/api/projects/${projectId}/instruments`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async getById(projectId: string, id: string): Promise<{ success: boolean; data?: (Instrument & { items: InstrumentItem[] }); error?: string; status: number }> {
    const res = await apiClient.fetch<Instrument & { items: InstrumentItem[] }>(`/api/projects/${projectId}/instruments/${id}`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async create(projectId: string, payload: any): Promise<{ success: boolean; data?: Instrument; error?: string; status: number }> {
    const res = await apiClient.fetch<Instrument>(`/api/projects/${projectId}/instruments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async update(projectId: string, id: string, payload: any): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/instruments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async delete(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/instruments/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error, status: res.status };
  },

  async addItem(projectId: string, instrumentId: string, item: any): Promise<{ success: boolean; data?: InstrumentItem; error?: string; status: number }> {
    const res = await apiClient.fetch<InstrumentItem>(`/api/projects/${projectId}/instruments/${instrumentId}/items`, {
      method: 'POST',
      body: JSON.stringify(item),
    });
    return { success: res.success, data: res.data, error: res.error, status: res.status };
  },

  async updateItem(projectId: string, instrumentId: string, itemId: string, item: any): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/instruments/${instrumentId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(item),
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async deleteItem(projectId: string, instrumentId: string, itemId: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/instruments/${instrumentId}/items/${itemId}`, {
      method: 'DELETE',
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async approve(projectId: string, id: string): Promise<{ success: boolean; versionId?: string; versionNumber?: number; version?: string; error?: string; status: number }> {
    const res = await apiClient.fetch<{ versionId: string; versionNumber?: number; version?: string }>(`/api/projects/${projectId}/instruments/${id}/approve`, {
      method: 'POST',
    });
    return {
      success: res.success,
      versionId: res.data?.versionId,
      versionNumber: res.data?.versionNumber,
      version: res.data?.version,
      error: res.error,
      status: res.status,
    };
  },

  async branch(projectId: string, id: string): Promise<{ success: boolean; status?: string; version?: string; error?: string; statusCode: number }> {
    const res = await apiClient.fetch<{ status: string; version: string }>(`/api/projects/${projectId}/instruments/${id}/branch`, {
      method: 'POST',
    });
    return {
      success: res.success,
      status: res.data?.status,
      version: res.data?.version,
      error: res.error,
      statusCode: res.status,
    };
  },

  async getVersions(projectId: string, id: string): Promise<InstrumentVersion[]> {
    const res = await apiClient.fetch<InstrumentVersion[]>(`/api/projects/${projectId}/instruments/${id}/versions`);
    return res.success && res.data ? res.data : [];
  },
};

export const QuestionnaireRepository = {
  async getByProject(projectId: string): Promise<{ success: boolean; data?: Questionnaire[]; error?: string; status: number }> {
    const res = await apiClient.fetch<Questionnaire[]>(`/api/projects/${projectId}/questionnaires`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async getById(projectId: string, id: string): Promise<{ success: boolean; data?: Questionnaire; error?: string; status: number }> {
    const res = await apiClient.fetch<Questionnaire>(`/api/projects/${projectId}/questionnaires/${id}`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async getVersions(projectId: string, id: string): Promise<{ success: boolean; data?: QuestionnaireVersion[]; error?: string; status: number }> {
    const res = await apiClient.fetch<QuestionnaireVersion[]>(`/api/projects/${projectId}/questionnaires/${id}/versions`);
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async create(projectId: string, payload: any): Promise<{ success: boolean; data?: Questionnaire; error?: string; status: number }> {
    const res = await apiClient.fetch<Questionnaire>(`/api/projects/${projectId}/questionnaires`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },

  async update(projectId: string, id: string, payload: any): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: res.success, error: res.error, status: res.status };
  },

  async delete(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}`, { method: 'DELETE' });
    return { success: res.success, error: res.error, status: res.status };
  },

  async publish(projectId: string, id: string, payload: any): Promise<{ success: boolean; versionId?: string; error?: string; status: number }> {
    const res = await apiClient.fetch<{ versionId: string }>(`/api/projects/${projectId}/questionnaires/${id}/publish`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, versionId: res.data?.versionId, error: res.error, status: res.status };
  },

  async pause(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}/pause`, { method: 'POST' });
    return { success: res.success, error: res.error, status: res.status };
  },

  async resume(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}/resume`, { method: 'POST' });
    return { success: res.success, error: res.error, status: res.status };
  },

  async close(projectId: string, id: string): Promise<{ success: boolean; error?: string; status: number }> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/questionnaires/${id}/close`, { method: 'POST' });
    return { success: res.success, error: res.error, status: res.status };
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
  async getByProject(projectId: string): Promise<{ success: boolean; data?: AuditLog[]; error?: string; status: number }> {
    const res = await apiClient.fetch<AuditLog[]>(`/api/projects/${projectId}/audit-logs`);
    return {
      success: res.success,
      data: res.data || [],
      error: res.error,
      status: res.status,
    };
  },

  async log(projectId: string, payload: any): Promise<{ success: boolean; data?: AuditLog; error?: string; status: number }> {
    const res = await apiClient.fetch<AuditLog>(`/api/projects/${projectId}/audit-logs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return {
      success: res.success,
      data: res.data,
      error: res.error,
      status: res.status,
    };
  },
};

export const AIRepository = {
  async getGenerations(projectId: string): Promise<any[]> {
    const res = await apiClient.fetch<any[]>(`/api/projects/${projectId}/ai/generations`);
    return res.success && res.data ? res.data : [];
  },

  async saveGeneration(projectId: string, payload: any): Promise<{ success: boolean; generationId?: string; error?: string }> {
    const res = await apiClient.fetch<{ generationId: string }>(`/api/projects/${projectId}/ai/generations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: res.success, generationId: res.data?.generationId, error: res.error };
  },

  async getCandidates(projectId: string): Promise<any[]> {
    const res = await apiClient.fetch<any[]>(`/api/projects/${projectId}/ai/candidates`);
    return res.success && res.data ? res.data : [];
  },

  async updateCandidate(projectId: string, candidateId: string, payload: any): Promise<boolean> {
    const res = await apiClient.fetch(`/api/projects/${projectId}/ai/candidates/${candidateId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return res.success;
  },
};

