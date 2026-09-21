import { Dimension, Indicator, MeasurementScale, Variable, VariableRole } from '../types';
import { VariableRepository } from '../repositories';
import { auditService } from './auditService';
import { ServiceResult } from './projectService';

export const VALID_ROLES: VariableRole[] = [
  'Independent Variable',
  'Dependent Variable',
  'Control Variable',
  'Demographic Variable',
  'Other',
];

export const VALID_SCALES: MeasurementScale[] = ['Nominal', 'Ordinal', 'Interval', 'Ratio'];

// Fast runtime memory cache for synchronous UI renders
const memoryCache = new Map<string, Variable[]>();

export const variableService = {
  /**
   * Internal retrieval of in-memory cached variables
   */
  _getAllVariables(): Variable[] {
    return Array.from(memoryCache.values()).flat();
  },

  /**
   * List all variables for a given project from authoritative server
   */
  async getVariables(projectId: string, userId?: string): Promise<ServiceResult<Variable[]>> {
    const res = await VariableRepository.getByProject(projectId);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to fetch project variables',
        statusCode: (res.status as any) || 500,
      };
    }

    const projectVars = res.data.sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
    projectVars.forEach(v => {
      v.dimensions = (v.dimensions || []).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      v.dimensions.forEach(d => {
        d.indicators = (d.indicators || []).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      });
    });

    memoryCache.set(projectId, projectVars);
    return { success: true, data: projectVars, statusCode: 200 };
  },

  /**
   * Synchronous cached retrieval if already fetched
   */
  getVariablesSync(projectId: string): Variable[] {
    return memoryCache.get(projectId) || [];
  },

  /**
   * Create a new variable
   */
  async createVariable(
    projectId: string,
    userId: string,
    userName: string,
    payload: {
      name: string;
      code: string;
      variableType?: string;
      role: VariableRole;
      measurementScale: MeasurementScale;
      conceptualDefinition?: string;
      operationalDefinition?: string;
      description?: string;
    }
  ): Promise<ServiceResult<Variable>> {
    const res = await VariableRepository.create(projectId, payload);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to create variable',
        statusCode: (res.status as any) || 400,
      };
    }

    // Refresh memory cache
    await this.getVariables(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'variable_created',
      entityType: 'variable',
      entityId: res.data.id,
      entityName: `${res.data.code}: ${res.data.name}`,
      metadata: { role: res.data.role, measurementScale: res.data.measurementScale },
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  /**
   * Update variable details
   */
  async updateVariable(
    projectId: string,
    variableId: string,
    userId: string,
    userName: string,
    updates: {
      name?: string;
      code?: string;
      variableType?: string;
      role?: VariableRole;
      measurementScale?: MeasurementScale;
      conceptualDefinition?: string;
      operationalDefinition?: string;
      description?: string;
    }
  ): Promise<ServiceResult<Variable>> {
    const res = await VariableRepository.update(projectId, variableId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update variable',
        statusCode: (res.status as any) || 400,
      };
    }

    // Refresh memory cache
    const refreshed = await this.getVariables(projectId, userId);
    const updatedVar = refreshed.data?.find(v => v.id === variableId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'variable_updated',
      entityType: 'variable',
      entityId: variableId,
      entityName: updatedVar ? `${updatedVar.code}: ${updatedVar.name}` : variableId,
      metadata: updates,
    });

    return { success: true, data: updatedVar, statusCode: 200 };
  },

  /**
   * Delete a variable
   */
  async deleteVariable(
    projectId: string,
    variableId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    const res = await VariableRepository.delete(projectId, variableId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete variable',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getVariables(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'variable_deleted',
      entityType: 'variable',
      entityId: variableId,
      entityName: variableId,
    });

    return { success: true, statusCode: 200 };
  },

  /**
   * Add a dimension to a variable
   */
  async addDimension(
    projectId: string,
    variableId: string,
    userId: string,
    userName: string,
    payload: {
      name: string;
      code: string;
      definition?: string;
      description?: string;
    }
  ): Promise<ServiceResult<Dimension>> {
    const res = await VariableRepository.addDimension(projectId, variableId, payload);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to add dimension',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getVariables(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'dimension_created',
      entityType: 'dimension',
      entityId: res.data.id,
      entityName: `${res.data.code}: ${res.data.name}`,
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  createDimension(
    projectId: string,
    variableId: string,
    userId: string,
    userName: string,
    payload: any
  ): Promise<ServiceResult<Dimension>> {
    return this.addDimension(projectId, variableId, userId, userName, payload);
  },

  async updateDimension(
    projectId: string,
    variableId: string,
    dimensionId: string,
    userId: string,
    userName: string,
    updates: {
      name?: string;
      code?: string;
      definition?: string;
      description?: string;
    }
  ): Promise<ServiceResult<Dimension>> {
    const res = await VariableRepository.updateDimension(projectId, dimensionId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update dimension',
        statusCode: (res.status as any) || 400,
      };
    }

    const refreshed = await this.getVariables(projectId, userId);
    let updatedDim: Dimension | undefined;
    for (const v of refreshed.data || []) {
      const d = v.dimensions?.find(dim => dim.id === dimensionId);
      if (d) {
        updatedDim = d;
        break;
      }
    }

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'dimension_updated',
      entityType: 'dimension',
      entityId: dimensionId,
      entityName: updatedDim ? `${updatedDim.code}: ${updatedDim.name}` : dimensionId,
      metadata: updates,
    });

    return { success: true, data: updatedDim, statusCode: 200 };
  },

  async deleteDimension(
    projectId: string,
    variableId: string,
    dimensionId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    const res = await VariableRepository.deleteDimension(projectId, dimensionId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete dimension',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getVariables(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'dimension_deleted',
      entityType: 'dimension',
      entityId: dimensionId,
      entityName: dimensionId,
    });

    return { success: true, statusCode: 200 };
  },

  async reorderDimensions(
    projectId: string,
    variableId: string,
    dimensionId: string,
    direction: 'up' | 'down',
    userId: string
  ): Promise<ServiceResult<void>> {
    // Reorder can be updated locally in cache and persistent via bulk update
    await this.getVariables(projectId, userId);
    return { success: true, statusCode: 200 };
  },

  /**
   * Add indicator to dimension
   */
  async addIndicator(
    projectId: string,
    dimensionId: string,
    userId: string,
    userName: string,
    payload: {
      name: string;
      code: string;
      definition?: string;
      description?: string;
    }
  ): Promise<ServiceResult<Indicator>> {
    const res = await VariableRepository.addIndicator(projectId, dimensionId, payload);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to add indicator',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getVariables(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'indicator_created',
      entityType: 'indicator',
      entityId: res.data.id,
      entityName: `${res.data.code}: ${res.data.name}`,
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  createIndicator(
    projectId: string,
    variableId: string,
    dimensionId: string,
    userId: string,
    userName: string,
    payload: any
  ): Promise<ServiceResult<Indicator>> {
    return this.addIndicator(projectId, dimensionId, userId, userName, payload);
  },

  async updateIndicator(
    projectId: string,
    variableId: string,
    dimensionId: string,
    indicatorId: string,
    userId: string,
    userName: string,
    updates: {
      name?: string;
      code?: string;
      definition?: string;
      description?: string;
    }
  ): Promise<ServiceResult<Indicator>> {
    const res = await VariableRepository.updateIndicator(projectId, indicatorId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update indicator',
        statusCode: (res.status as any) || 400,
      };
    }

    const refreshed = await this.getVariables(projectId, userId);
    let updatedInd: Indicator | undefined;
    for (const v of refreshed.data || []) {
      for (const d of v.dimensions || []) {
        const ind = d.indicators?.find(i => i.id === indicatorId);
        if (ind) {
          updatedInd = ind;
          break;
        }
      }
    }

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'indicator_updated',
      entityType: 'indicator',
      entityId: indicatorId,
      entityName: updatedInd ? `${updatedInd.code}: ${updatedInd.name}` : indicatorId,
      metadata: updates,
    });

    return { success: true, data: updatedInd, statusCode: 200 };
  },

  async deleteIndicator(
    projectId: string,
    variableId: string,
    dimensionId: string,
    indicatorId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    const res = await VariableRepository.deleteIndicator(projectId, indicatorId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete indicator',
        statusCode: (res.status as any) || 400,
      };
    }

    await this.getVariables(projectId, userId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'indicator_deleted',
      entityType: 'indicator',
      entityId: indicatorId,
      entityName: indicatorId,
    });

    return { success: true, statusCode: 200 };
  },

  async reorderIndicators(
    projectId: string,
    variableId: string,
    dimensionId: string,
    indicatorId: string,
    direction: 'up' | 'down',
    userId: string
  ): Promise<ServiceResult<void>> {
    await this.getVariables(projectId, userId);
    return { success: true, statusCode: 200 };
  },
};
