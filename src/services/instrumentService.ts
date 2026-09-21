import {
  Instrument,
  InstrumentItem,
  InstrumentStatus,
  InstrumentValidationIssue,
  InstrumentValidationReport,
  InstrumentVersion,
} from '../types';
import { InstrumentRepository } from '../repositories';
import { auditService } from './auditService';
import { ServiceResult } from './projectService';

const memoryInstruments = new Map<string, Instrument[]>();
const memoryItems = new Map<string, InstrumentItem[]>();
const memoryVersions = new Map<string, InstrumentVersion[]>();

export const instrumentService = {
  _getAllInstruments(): Instrument[] {
    return Array.from(memoryInstruments.values()).flat();
  },

  _getAllItems(): InstrumentItem[] {
    return Array.from(memoryItems.values()).flat();
  },

  _getAllVersions(): InstrumentVersion[] {
    return Array.from(memoryVersions.values()).flat();
  },

  async getInstruments(projectId: string, userId?: string): Promise<ServiceResult<Instrument[]>> {
    const res = await InstrumentRepository.getByProject(projectId);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to fetch instruments',
        statusCode: (res.status as any) || 500,
      };
    }

    memoryInstruments.set(projectId, res.data);
    return { success: true, data: res.data, statusCode: 200 };
  },

  async getInstrument(
    instrumentId: string,
    projectId: string,
    userId?: string
  ): Promise<ServiceResult<Instrument & { items: InstrumentItem[] }>> {
    const res = await InstrumentRepository.getById(projectId, instrumentId);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Instrument not found',
        statusCode: (res.status as any) || 404,
      };
    }

    memoryItems.set(instrumentId, res.data.items || []);
    return { success: true, data: res.data, statusCode: 200 };
  },

  getInstrumentSync(instrumentId: string, projectId: string): (Instrument & { items: InstrumentItem[] }) | undefined {
    const inst = (memoryInstruments.get(projectId) || []).find(i => i.id === instrumentId);
    if (!inst) return undefined;
    const items = memoryItems.get(instrumentId) || [];
    return { ...inst, items };
  },

  async createInstrument(
    projectId: string,
    userId: string,
    userName: string,
    payload: {
      name: string;
      code: string;
      description?: string;
      purpose?: string;
      sourceType?: string;
      sourceReference?: string;
      variableIds?: string[];
    }
  ): Promise<ServiceResult<Instrument>> {
    const res = await InstrumentRepository.create(projectId, payload);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to create instrument',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getInstruments(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_created',
      entityType: 'instrument',
      entityId: res.data.id,
      entityName: `${res.data.code}: ${res.data.name}`,
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  async updateInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    updates: Partial<Instrument>
  ): Promise<ServiceResult<Instrument>> {
    const res = await InstrumentRepository.update(projectId, instrumentId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update instrument',
        statusCode: (res.status as any) || 400,
      };
    }

    const refreshed = await this.getInstrument(instrumentId, projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_updated',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: refreshed.data ? `${refreshed.data.code}: ${refreshed.data.name}` : instrumentId,
      metadata: updates,
    });

    return { success: true, data: refreshed.data, statusCode: 200 };
  },

  async deleteInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    const res = await InstrumentRepository.delete(projectId, instrumentId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete instrument',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getInstruments(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_deleted',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: instrumentId,
    });

    return { success: true, statusCode: 200 };
  },

  async archiveInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<Instrument>> {
    return this.updateInstrument(instrumentId, projectId, userId, userName, { status: 'Archived' });
  },

  async createItem(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    payload: {
      questionText: string;
      itemCode?: string;
      scaleId: string;
      variableId?: string;
      dimensionId?: string;
      indicatorId?: string;
      reverseCoded?: boolean;
      instructions?: string;
      required?: boolean;
    }
  ): Promise<ServiceResult<InstrumentItem>> {
    const res = await InstrumentRepository.addItem(projectId, instrumentId, payload);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to add item',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getInstrument(instrumentId, projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'item_created',
      entityType: 'item',
      entityId: res.data.id,
      entityName: res.data.itemCode || res.data.questionText,
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  async updateItem(
    itemId: string,
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    updates: Partial<InstrumentItem>
  ): Promise<ServiceResult<InstrumentItem>> {
    const res = await InstrumentRepository.updateItem(projectId, instrumentId, itemId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update item',
        statusCode: (res.status as any) || 400,
      };
    }

    const inst = await this.getInstrument(instrumentId, projectId, userId);
    const updated = inst.data?.items.find(i => i.id === itemId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'item_updated',
      entityType: 'item',
      entityId: itemId,
      entityName: updated ? updated.itemCode || updated.questionText : itemId,
      metadata: updates,
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  async deleteItem(
    itemId: string,
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    const res = await InstrumentRepository.deleteItem(projectId, instrumentId, itemId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete item',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getInstrument(instrumentId, projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'item_deleted',
      entityType: 'item',
      entityId: itemId,
      entityName: itemId,
    });

    return { success: true, statusCode: 200 };
  },

  async duplicateItem(
    itemId: string,
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<InstrumentItem>> {
    const inst = await this.getInstrument(instrumentId, projectId, userId);
    const target = inst.data?.items.find(i => i.id === itemId);
    if (!target) {
      return { success: false, error: 'Item not found', statusCode: 404 };
    }

    return this.createItem(instrumentId, projectId, userId, userName, {
      questionText: `${target.questionText} (Copy)`,
      itemCode: target.itemCode ? `${target.itemCode}_COPY` : undefined,
      scaleId: (target as any).scaleId || target.responseScaleId,
      variableId: target.variableId,
      dimensionId: target.dimensionId,
      indicatorId: target.indicatorId,
      reverseCoded: target.reverseCoded,
      instructions: (target as any).instructions || target.notes,
      required: target.required,
    });
  },

  async reorderItems(
    instrumentId: string,
    projectId: string,
    itemIds: string[],
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    // Update order indices
    for (let i = 0; i < itemIds.length; i++) {
      await InstrumentRepository.updateItem(projectId, instrumentId, itemIds[i], { orderIndex: i + 1 });
    }
    await this.getInstrument(instrumentId, projectId, userId);
    return { success: true, statusCode: 200 };
  },

  async approveInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    notes?: string
  ): Promise<ServiceResult<{ versionId: string; versionNumber?: number; version?: string }>> {
    const res = await InstrumentRepository.approve(projectId, instrumentId);
    if (!res.success || !res.versionId) {
      return {
        success: false,
        error: res.error || 'Failed to approve instrument',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getInstrument(instrumentId, projectId, userId);
    await this.getInstruments(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_approved',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: instrumentId,
      metadata: { versionId: res.versionId, versionNumber: res.versionNumber, version: res.version },
    });

    return {
      success: true,
      data: { versionId: res.versionId, versionNumber: res.versionNumber, version: res.version },
      statusCode: 200,
    };
  },

  createInstrumentVersion(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    notes?: string
  ) {
    return this.approveInstrument(instrumentId, projectId, userId, userName, notes);
  },

  async branchInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<Instrument>> {
    const res = await InstrumentRepository.branch(projectId, instrumentId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to branch instrument',
        statusCode: (res.statusCode as any) || 400,
      };
    }

    const refreshed = await this.getInstrument(instrumentId, projectId, userId);
    await this.getInstruments(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_updated',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: refreshed.data ? refreshed.data.name : instrumentId,
      metadata: { action: 'branched_to_draft', newVersion: res.version },
    });

    return { success: true, data: refreshed.data, statusCode: 200 };
  },

  async getInstrumentVersions(
    instrumentId: string,
    projectId: string,
    userId?: string
  ): Promise<ServiceResult<InstrumentVersion[]>> {
    const versions = await InstrumentRepository.getVersions(projectId, instrumentId);
    memoryVersions.set(instrumentId, versions);
    return { success: true, data: versions, statusCode: 200 };
  },

  async validateInstrument(
    instrumentId: string,
    projectId: string,
    userId?: string
  ): Promise<ServiceResult<InstrumentValidationReport>> {
    const instRes = await this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return {
        success: false,
        error: 'Instrument not found for validation',
        statusCode: 404,
      };
    }

    const items = instRes.data.items || [];
    const errors: InstrumentValidationIssue[] = [];
    const warnings: InstrumentValidationIssue[] = [];

    if (items.length === 0) {
      errors.push({
        type: 'error',
        message: 'Instrument has no measurement items. At least 1 item is required.',
      });
    }

    items.forEach(item => {
      if (!item.questionText || !item.questionText.trim()) {
        errors.push({
          type: 'error',
          itemId: item.id,
          itemCode: item.itemCode,
          message: `Item ${item.itemCode || item.id} has empty question text.`,
        });
      }
      if (!item.responseScaleId && !(item as any).scaleId) {
        errors.push({
          type: 'error',
          itemId: item.id,
          itemCode: item.itemCode,
          message: `Item ${item.itemCode || item.id} is missing a response scale assignment.`,
        });
      }
    });

    const report: InstrumentValidationReport = {
      isValidForApproval: errors.length === 0,
      errors,
      warnings,
      summary: {
        hasMetadata: Boolean((instRes.data as any).name || (instRes.data as any).title),
        hasVariables: items.some(i => Boolean(i.variableId)),
        itemCount: items.length,
        scalesConfigured: items.length > 0 && items.every(i => Boolean(i.responseScaleId || (i as any).scaleId)),
        codingValid: true,
        indicatorsMapped: items.some(i => Boolean(i.indicatorId)),
      },
    };

    return { success: true, data: report, statusCode: 200 };
  },

  async exportAIContext(
    instrumentId: string,
    projectId: string,
    userId?: string
  ): Promise<ServiceResult<any>> {
    const instRes = await this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found', statusCode: 404 };
    }

    return {
      success: true,
      data: {
        instrument: instRes.data,
        items: instRes.data.items,
      },
      statusCode: 200,
    };
  },
};
