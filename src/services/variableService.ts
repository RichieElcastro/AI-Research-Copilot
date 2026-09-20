import { DEMO_PROJECT_ID, DEMO_VARIABLES } from '../data/demoData';
import { Dimension, Indicator, MeasurementScale, Variable, VariableRole } from '../types';
import { auditService } from './auditService';
import { projectService, ServiceResult } from './projectService';
import { storage } from './storage';

const VARIABLES_KEY = 'variables';

export const VALID_ROLES: VariableRole[] = [
  'Independent Variable',
  'Dependent Variable',
  'Control Variable',
  'Demographic Variable',
  'Other',
];

export const VALID_SCALES: MeasurementScale[] = ['Nominal', 'Ordinal', 'Interval', 'Ratio'];

export const variableService = {
  /**
   * Internal retrieval of stored variables
   */
  _getAllVariables(): Variable[] {
    const vars = storage.get<Variable[]>(VARIABLES_KEY, []);
    if (vars.length === 0) {
      storage.set(VARIABLES_KEY, DEMO_VARIABLES);
      return DEMO_VARIABLES;
    }
    return vars;
  },

  /**
   * List all variables for a given project, with strict project-level authorization
   */
  getVariables(projectId: string, userId: string): ServiceResult<Variable[]> {
    // 1. Authorize user for this project
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const projectVars = all
      .filter(v => v.projectId === projectId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));

    // Ensure nested dimensions and indicators are sorted
    projectVars.forEach(v => {
      v.dimensions = (v.dimensions || []).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      v.dimensions.forEach(d => {
        d.indicators = (d.indicators || []).sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
      });
    });

    return { success: true, data: projectVars, statusCode: 200 };
  },

  /**
   * Create a new variable
   */
  createVariable(
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
  ): ServiceResult<Variable> {
    // 1. Authorize user for this project
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    // 2. Validate input fields
    const name = payload.name?.trim();
    const code = payload.code?.trim().toUpperCase();

    if (!name) {
      return { success: false, error: 'Variable name is required and cannot be empty.', statusCode: 400 };
    }
    if (!code) {
      return { success: false, error: 'Variable code is required (e.g., X1, Y1, C1).', statusCode: 400 };
    }
    if (!VALID_ROLES.includes(payload.role)) {
      return { success: false, error: `Invalid variable role: "${payload.role}".`, statusCode: 400 };
    }
    if (!VALID_SCALES.includes(payload.measurementScale)) {
      return { success: false, error: `Invalid measurement scale: "${payload.measurementScale}".`, statusCode: 400 };
    }

    // 3. Ensure variable code is unique within the project
    const all = this._getAllVariables();
    const isDuplicate = all.some(
      v => v.projectId === projectId && v.code.toUpperCase() === code
    );
    if (isDuplicate) {
      return {
        success: false,
        error: `Variable code "${code}" already exists in this project. Variable codes must be unique.`,
        statusCode: 409,
      };
    }

    const projectVars = all.filter(v => v.projectId === projectId);
    const newVar: Variable = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      name,
      code,
      variableType: payload.variableType?.trim() || 'Latent Construct',
      role: payload.role,
      measurementScale: payload.measurementScale,
      conceptualDefinition: payload.conceptualDefinition?.trim() || '',
      operationalDefinition: payload.operationalDefinition?.trim() || '',
      description: payload.description?.trim() || '',
      orderIndex: projectVars.length + 1,
      dimensions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    all.push(newVar);
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'variable_created',
      entityType: 'variable',
      entityId: newVar.id,
      entityName: `${newVar.code}: ${newVar.name}`,
      metadata: { role: newVar.role, measurementScale: newVar.measurementScale },
    });

    return { success: true, data: newVar, statusCode: 201 };
  },

  /**
   * Update variable details
   */
  updateVariable(
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
  ): ServiceResult<Variable> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const index = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Variable not found.', statusCode: 404 };
    }

    const current = all[index];

    // Validate name & code if provided
    if (updates.name !== undefined && !updates.name.trim()) {
      return { success: false, error: 'Variable name cannot be blank.', statusCode: 400 };
    }

    if (updates.code !== undefined) {
      const codeTrimmed = updates.code.trim().toUpperCase();
      if (!codeTrimmed) {
        return { success: false, error: 'Variable code cannot be blank.', statusCode: 400 };
      }
      // Check duplicate code with other variables in same project
      const duplicate = all.some(
        v => v.projectId === projectId && v.id !== variableId && v.code.toUpperCase() === codeTrimmed
      );
      if (duplicate) {
        return {
          success: false,
          error: `Variable code "${codeTrimmed}" is already used by another variable in this project.`,
          statusCode: 409,
        };
      }
      updates.code = codeTrimmed;
    }

    if (updates.role && !VALID_ROLES.includes(updates.role)) {
      return { success: false, error: 'Invalid variable role.', statusCode: 400 };
    }
    if (updates.measurementScale && !VALID_SCALES.includes(updates.measurementScale)) {
      return { success: false, error: 'Invalid measurement scale.', statusCode: 400 };
    }

    const updated: Variable = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'variable_updated',
      entityType: 'variable',
      entityId: variableId,
      entityName: `${updated.code}: ${updated.name}`,
      metadata: { updatedFields: Object.keys(updates) },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Delete variable and cascade remove its dimensions and indicators
   */
  deleteVariable(
    projectId: string,
    variableId: string,
    userId: string,
    userName: string
  ): ServiceResult<{ id: string; deletedDimensionsCount: number; deletedIndicatorsCount: number }> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const target = all.find(v => v.id === variableId && v.projectId === projectId);
    if (!target) {
      return { success: false, error: 'Variable not found.', statusCode: 404 };
    }

    const dimCount = target.dimensions?.length || 0;
    const indCount = (target.dimensions || []).reduce(
      (sum, d) => sum + (d.indicators?.length || 0),
      0
    );

    const remaining = all.filter(v => v.id !== variableId);
    storage.set(VARIABLES_KEY, remaining);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'variable_deleted',
      entityType: 'variable',
      entityId: variableId,
      entityName: `${target.code}: ${target.name}`,
      metadata: {
        cascadeDimensions: dimCount,
        cascadeIndicators: indCount,
      },
    });

    return {
      success: true,
      data: {
        id: variableId,
        deletedDimensionsCount: dimCount,
        deletedIndicatorsCount: indCount,
      },
      statusCode: 200,
    };
  },

  // ==========================================
  // DIMENSIONS MANAGEMENT
  // ==========================================

  createDimension(
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
  ): ServiceResult<Dimension> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const name = payload.name?.trim();
    const code = payload.code?.trim().toUpperCase();
    if (!name) {
      return { success: false, error: 'Dimension name is required.', statusCode: 400 };
    }
    if (!code) {
      return { success: false, error: 'Dimension code is required (e.g. DIM-1).', statusCode: 400 };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) {
      return { success: false, error: 'Target parent variable not found in project.', statusCode: 404 };
    }

    const variable = all[vIndex];
    const existingDims = variable.dimensions || [];

    if (existingDims.some(d => d.code.toUpperCase() === code)) {
      return {
        success: false,
        error: `Dimension code "${code}" already exists in variable "${variable.name}".`,
        statusCode: 409,
      };
    }

    const newDim: Dimension = {
      id: `dim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      variableId,
      name,
      code,
      definition: payload.definition?.trim() || '',
      description: payload.description?.trim() || '',
      orderIndex: existingDims.length + 1,
      indicators: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    variable.dimensions = [...existingDims, newDim];
    variable.updatedAt = new Date().toISOString();
    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'dimension_created',
      entityType: 'dimension',
      entityId: newDim.id,
      entityName: `${newDim.code}: ${newDim.name}`,
      metadata: { variableId, variableName: variable.name },
    });

    return { success: true, data: newDim, statusCode: 201 };
  },

  updateDimension(
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
  ): ServiceResult<Dimension> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) {
      return { success: false, error: 'Parent variable not found.', statusCode: 404 };
    }

    const variable = all[vIndex];
    const dIndex = (variable.dimensions || []).findIndex(d => d.id === dimensionId);
    if (dIndex === -1) {
      return { success: false, error: 'Dimension not found in variable.', statusCode: 404 };
    }

    const currentDim = variable.dimensions[dIndex];

    if (updates.name !== undefined && !updates.name.trim()) {
      return { success: false, error: 'Dimension name cannot be empty.', statusCode: 400 };
    }
    if (updates.code !== undefined) {
      const codeTrimmed = updates.code.trim().toUpperCase();
      if (!codeTrimmed) {
        return { success: false, error: 'Dimension code cannot be empty.', statusCode: 400 };
      }
      const duplicate = variable.dimensions.some(
        d => d.id !== dimensionId && d.code.toUpperCase() === codeTrimmed
      );
      if (duplicate) {
        return {
          success: false,
          error: `Dimension code "${codeTrimmed}" is already used in this variable.`,
          statusCode: 409,
        };
      }
      updates.code = codeTrimmed;
    }

    const updatedDim: Dimension = {
      ...currentDim,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    variable.dimensions[dIndex] = updatedDim;
    variable.updatedAt = new Date().toISOString();
    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'dimension_updated',
      entityType: 'dimension',
      entityId: dimensionId,
      entityName: `${updatedDim.code}: ${updatedDim.name}`,
      metadata: { variableId },
    });

    return { success: true, data: updatedDim, statusCode: 200 };
  },

  deleteDimension(
    projectId: string,
    variableId: string,
    dimensionId: string,
    userId: string,
    userName: string
  ): ServiceResult<{ id: string; deletedIndicatorsCount: number }> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) {
      return { success: false, error: 'Variable not found.', statusCode: 404 };
    }

    const variable = all[vIndex];
    const targetDim = (variable.dimensions || []).find(d => d.id === dimensionId);
    if (!targetDim) {
      return { success: false, error: 'Dimension not found.', statusCode: 404 };
    }

    const indCount = targetDim.indicators?.length || 0;
    variable.dimensions = variable.dimensions.filter(d => d.id !== dimensionId);
    // Re-index remaining dimensions
    variable.dimensions.forEach((d, idx) => {
      d.orderIndex = idx + 1;
    });
    variable.updatedAt = new Date().toISOString();

    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'dimension_deleted',
      entityType: 'dimension',
      entityId: dimensionId,
      entityName: `${targetDim.code}: ${targetDim.name}`,
      metadata: { cascadeIndicators: indCount },
    });

    return { success: true, data: { id: dimensionId, deletedIndicatorsCount: indCount }, statusCode: 200 };
  },

  reorderDimensions(
    projectId: string,
    variableId: string,
    dimensionId: string,
    direction: 'up' | 'down',
    userId: string
  ): ServiceResult<Dimension[]> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) {
      return { success: false, error: 'Variable not found.', statusCode: 404 };
    }

    const variable = all[vIndex];
    const dims = [...(variable.dimensions || [])].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = dims.findIndex(d => d.id === dimensionId);
    if (index === -1) return { success: false, error: 'Dimension not found.', statusCode: 404 };

    if (direction === 'up' && index > 0) {
      const temp = dims[index];
      dims[index] = dims[index - 1];
      dims[index - 1] = temp;
    } else if (direction === 'down' && index < dims.length - 1) {
      const temp = dims[index];
      dims[index] = dims[index + 1];
      dims[index + 1] = temp;
    }

    dims.forEach((d, idx) => {
      d.orderIndex = idx + 1;
    });

    variable.dimensions = dims;
    variable.updatedAt = new Date().toISOString();
    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    return { success: true, data: dims, statusCode: 200 };
  },

  // ==========================================
  // INDICATORS MANAGEMENT
  // ==========================================

  createIndicator(
    projectId: string,
    variableId: string,
    dimensionId: string,
    userId: string,
    userName: string,
    payload: {
      name: string;
      code: string;
      definition?: string;
      description?: string;
    }
  ): ServiceResult<Indicator> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const name = payload.name?.trim();
    const code = payload.code?.trim().toUpperCase();
    if (!name) {
      return { success: false, error: 'Indicator name is required.', statusCode: 400 };
    }
    if (!code) {
      return { success: false, error: 'Indicator code is required (e.g. IND-1.1).', statusCode: 400 };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) {
      return { success: false, error: 'Variable not found.', statusCode: 404 };
    }

    const variable = all[vIndex];
    const dIndex = (variable.dimensions || []).findIndex(d => d.id === dimensionId);
    if (dIndex === -1) {
      return { success: false, error: 'Parent dimension not found.', statusCode: 404 };
    }

    const dimension = variable.dimensions[dIndex];
    const existingIndicators = dimension.indicators || [];

    if (existingIndicators.some(ind => ind.code.toUpperCase() === code)) {
      return {
        success: false,
        error: `Indicator code "${code}" already exists in dimension "${dimension.name}".`,
        statusCode: 409,
      };
    }

    const newIndicator: Indicator = {
      id: `ind_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      dimensionId,
      variableId,
      name,
      code,
      definition: payload.definition?.trim() || '',
      description: payload.description?.trim() || '',
      orderIndex: existingIndicators.length + 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    dimension.indicators = [...existingIndicators, newIndicator];
    dimension.updatedAt = new Date().toISOString();
    variable.updatedAt = new Date().toISOString();
    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'indicator_created',
      entityType: 'indicator',
      entityId: newIndicator.id,
      entityName: `${newIndicator.code}: ${newIndicator.name}`,
      metadata: { variableId, dimensionId },
    });

    return { success: true, data: newIndicator, statusCode: 201 };
  },

  updateIndicator(
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
  ): ServiceResult<Indicator> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) return { success: false, error: 'Variable not found.', statusCode: 404 };

    const variable = all[vIndex];
    const dIndex = (variable.dimensions || []).findIndex(d => d.id === dimensionId);
    if (dIndex === -1) return { success: false, error: 'Dimension not found.', statusCode: 404 };

    const dimension = variable.dimensions[dIndex];
    const iIndex = (dimension.indicators || []).findIndex(i => i.id === indicatorId);
    if (iIndex === -1) return { success: false, error: 'Indicator not found.', statusCode: 404 };

    const currentInd = dimension.indicators[iIndex];

    if (updates.name !== undefined && !updates.name.trim()) {
      return { success: false, error: 'Indicator name cannot be blank.', statusCode: 400 };
    }
    if (updates.code !== undefined) {
      const codeTrimmed = updates.code.trim().toUpperCase();
      if (!codeTrimmed) {
        return { success: false, error: 'Indicator code cannot be blank.', statusCode: 400 };
      }
      const duplicate = dimension.indicators.some(
        i => i.id !== indicatorId && i.code.toUpperCase() === codeTrimmed
      );
      if (duplicate) {
        return {
          success: false,
          error: `Indicator code "${codeTrimmed}" already exists in this dimension.`,
          statusCode: 409,
        };
      }
      updates.code = codeTrimmed;
    }

    const updatedInd: Indicator = {
      ...currentInd,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    dimension.indicators[iIndex] = updatedInd;
    dimension.updatedAt = new Date().toISOString();
    variable.updatedAt = new Date().toISOString();
    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'indicator_updated',
      entityType: 'indicator',
      entityId: indicatorId,
      entityName: `${updatedInd.code}: ${updatedInd.name}`,
      metadata: { variableId, dimensionId },
    });

    return { success: true, data: updatedInd, statusCode: 200 };
  },

  deleteIndicator(
    projectId: string,
    variableId: string,
    dimensionId: string,
    indicatorId: string,
    userId: string,
    userName: string
  ): ServiceResult<{ id: string }> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) return { success: false, error: 'Variable not found.', statusCode: 404 };

    const variable = all[vIndex];
    const dIndex = (variable.dimensions || []).findIndex(d => d.id === dimensionId);
    if (dIndex === -1) return { success: false, error: 'Dimension not found.', statusCode: 404 };

    const dimension = variable.dimensions[dIndex];
    const targetInd = (dimension.indicators || []).find(i => i.id === indicatorId);
    if (!targetInd) return { success: false, error: 'Indicator not found.', statusCode: 404 };

    dimension.indicators = dimension.indicators.filter(i => i.id !== indicatorId);
    dimension.indicators.forEach((ind, idx) => {
      ind.orderIndex = idx + 1;
    });
    dimension.updatedAt = new Date().toISOString();
    variable.updatedAt = new Date().toISOString();

    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'indicator_deleted',
      entityType: 'indicator',
      entityId: indicatorId,
      entityName: `${targetInd.code}: ${targetInd.name}`,
      metadata: { variableId, dimensionId },
    });

    return { success: true, data: { id: indicatorId }, statusCode: 200 };
  },

  reorderIndicators(
    projectId: string,
    variableId: string,
    dimensionId: string,
    indicatorId: string,
    direction: 'up' | 'down',
    userId: string
  ): ServiceResult<Indicator[]> {
    const authCheck = projectService.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const all = this._getAllVariables();
    const vIndex = all.findIndex(v => v.id === variableId && v.projectId === projectId);
    if (vIndex === -1) return { success: false, error: 'Variable not found.', statusCode: 404 };

    const variable = all[vIndex];
    const dIndex = (variable.dimensions || []).findIndex(d => d.id === dimensionId);
    if (dIndex === -1) return { success: false, error: 'Dimension not found.', statusCode: 404 };

    const dimension = variable.dimensions[dIndex];
    const inds = [...(dimension.indicators || [])].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = inds.findIndex(i => i.id === indicatorId);
    if (index === -1) return { success: false, error: 'Indicator not found.', statusCode: 404 };

    if (direction === 'up' && index > 0) {
      const temp = inds[index];
      inds[index] = inds[index - 1];
      inds[index - 1] = temp;
    } else if (direction === 'down' && index < inds.length - 1) {
      const temp = inds[index];
      inds[index] = inds[index + 1];
      inds[index + 1] = temp;
    }

    inds.forEach((ind, idx) => {
      ind.orderIndex = idx + 1;
    });

    dimension.indicators = inds;
    dimension.updatedAt = new Date().toISOString();
    variable.updatedAt = new Date().toISOString();
    all[vIndex] = variable;
    storage.set(VARIABLES_KEY, all);

    return { success: true, data: inds, statusCode: 200 };
  },
};
