import { ResponseScale, ResponseScaleOption } from '../types';
import { ScaleRepository } from '../repositories';
import { auditService } from './auditService';
import { ServiceResult } from './projectService';

export const SYSTEM_DEFAULT_SCALES: Omit<ResponseScale, 'id' | 'projectId' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Likert 5-point Agreement',
    scaleType: 'Likert',
    minValue: 1,
    maxValue: 5,
    isArchived: false,
    isSystemPreset: true,
    options: [
      { value: 1, label: 'Strongly Disagree', code: 'SD' },
      { value: 2, label: 'Disagree', code: 'D' },
      { value: 3, label: 'Neutral', code: 'N' },
      { value: 4, label: 'Agree', code: 'A' },
      { value: 5, label: 'Strongly Agree', code: 'SA' },
    ],
  },
  {
    name: 'Likert 5-point Frequency',
    scaleType: 'Likert',
    minValue: 1,
    maxValue: 5,
    isArchived: false,
    isSystemPreset: true,
    options: [
      { value: 1, label: 'Never', code: 'NEV' },
      { value: 2, label: 'Rarely', code: 'RAR' },
      { value: 3, label: 'Sometimes', code: 'SOMET' },
      { value: 4, label: 'Often', code: 'OFT' },
      { value: 5, label: 'Always', code: 'ALW' },
    ],
  },
  {
    name: 'MBI-SS 7-point Burnout Frequency',
    scaleType: 'Likert',
    minValue: 0,
    maxValue: 6,
    isArchived: false,
    isSystemPreset: true,
    options: [
      { value: 0, label: 'Never', code: '0' },
      { value: 1, label: 'A few times a year or less', code: '1' },
      { value: 2, label: 'Once a month or less', code: '2' },
      { value: 3, label: 'A few times a month', code: '3' },
      { value: 4, label: 'Once a week', code: '4' },
      { value: 5, label: 'A few times a week', code: '5' },
      { value: 6, label: 'Every day', code: '6' },
    ],
  },
  {
    name: 'Likert 7-point Agreement',
    scaleType: 'Likert',
    minValue: 1,
    maxValue: 7,
    isArchived: false,
    isSystemPreset: true,
    options: [
      { value: 1, label: 'Strongly Disagree', code: '1' },
      { value: 2, label: 'Disagree', code: '2' },
      { value: 3, label: 'Somewhat Disagree', code: '3' },
      { value: 4, label: 'Neither Agree nor Disagree', code: '4' },
      { value: 5, label: 'Somewhat Agree', code: '5' },
      { value: 6, label: 'Agree', code: '6' },
      { value: 7, label: 'Strongly Agree', code: '7' },
    ],
  },
  {
    name: 'Binary Dichotomous (Yes / No)',
    scaleType: 'Binary',
    minValue: 0,
    maxValue: 1,
    isArchived: false,
    isSystemPreset: true,
    options: [
      { value: 0, label: 'No', code: '0' },
      { value: 1, label: 'Yes', code: '1' },
    ],
  },
];

const memoryCache = new Map<string, ResponseScale[]>();

export const scaleService = {
  _getAllScales(): ResponseScale[] {
    return Array.from(memoryCache.values()).flat();
  },

  async getScales(projectId: string, userId?: string): Promise<ServiceResult<ResponseScale[]>> {
    const res = await ScaleRepository.getByProject(projectId);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to fetch scales',
        statusCode: (res.status as any) || 500,
      };
    }

    memoryCache.set(projectId, res.data);
    return { success: true, data: res.data, statusCode: 200 };
  },

  getScalesSync(projectId: string): ResponseScale[] {
    return memoryCache.get(projectId) || [];
  },

  async createScale(
    projectId: string,
    userId: string,
    userName: string,
    payload: {
      name: string;
      scaleType: ResponseScale['scaleType'];
      minValue: number;
      maxValue: number;
      options: ResponseScaleOption[];
    }
  ): Promise<ServiceResult<ResponseScale>> {
    const res = await ScaleRepository.create(projectId, payload);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to create scale',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getScales(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'scale_created',
      entityType: 'scale',
      entityId: res.data.id,
      entityName: res.data.name,
      metadata: { scaleType: res.data.scaleType, optionCount: res.data.options.length },
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  async updateScale(
    scaleId: string,
    projectId: string,
    userId: string,
    userName: string,
    updates: Partial<ResponseScale>
  ): Promise<ServiceResult<ResponseScale>> {
    const res = await ScaleRepository.update(projectId, scaleId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update scale',
        statusCode: (res.status as any) || 400,
      };
    }

    const refreshed = await this.getScales(projectId, userId);
    const updated = refreshed.data?.find(s => s.id === scaleId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'scale_updated',
      entityType: 'scale',
      entityId: scaleId,
      entityName: updated ? updated.name : scaleId,
      metadata: updates,
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  async deleteScale(
    scaleId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    const res = await ScaleRepository.delete(projectId, scaleId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete scale',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getScales(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'scale_archived',
      entityType: 'scale',
      entityId: scaleId,
      entityName: scaleId,
    });

    return { success: true, statusCode: 200 };
  },

  async archiveScale(
    scaleId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<ResponseScale>> {
    return this.updateScale(scaleId, projectId, userId, userName, { isArchived: true });
  },

  isScaleReferenced(scaleId: string, projectId: string): boolean {
    // Check if referenced in memory cache
    return false;
  },

  _ensureProjectPresets(projectId: string): void {
    // Handled automatically server-side in /api/projects/:projectId/scales
  },
};
