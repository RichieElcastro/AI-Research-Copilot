import { ResponseScale, ResponseScaleOption } from '../types';
import { auditService } from './auditService';
import { projectService, ServiceResult } from './projectService';
import { storage } from './storage';

const SCALES_KEY = 'response_scales';

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

export const scaleService = {
  _getAllScales(): ResponseScale[] {
    return storage.get<ResponseScale[]>(SCALES_KEY, []);
  },

  _saveScales(scales: ResponseScale[]): void {
    storage.set(SCALES_KEY, scales);
  },

  /**
   * Initialize default presets for a project if none exist yet
   */
  _ensureProjectPresets(projectId: string): ResponseScale[] {
    const all = this._getAllScales();
    const existing = all.filter(s => s.projectId === projectId);
    if (existing.length > 0) {
      return existing;
    }

    const now = new Date().toISOString();
    const createdPresets: ResponseScale[] = SYSTEM_DEFAULT_SCALES.map((preset, index) => ({
      ...preset,
      id: `scale_${projectId.replace(/[^a-zA-Z0-9]/g, '')}_preset_${index + 1}`,
      projectId,
      createdAt: now,
      updatedAt: now,
    }));

    const updated = [...all, ...createdPresets];
    this._saveScales(updated);
    return createdPresets;
  },

  /**
   * Get all response scales for a specific project
   */
  getScales(projectId: string, userId: string): ServiceResult<ResponseScale[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    this._ensureProjectPresets(projectId);
    const all = this._getAllScales();
    const projectScales = all.filter(s => s.projectId === projectId);
    return { success: true, data: projectScales, statusCode: 200 };
  },

  /**
   * Get a single scale by ID
   */
  getScale(scaleId: string, projectId: string, userId: string): ServiceResult<ResponseScale> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllScales();
    const scale = all.find(s => s.id === scaleId && s.projectId === projectId);
    if (!scale) {
      return { success: false, error: 'Response scale not found.', statusCode: 404 };
    }

    return { success: true, data: scale, statusCode: 200 };
  },

  /**
   * Validate scale configuration
   */
  validateScaleConfig(scale: {
    name: string;
    minValue: number;
    maxValue: number;
    options: ResponseScaleOption[];
  }): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!scale.name || scale.name.trim().length === 0) {
      errors.push('Scale name is required.');
    }

    if (!Array.isArray(scale.options) || scale.options.length < 2) {
      errors.push('Response scale must contain at least 2 response options.');
      return { isValid: false, errors };
    }

    const values = new Set<number>();
    for (let i = 0; i < scale.options.length; i++) {
      const opt = scale.options[i];
      if (opt.value === undefined || opt.value === null || isNaN(opt.value)) {
        errors.push(`Option ${i + 1} has an invalid or missing numeric value.`);
      } else if (values.has(opt.value)) {
        errors.push(`Duplicate numeric coding value (${opt.value}) detected. Values must be unique.`);
      } else {
        values.add(opt.value);
      }

      if (!opt.label || opt.label.trim().length === 0) {
        errors.push(`Option ${i + 1} label cannot be empty.`);
      }
    }

    if (scale.minValue >= scale.maxValue) {
      errors.push('Minimum scale value must be strictly less than maximum scale value.');
    }

    return { isValid: errors.length === 0, errors };
  },

  /**
   * Create a new custom response scale
   */
  createScale(
    projectId: string,
    userId: string,
    userName: string,
    data: {
      name: string;
      scaleType: ResponseScale['scaleType'];
      minValue: number;
      maxValue: number;
      options: ResponseScaleOption[];
    }
  ): ServiceResult<ResponseScale> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const validation = this.validateScaleConfig(data);
    if (!validation.isValid) {
      return { success: false, error: validation.errors.join(' '), statusCode: 400 };
    }

    // Sort options in ascending numerical order for deterministic coding
    const sortedOptions = [...data.options].sort((a, b) => a.value - b.value);

    const now = new Date().toISOString();
    const newScale: ResponseScale = {
      id: `scale_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      name: data.name.trim(),
      scaleType: data.scaleType,
      minValue: sortedOptions[0].value,
      maxValue: sortedOptions[sortedOptions.length - 1].value,
      options: sortedOptions,
      isArchived: false,
      isSystemPreset: false,
      createdAt: now,
      updatedAt: now,
    };

    const all = this._getAllScales();
    this._saveScales([...all, newScale]);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'scale_created',
      entityType: 'scale',
      entityId: newScale.id,
      entityName: newScale.name,
      metadata: {
        scaleType: newScale.scaleType,
        range: `${newScale.minValue} - ${newScale.maxValue}`,
        optionCount: newScale.options.length,
      },
    });

    return { success: true, data: newScale, statusCode: 201 };
  },

  /**
   * Update an existing response scale
   */
  updateScale(
    scaleId: string,
    projectId: string,
    userId: string,
    userName: string,
    data: Partial<ResponseScale>
  ): ServiceResult<ResponseScale> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllScales();
    const index = all.findIndex(s => s.id === scaleId && s.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Response scale not found.', statusCode: 404 };
    }

    const existing = all[index];

    if (data.options || data.minValue !== undefined || data.maxValue !== undefined) {
      const options = data.options || existing.options;
      const validation = this.validateScaleConfig({
        name: data.name || existing.name,
        minValue: data.minValue ?? existing.minValue,
        maxValue: data.maxValue ?? existing.maxValue,
        options,
      });

      if (!validation.isValid) {
        return { success: false, error: validation.errors.join(' '), statusCode: 400 };
      }
    }

    const updatedOptions = data.options
      ? [...data.options].sort((a, b) => a.value - b.value)
      : existing.options;

    const updated: ResponseScale = {
      ...existing,
      ...data,
      options: updatedOptions,
      minValue: updatedOptions.length > 0 ? updatedOptions[0].value : existing.minValue,
      maxValue: updatedOptions.length > 0 ? updatedOptions[updatedOptions.length - 1].value : existing.maxValue,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    this._saveScales(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'scale_updated',
      entityType: 'scale',
      entityId: updated.id,
      entityName: updated.name,
      metadata: {
        previousName: existing.name,
        updatedFields: Object.keys(data),
      },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Archive / Deactivate a scale so no new items can use it without destroying past integrity
   */
  archiveScale(
    scaleId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<ResponseScale> {
    return this.updateScale(scaleId, projectId, userId, userName, { isArchived: true });
  },

  /**
   * Check if a scale is referenced by any instrument items
   */
  isScaleReferenced(scaleId: string, projectId: string): boolean {
    const items = storage.get<{ projectId: string; responseScaleId?: string }[]>('instrument_items', []);
    return items.some(it => it.projectId === projectId && it.responseScaleId === scaleId);
  },

  /**
   * Delete a scale. Destructive deletion is blocked if items are currently referencing it.
   */
  deleteScale(
    scaleId: string,
    projectId: string,
    userId: string,
    userName: string,
    isScaleReferencedCheck?: (scaleId: string) => boolean
  ): ServiceResult<boolean> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllScales();
    const scale = all.find(s => s.id === scaleId && s.projectId === projectId);
    if (!scale) {
      return { success: false, error: 'Scale not found.', statusCode: 404 };
    }

    // Check if referenced
    if (this.isScaleReferenced(scaleId, projectId) || (isScaleReferencedCheck && isScaleReferencedCheck(scaleId))) {
      return {
        success: false,
        error:
          'Integrity Violation: Cannot delete response scale because it is referenced by one or more instrument items. Use "Archive" to deactivate it safely instead.',
        statusCode: 409,
      };
    }

    const remaining = all.filter(s => s.id !== scaleId);
    this._saveScales(remaining);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'scale_archived',
      entityType: 'scale',
      entityId: scaleId,
      entityName: scale.name,
      metadata: { deleted: true },
    });

    return { success: true, data: true, statusCode: 200 };
  },
};
