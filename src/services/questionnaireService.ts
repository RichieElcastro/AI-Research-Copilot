import {
  PublicQuestionnaireDTO,
  Questionnaire,
  QuestionnaireStatus,
  QuestionnaireVersion,
} from '../types';
import { QuestionnaireRepository } from '../repositories';
import { auditService } from './auditService';
import { ServiceResult } from './projectService';

export function generateBaseSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}

const memoryQuestionnaires = new Map<string, Questionnaire[]>();
const memoryVersions = new Map<string, QuestionnaireVersion[]>();

export const questionnaireService = {
  _getAllQuestionnaires(): Questionnaire[] {
    return Array.from(memoryQuestionnaires.values()).flat();
  },

  _getAllVersions(): QuestionnaireVersion[] {
    return Array.from(memoryVersions.values()).flat();
  },

  async getByProject(projectId: string, userId?: string): Promise<ServiceResult<Questionnaire[]>> {
    const res = await QuestionnaireRepository.getByProject(projectId);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to fetch questionnaires',
        statusCode: (res.status as any) || 500,
      };
    }

    memoryQuestionnaires.set(projectId, res.data);
    return { success: true, data: res.data, statusCode: 200 };
  },

  getQuestionnaires(projectId: string, userId?: string): Promise<ServiceResult<Questionnaire[]>> {
    return this.getByProject(projectId, userId);
  },

  async getQuestionnaire(
    questionnaireId: string,
    projectId: string,
    userId?: string
  ): Promise<ServiceResult<Questionnaire>> {
    const res = await QuestionnaireRepository.getById(projectId, questionnaireId);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Questionnaire not found',
        statusCode: (res.status as any) || 404,
      };
    }

    return { success: true, data: res.data, statusCode: 200 };
  },

  async getVersions(
    questionnaireId: string,
    projectId: string,
    userId?: string
  ): Promise<ServiceResult<QuestionnaireVersion[]>> {
    const res = await QuestionnaireRepository.getVersions(projectId, questionnaireId);
    const vList = res.data || [];
    memoryVersions.set(questionnaireId, vList);
    return { success: res.success, data: vList, statusCode: (res.status as any) || 200 };
  },

  getBySlug(slug: string): ServiceResult<PublicQuestionnaireDTO> {
    const qList = this._getAllQuestionnaires();
    const q = qList.find(item => item.publicSlug === slug);
    if (!q) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }
    const dto: PublicQuestionnaireDTO = {
      id: q.id,
      publicSlug: q.publicSlug,
      title: q.title,
      introduction: q.introduction,
      consentStatement: q.consentStatement,
      closingMessage: q.closingMessage,
      responseMode: q.responseMode,
      status: q.status,
      currentVersion: q.currentVersion,
      currentVersionId: `v_${q.id}_${q.currentVersion}`,
      startDate: q.startDate,
      endDate: q.endDate,
      items: [],
    };
    return { success: true, data: dto, statusCode: 200 };
  },

  async createFromApprovedInstrument(
    projectId: string,
    instrumentId: string,
    userId: string,
    userName: string,
    payload: {
      title?: string;
      publicSlug?: string;
      targetResponses?: number;
      allowAnonymous?: boolean;
      requireConsent?: boolean;
      consentStatement?: string;
      introduction?: string;
      closingMessage?: string;
      collectDemographics?: boolean;
      demographicFields?: string[];
      randomizeItems?: boolean;
      instrumentVersionId?: string;
      responseMode?: any;
      startDate?: string;
      endDate?: string;
      maxResponses?: number;
    }
  ): Promise<ServiceResult<Questionnaire>> {
    const res = await QuestionnaireRepository.create(projectId, {
      instrumentId,
      ...payload,
    });

    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to create questionnaire from approved instrument',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getByProject(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_created',
      entityType: 'questionnaire',
      entityId: res.data.id,
      entityName: res.data.title,
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  async updateSettings(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    updates: Partial<Questionnaire>
  ): Promise<ServiceResult<Questionnaire>> {
    const res = await QuestionnaireRepository.update(projectId, questionnaireId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update questionnaire settings',
        statusCode: (res.status as any) || 400,
      };
    }

    const qRes = await this.getQuestionnaire(questionnaireId, projectId, userId);
    await this.getByProject(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_settings_updated',
      entityType: 'questionnaire',
      entityId: questionnaireId,
      entityName: qRes.data ? qRes.data.title : questionnaireId,
      metadata: updates,
    });

    return { success: true, data: qRes.data, statusCode: 200 };
  },

  async publish(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    payload?: string | {
      targetResponses?: number;
      allowAnonymous?: boolean;
      requireConsent?: boolean;
      consentStatement?: string;
      introduction?: string;
      closingMessage?: string;
      notes?: string;
      changeSummary?: string;
    }
  ): Promise<ServiceResult<any>> {
    const publishPayload = typeof payload === 'string' ? { notes: payload, changeSummary: payload } : payload;
    const res = await QuestionnaireRepository.publish(projectId, questionnaireId, publishPayload);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to publish questionnaire',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getByProject(projectId, userId);
    await this.getVersions(questionnaireId, projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_published',
      entityType: 'questionnaire',
      entityId: questionnaireId,
      entityName: questionnaireId,
      metadata: { versionId: res.versionId },
    });

    return { success: true, data: res, statusCode: 200 };
  },

  async pause(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    _reason?: string
  ): Promise<ServiceResult<Questionnaire>> {
    const res = await QuestionnaireRepository.pause(projectId, questionnaireId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to pause questionnaire',
        statusCode: (res.status as any) || 400,
      };
    }

    const qRes = await this.getQuestionnaire(questionnaireId, projectId, userId);
    await this.getByProject(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_paused',
      entityType: 'questionnaire',
      entityId: questionnaireId,
      entityName: qRes.data ? qRes.data.title : questionnaireId,
      metadata: { status: 'Paused' },
    });

    return { success: true, data: qRes.data, statusCode: 200 };
  },

  async resume(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<Questionnaire>> {
    const res = await QuestionnaireRepository.resume(projectId, questionnaireId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to resume questionnaire',
        statusCode: (res.status as any) || 400,
      };
    }

    const qRes = await this.getQuestionnaire(questionnaireId, projectId, userId);
    await this.getByProject(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_resumed',
      entityType: 'questionnaire',
      entityId: questionnaireId,
      entityName: qRes.data ? qRes.data.title : questionnaireId,
      metadata: { status: 'Active' },
    });

    return { success: true, data: qRes.data, statusCode: 200 };
  },

  async close(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    _reason?: string
  ): Promise<ServiceResult<Questionnaire>> {
    const res = await QuestionnaireRepository.close(projectId, questionnaireId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to close questionnaire',
        statusCode: (res.status as any) || 400,
      };
    }

    const qRes = await this.getQuestionnaire(questionnaireId, projectId, userId);
    await this.getByProject(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_closed',
      entityType: 'questionnaire',
      entityId: questionnaireId,
      entityName: qRes.data ? qRes.data.title : questionnaireId,
      metadata: { status: 'Closed' },
    });

    return { success: true, data: qRes.data, statusCode: 200 };
  },

  async archive(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<Questionnaire>> {
    return this.close(questionnaireId, projectId, userId, userName);
  },
};
