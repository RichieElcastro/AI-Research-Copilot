import { DEMO_INSTRUMENTS, DEMO_ITEMS } from '../data/demoData';
import {
  Instrument,
  InstrumentItem,
  InstrumentStatus,
  InstrumentValidationIssue,
  InstrumentValidationReport,
  InstrumentVersion,
} from '../types';
import { auditService } from './auditService';
import { projectService, ServiceResult } from './projectService';
import { scaleService } from './scaleService';
import { storage } from './storage';
import { variableService } from './variableService';

const INSTRUMENTS_KEY = 'instruments';
const ITEMS_KEY = 'instrument_items';
const VERSIONS_KEY = 'instrument_versions';

export const instrumentService = {
  _getAllInstruments(): Instrument[] {
    const instruments = storage.get<Instrument[]>(INSTRUMENTS_KEY, []);
    if (instruments.length === 0) {
      storage.set(INSTRUMENTS_KEY, DEMO_INSTRUMENTS);
      return DEMO_INSTRUMENTS;
    }
    return instruments;
  },

  _saveInstruments(instruments: Instrument[]): void {
    storage.set(INSTRUMENTS_KEY, instruments);
  },

  _getAllItems(): InstrumentItem[] {
    const items = storage.get<InstrumentItem[]>(ITEMS_KEY, []);
    if (items.length === 0) {
      storage.set(ITEMS_KEY, DEMO_ITEMS);
      return DEMO_ITEMS;
    }
    return items;
  },

  _saveItems(items: InstrumentItem[]): void {
    storage.set(ITEMS_KEY, items);
  },

  _getAllVersions(): InstrumentVersion[] {
    return storage.get<InstrumentVersion[]>(VERSIONS_KEY, []);
  },

  _saveVersions(versions: InstrumentVersion[]): void {
    storage.set(VERSIONS_KEY, versions);
  },

  /**
   * Seed demo instruments for Dr. Amelia Ross's demo project if none exist yet
   */
  _ensureDemoInstruments(projectId: string): void {
    if (projectId !== 'proj_demo_doomscrolling_2026') return;

    const all = this._getAllInstruments();
    const existing = all.filter(i => i.projectId === projectId);
    if (existing.length > 0) return;

    // Ensure scales exist for demo project
    scaleService._ensureProjectPresets(projectId);
    const scales = scaleService._getAllScales().filter(s => s.projectId === projectId);
    const freqScale = scales.find(s => s.name.includes('Frequency')) || scales[0];
    const mbiScale = scales.find(s => s.name.includes('MBI-SS')) || scales[0];

    const now = '2026-02-11T09:00:00.000Z';

    const demoInstrument1: Instrument = {
      id: 'inst_demo_ds12',
      projectId,
      name: 'Doomscrolling Behavioral Inventory (DS-12)',
      code: 'DS01',
      description:
        'A multi-dimensional psychometric measure capturing compulsive negative news scrolling, sleep disruption, and affective hyperarousal.',
      purpose: 'Operationalize independent construct X1 (Doomscrolling Behavior) across 3 empirical dimensions.',
      sourceType: 'Adapted Instrument',
      sourceReference: 'Adapted from Sharma et al. (2022) Doomscrolling Scale & Sacco et al. (2023)',
      version: '1.0',
      status: 'Review',
      variableIds: ['var_demo_x1'],
      createdAt: now,
      updatedAt: '2026-02-12T11:00:00.000Z',
    };

    const demoInstrument2: Instrument = {
      id: 'inst_demo_mbiss',
      projectId,
      name: 'Maslach Burnout Inventory - Student Survey (MBI-SS)',
      code: 'MBISS01',
      description:
        'Standardized student burnout assessment evaluating emotional exhaustion, cynicism toward coursework, and academic self-efficacy.',
      purpose: 'Operationalize criterion construct Y1 (Academic Burnout) across cognitive and emotional burnout subscales.',
      sourceType: 'Standardized Instrument',
      sourceReference: 'Schaufeli, Martinez, Pinto, Salanova, & Bakker (2002)',
      version: '1.0',
      status: 'Draft',
      variableIds: ['var_demo_y1'],
      createdAt: now,
      updatedAt: '2026-02-12T11:00:00.000Z',
    };

    const demoItems: InstrumentItem[] = [
      {
        id: 'item_ds_01',
        instrumentId: 'inst_demo_ds12',
        projectId,
        itemCode: 'X1.01',
        itemNumber: 1,
        questionText: 'I find myself automatically checking news feeds for distressing stories without realizing how I started.',
        itemType: 'Likert',
        variableId: 'var_demo_x1',
        dimensionId: 'dim_demo_1',
        indicatorId: 'ind_demo_1_1',
        responseScaleId: freqScale ? freqScale.id : undefined,
        required: true,
        reverseCoded: false,
        status: 'active',
        source: 'Adapted',
        notes: 'Measures behavioral automaticity (IND-1.1).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'item_ds_02',
        instrumentId: 'inst_demo_ds12',
        projectId,
        itemCode: 'X1.02',
        itemNumber: 2,
        questionText: 'I spend more than an hour continuously reading catastrophe news updates even when it makes me feel uneasy.',
        itemType: 'Likert',
        variableId: 'var_demo_x1',
        dimensionId: 'dim_demo_1',
        indicatorId: 'ind_demo_1_2',
        responseScaleId: freqScale ? freqScale.id : undefined,
        required: true,
        reverseCoded: false,
        status: 'active',
        source: 'Adapted',
        notes: 'Measures continuous exposure beyond 60 minutes (IND-1.2).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'item_ds_03',
        instrumentId: 'inst_demo_ds12',
        projectId,
        itemCode: 'X1.03',
        itemNumber: 3,
        questionText: 'I stay up late at night past my intended bedtime reading about crises and controversies online.',
        itemType: 'Likert',
        variableId: 'var_demo_x1',
        dimensionId: 'dim_demo_2',
        indicatorId: 'ind_demo_2_1',
        responseScaleId: freqScale ? freqScale.id : undefined,
        required: true,
        reverseCoded: false,
        status: 'active',
        source: 'Adapted',
        notes: 'Sleep displacement indicator (IND-2.1).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'item_ds_04',
        instrumentId: 'inst_demo_ds12',
        projectId,
        itemCode: 'X1.04',
        itemNumber: 4,
        questionText: 'I find it easy to close social media news threads whenever I decide it is time to stop.',
        itemType: 'Likert',
        variableId: 'var_demo_x1',
        dimensionId: 'dim_demo_2',
        indicatorId: 'ind_demo_2_2',
        responseScaleId: freqScale ? freqScale.id : undefined,
        required: true,
        reverseCoded: true,
        status: 'active',
        source: 'Researcher Created',
        notes: 'Reverse-coded item for executive disengagement control.',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'item_ds_05',
        instrumentId: 'inst_demo_ds12',
        projectId,
        itemCode: 'X1.05',
        itemNumber: 5,
        questionText: 'I experience physical tension or a racing heartbeat while scrolling through alarming headlines.',
        itemType: 'Likert',
        variableId: 'var_demo_x1',
        dimensionId: 'dim_demo_3',
        indicatorId: 'ind_demo_3_1',
        responseScaleId: freqScale ? freqScale.id : undefined,
        required: true,
        reverseCoded: false,
        status: 'active',
        source: 'Adapted',
        notes: 'Somatic anxiety symptom (IND-3.1).',
        createdAt: now,
        updatedAt: now,
      },
      // Items for MBI-SS
      {
        id: 'item_mbi_01',
        instrumentId: 'inst_demo_mbiss',
        projectId,
        itemCode: 'Y1.01',
        itemNumber: 1,
        questionText: 'I feel intellectually exhausted and depleted from my academic coursework.',
        itemType: 'Likert',
        variableId: 'var_demo_y1',
        dimensionId: 'dim_demo_4',
        indicatorId: 'ind_demo_4_1',
        responseScaleId: mbiScale ? mbiScale.id : undefined,
        required: true,
        reverseCoded: false,
        status: 'active',
        source: 'Existing Instrument',
        notes: 'MBI-SS Item 1 (Emotional Exhaustion).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'item_mbi_02',
        instrumentId: 'inst_demo_mbiss',
        projectId,
        itemCode: 'Y1.02',
        itemNumber: 2,
        questionText: 'I feel tired when I get up in the morning and have to face another day at the university.',
        itemType: 'Likert',
        variableId: 'var_demo_y1',
        dimensionId: 'dim_demo_4',
        indicatorId: 'ind_demo_4_2',
        responseScaleId: mbiScale ? mbiScale.id : undefined,
        required: true,
        reverseCoded: false,
        status: 'active',
        source: 'Existing Instrument',
        notes: 'MBI-SS Item 2 (Morning fatigue).',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'item_mbi_03',
        instrumentId: 'inst_demo_mbiss',
        projectId,
        itemCode: 'Y1.03',
        itemNumber: 3,
        questionText: 'I have become more cynical and detached regarding the usefulness of my studies.',
        itemType: 'Likert',
        variableId: 'var_demo_y1',
        dimensionId: 'dim_demo_5',
        indicatorId: 'ind_demo_5_1',
        responseScaleId: mbiScale ? mbiScale.id : undefined,
        required: true,
        reverseCoded: false,
        status: 'active',
        source: 'Existing Instrument',
        notes: 'MBI-SS Item 3 (Cynicism).',
        createdAt: now,
        updatedAt: now,
      },
    ];

    this._saveInstruments([...all, demoInstrument1, demoInstrument2]);
    const currentItems = this._getAllItems();
    this._saveItems([...currentItems, ...demoItems]);
  },

  /**
   * List instruments for a project with strict user authorization
   */
  getInstruments(projectId: string, userId: string): ServiceResult<Instrument[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    this._ensureDemoInstruments(projectId);
    const all = this._getAllInstruments();
    const items = this._getAllItems();

    const projectInstruments = all
      .filter(i => i.projectId === projectId)
      .map(inst => ({
        ...inst,
        items: items
          .filter(it => it.instrumentId === inst.id)
          .sort((a, b) => a.itemNumber - b.itemNumber),
      }));

    return { success: true, data: projectInstruments, statusCode: 200 };
  },

  /**
   * Get single instrument by ID with its items
   */
  getInstrument(instrumentId: string, projectId: string, userId: string): ServiceResult<Instrument> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    this._ensureDemoInstruments(projectId);
    const all = this._getAllInstruments();
    const inst = all.find(i => i.id === instrumentId && i.projectId === projectId);

    if (!inst) {
      return { success: false, error: 'Measurement instrument not found.', statusCode: 404 };
    }

    const items = this._getAllItems()
      .filter(it => it.instrumentId === inst.id)
      .sort((a, b) => a.itemNumber - b.itemNumber);

    return {
      success: true,
      data: {
        ...inst,
        items,
      },
      statusCode: 200,
    };
  },

  /**
   * Create a new research instrument
   */
  createInstrument(
    projectId: string,
    userId: string,
    userName: string,
    data: {
      name: string;
      code: string;
      description?: string;
      purpose?: string;
      sourceType: Instrument['sourceType'];
      sourceReference?: string;
      variableIds?: string[];
    }
  ): ServiceResult<Instrument> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    if (!data.name || data.name.trim().length === 0) {
      return { success: false, error: 'Instrument name is required.', statusCode: 400 };
    }

    if (!data.code || data.code.trim().length === 0) {
      return { success: false, error: 'Instrument code is required.', statusCode: 400 };
    }

    const cleanCode = data.code.trim().toUpperCase();
    const all = this._getAllInstruments();

    // Check code uniqueness within project
    const duplicate = all.find(
      i => i.projectId === projectId && i.code.toUpperCase() === cleanCode
    );
    if (duplicate) {
      return {
        success: false,
        error: `Instrument code "${cleanCode}" is already in use in this project. Please provide a unique code.`,
        statusCode: 409,
      };
    }

    const now = new Date().toISOString();
    const newInstrument: Instrument = {
      id: `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      projectId,
      name: data.name.trim(),
      code: cleanCode,
      description: data.description?.trim() || '',
      purpose: data.purpose?.trim() || '',
      sourceType: data.sourceType,
      sourceReference: data.sourceReference?.trim() || '',
      version: '1.0',
      status: 'Draft',
      variableIds: data.variableIds || [],
      items: [],
      createdAt: now,
      updatedAt: now,
    };

    this._saveInstruments([...all, newInstrument]);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_created',
      entityType: 'instrument',
      entityId: newInstrument.id,
      entityName: newInstrument.name,
      metadata: {
        code: newInstrument.code,
        sourceType: newInstrument.sourceType,
        mappedVariableCount: newInstrument.variableIds.length,
      },
    });

    return { success: true, data: newInstrument, statusCode: 201 };
  },

  /**
   * Update instrument metadata
   */
  updateInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    data: Partial<Omit<Instrument, 'id' | 'projectId' | 'createdAt' | 'updatedAt' | 'items'>>
  ): ServiceResult<Instrument> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllInstruments();
    const index = all.findIndex(i => i.id === instrumentId && i.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    const existing = all[index];

    // Reproducibility protection: Approved instruments cannot be mutated destructively
    if (existing.status === 'Approved' && data.status !== 'Archived') {
      return {
        success: false,
        error:
          'Integrity Guard: Approved instruments cannot be modified directly to preserve empirical reproducibility. Please click "Create New Version" to branch a new editable draft.',
        statusCode: 403,
      };
    }

    // Code uniqueness check if changed
    if (data.code && data.code.trim().toUpperCase() !== existing.code.toUpperCase()) {
      const cleanCode = data.code.trim().toUpperCase();
      const duplicate = all.find(
        i => i.id !== instrumentId && i.projectId === projectId && i.code.toUpperCase() === cleanCode
      );
      if (duplicate) {
        return {
          success: false,
          error: `Instrument code "${cleanCode}" is already in use by another instrument.`,
          statusCode: 409,
        };
      }
      data.code = cleanCode;
    }

    const updated: Instrument = {
      ...existing,
      ...data,
      name: data.name !== undefined ? data.name.trim() : existing.name,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    this._saveInstruments(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_updated',
      entityType: 'instrument',
      entityId: updated.id,
      entityName: updated.name,
      metadata: {
        updatedFields: Object.keys(data),
      },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Delete an instrument and cascade delete its items and versions
   * Disallowed if instrument is Approved!
   */
  deleteInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<boolean> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllInstruments();
    const inst = all.find(i => i.id === instrumentId && i.projectId === projectId);
    if (!inst) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    if (inst.status === 'Approved') {
      return {
        success: false,
        error:
          'Integrity Guard: Approved research instruments cannot be deleted as they represent formal measurement models. Archive the instrument instead to deactivate it.',
        statusCode: 403,
      };
    }

    // Remove instrument
    this._saveInstruments(all.filter(i => i.id !== instrumentId));

    // Cascade delete items
    const items = this._getAllItems();
    const remainingItems = items.filter(it => it.instrumentId !== instrumentId);
    this._saveItems(remainingItems);

    // Cascade delete versions
    const versions = this._getAllVersions();
    const remainingVersions = versions.filter(v => v.instrumentId !== instrumentId);
    this._saveVersions(remainingVersions);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_deleted',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: inst.name,
      metadata: { code: inst.code },
    });

    return { success: true, data: true, statusCode: 200 };
  },

  /**
   * Archive an instrument (read-only)
   */
  archiveInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<Instrument> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllInstruments();
    const index = all.findIndex(i => i.id === instrumentId && i.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    all[index].status = 'Archived';
    all[index].updatedAt = new Date().toISOString();
    this._saveInstruments(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_archived',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: all[index].name,
    });

    return { success: true, data: all[index], statusCode: 200 };
  },

  /**
   * Map variables measured by this instrument
   */
  mapVariables(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    variableIds: string[]
  ): ServiceResult<Instrument> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    // Verify variables belong to this project
    const vRes = variableService.getVariables(projectId, userId);
    if (!vRes.success || !vRes.data) {
      return { success: false, error: 'Could not fetch project variables.', statusCode: 500 };
    }

    const validIds = new Set(vRes.data.map(v => v.id));
    for (const vid of variableIds) {
      if (!validIds.has(vid)) {
        return {
          success: false,
          error: `Variable ID "${vid}" does not exist in this research project.`,
          statusCode: 400,
        };
      }
    }

    const all = this._getAllInstruments();
    const index = all.findIndex(i => i.id === instrumentId && i.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    if (all[index].status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot alter variable mappings. Branch a new version first.',
        statusCode: 403,
      };
    }

    all[index].variableIds = variableIds;
    all[index].updatedAt = new Date().toISOString();
    this._saveInstruments(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'variable_mapped',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: all[index].name,
      metadata: {
        variableIds,
        variableCount: variableIds.length,
      },
    });

    return { success: true, data: all[index], statusCode: 200 };
  },

  /**
   * Run comprehensive validation against an instrument before approval
   */
  validateInstrument(
    instrumentId: string,
    projectId: string,
    userId: string
  ): ServiceResult<InstrumentValidationReport> {
    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: instRes.error, statusCode: instRes.statusCode };
    }

    const inst = instRes.data;
    const items = inst.items || [];
    const errors: InstrumentValidationIssue[] = [];
    const warnings: InstrumentValidationIssue[] = [];

    // 1. Metadata check
    const hasMetadata = Boolean(inst.name && inst.name.trim() && inst.code && inst.code.trim());
    if (!hasMetadata) {
      errors.push({
        type: 'error',
        field: 'metadata',
        message: 'Instrument must have a non-empty title and unique instrument code.',
      });
    }

    // 2. Variable mapping check
    const hasVariables = Array.isArray(inst.variableIds) && inst.variableIds.length > 0;
    if (!hasVariables) {
      errors.push({
        type: 'error',
        field: 'variables',
        message: 'At least one research variable must be mapped to this instrument.',
      });
    }

    // 3. Items presence
    if (items.length === 0) {
      errors.push({
        type: 'error',
        field: 'items',
        message: 'Instrument contains no measurement items. Add at least one item.',
      });
    }

    // 4. Scales check
    const scalesRes = scaleService.getScales(projectId, userId);
    const scalesMap = new Map((scalesRes.data || []).map(s => [s.id, s]));

    // 5. Item-level validations
    const seenCodes = new Set<string>();
    let allScalesConfigured = true;
    let allCodingValid = true;
    let anyIndicatorsMapped = false;

    for (const item of items) {
      // Question text check
      if (!item.questionText || item.questionText.trim().length < 3) {
        errors.push({
          type: 'error',
          itemId: item.id,
          itemCode: item.itemCode,
          message: `Item #${item.itemNumber} is missing question prompt text.`,
        });
      }

      // Unique item code check
      if (!item.itemCode || item.itemCode.trim().length === 0) {
        errors.push({
          type: 'error',
          itemId: item.id,
          message: `Item #${item.itemNumber} is missing an item code.`,
        });
      } else {
        const upper = item.itemCode.trim().toUpperCase();
        if (seenCodes.has(upper)) {
          errors.push({
            type: 'error',
            itemId: item.id,
            itemCode: item.itemCode,
            message: `Duplicate item code "${item.itemCode}" detected. Item codes within an instrument must be unique.`,
          });
        }
        seenCodes.add(upper);
      }

      // Variable assignment check
      if (!item.variableId || !inst.variableIds.includes(item.variableId)) {
        errors.push({
          type: 'error',
          itemId: item.id,
          itemCode: item.itemCode,
          message: `Item #${item.itemNumber} (${item.itemCode}) is assigned to an unmapped variable.`,
        });
      }

      // Scale check
      if (['Likert', 'Multiple Choice', 'Single Choice', 'Yes/No'].includes(item.itemType)) {
        if (!item.responseScaleId) {
          errors.push({
            type: 'error',
            itemId: item.id,
            itemCode: item.itemCode,
            message: `Item #${item.itemNumber} (${item.itemCode}) requires a response scale but none is assigned.`,
          });
          allScalesConfigured = false;
        } else {
          const scale = scalesMap.get(item.responseScaleId);
          if (!scale) {
            errors.push({
              type: 'error',
              itemId: item.id,
              itemCode: item.itemCode,
              message: `Item #${item.itemNumber} (${item.itemCode}) references a non-existent or deleted response scale.`,
            });
            allScalesConfigured = false;
          } else if (scale.isArchived) {
            warnings.push({
              type: 'warning',
              itemId: item.id,
              itemCode: item.itemCode,
              message: `Item #${item.itemNumber} (${item.itemCode}) uses archived scale "${scale.name}".`,
            });
          }
        }
      }

      // Reverse coding check
      if (item.reverseCoded) {
        if (item.responseScaleId) {
          const scale = scalesMap.get(item.responseScaleId);
          if (scale && scale.options.length < 2) {
            errors.push({
              type: 'error',
              itemId: item.id,
              itemCode: item.itemCode,
              message: `Item #${item.itemNumber} (${item.itemCode}) is marked reverse-coded, but its scale has fewer than 2 points.`,
            });
            allCodingValid = false;
          }
        }
      }

      // Indicator coverage warning
      if (item.indicatorId) {
        anyIndicatorsMapped = true;
      } else {
        warnings.push({
          type: 'warning',
          itemId: item.id,
          itemCode: item.itemCode,
          message: `Item #${item.itemNumber} (${item.itemCode}) is not mapped to an empirical indicator.`,
        });
      }
    }

    const report: InstrumentValidationReport = {
      isValidForApproval: errors.length === 0 && items.length > 0,
      errors,
      warnings,
      summary: {
        hasMetadata,
        hasVariables,
        itemCount: items.length,
        scalesConfigured: allScalesConfigured,
        codingValid: allCodingValid,
        indicatorsMapped: anyIndicatorsMapped,
      },
    };

    return { success: true, data: report, statusCode: 200 };
  },

  /**
   * Approve an instrument. Runs validation report first.
   * On success, creates a permanent immutable snapshot in `instrument_versions`.
   */
  approveInstrument(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    approvalNotes?: string
  ): ServiceResult<Instrument> {
    const valRes = this.validateInstrument(instrumentId, projectId, userId);
    if (!valRes.success || !valRes.data) {
      return { success: false, error: valRes.error || 'Validation failed.', statusCode: 500 };
    }

    if (!valRes.data.isValidForApproval) {
      const errorMsg = valRes.data.errors.map(e => e.message).join(' | ');
      return {
        success: false,
        error: `Cannot approve instrument due to validation errors: ${errorMsg}`,
        statusCode: 400,
      };
    }

    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    const inst = instRes.data;
    const items = inst.items || [];
    const scalesRes = scaleService.getScales(projectId, userId);
    const scalesSnapshot = scalesRes.data || [];

    const now = new Date().toISOString();

    // Create immutable version snapshot
    const versionRecord: InstrumentVersion = {
      id: `ver_${instrumentId}_${Date.now()}`,
      instrumentId: inst.id,
      projectId: inst.projectId,
      versionNumber: inst.version || '1.0',
      status: 'Approved',
      snapshot: {
        instrument: {
          id: inst.id,
          projectId: inst.projectId,
          name: inst.name,
          code: inst.code,
          description: inst.description,
          purpose: inst.purpose,
          sourceType: inst.sourceType,
          sourceReference: inst.sourceReference,
          version: inst.version,
          status: 'Approved',
          variableIds: inst.variableIds,
          createdAt: inst.createdAt,
          updatedAt: now,
        },
        items: JSON.parse(JSON.stringify(items)),
        scalesSnapshot: JSON.parse(JSON.stringify(scalesSnapshot)),
        approvedAt: now,
        approvedBy: `${userName} (${userId})`,
        notes: approvalNotes,
      },
      createdAt: now,
    };

    const versions = this._getAllVersions();
    this._saveVersions([versionRecord, ...versions]);

    // Update instrument status to Approved
    const all = this._getAllInstruments();
    const index = all.findIndex(i => i.id === instrumentId);
    all[index].status = 'Approved';
    all[index].updatedAt = now;
    this._saveInstruments(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_approved',
      entityType: 'instrument',
      entityId: inst.id,
      entityName: inst.name,
      metadata: {
        version: inst.version,
        itemCount: items.length,
        versionRecordId: versionRecord.id,
      },
    });

    return { success: true, data: { ...all[index], items }, statusCode: 200 };
  },

  /**
   * Create a new draft version from an Approved instrument to allow safe modifications
   */
  createInstrumentVersion(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    newVersionNumber?: string
  ): ServiceResult<Instrument> {
    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    const inst = instRes.data;
    const currentVer = parseFloat(inst.version) || 1.0;
    const nextVer = newVersionNumber || (currentVer + 1.0).toFixed(1);

    const all = this._getAllInstruments();
    const index = all.findIndex(i => i.id === instrumentId);

    all[index].version = nextVer;
    all[index].status = 'Draft';
    all[index].updatedAt = new Date().toISOString();
    this._saveInstruments(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'instrument_version_created',
      entityType: 'instrument',
      entityId: inst.id,
      entityName: inst.name,
      metadata: {
        previousVersion: inst.version,
        newVersion: nextVer,
      },
    });

    return { success: true, data: { ...all[index], items: inst.items }, statusCode: 200 };
  },

  /**
   * Retrieve historical snapshots / versions of an instrument
   */
  getInstrumentVersions(
    instrumentId: string,
    projectId: string,
    userId: string
  ): ServiceResult<InstrumentVersion[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const versions = this._getAllVersions();
    const filtered = versions.filter(v => v.instrumentId === instrumentId && v.projectId === projectId);
    return { success: true, data: filtered, statusCode: 200 };
  },

  // ==========================================
  // ITEM MANAGEMENT
  // ==========================================

  /**
   * Create a new instrument item
   */
  createItem(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    data: {
      questionText: string;
      itemCode: string;
      itemType: InstrumentItem['itemType'];
      variableId: string;
      dimensionId?: string;
      indicatorId?: string;
      responseScaleId?: string;
      required?: boolean;
      reverseCoded?: boolean;
      source?: InstrumentItem['source'];
      aiCandidateId?: string;
      aiGenerationId?: string;
      originalAiText?: string;
      modifiedByResearcher?: boolean;
      notes?: string;
    }
  ): ServiceResult<InstrumentItem> {
    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    const inst = instRes.data;
    if (inst.status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot accept new items. Create a new version first.',
        statusCode: 403,
      };
    }

    if (!data.questionText || data.questionText.trim().length === 0) {
      return { success: false, error: 'Question text is required.', statusCode: 400 };
    }

    if (!data.itemCode || data.itemCode.trim().length === 0) {
      return { success: false, error: 'Item code is required.', statusCode: 400 };
    }

    const cleanItemCode = data.itemCode.trim().toUpperCase();
    const existingItems = inst.items || [];
    if (existingItems.some(it => it.itemCode.toUpperCase() === cleanItemCode)) {
      return {
        success: false,
        error: `Item code "${cleanItemCode}" is already used in this instrument.`,
        statusCode: 409,
      };
    }

    // Check variable mapping
    if (!data.variableId) {
      return { success: false, error: 'Every item must be mapped to a variable.', statusCode: 400 };
    }

    const now = new Date().toISOString();
    const nextNumber = existingItems.length > 0 ? Math.max(...existingItems.map(i => i.itemNumber)) + 1 : 1;

    const newItem: InstrumentItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      instrumentId,
      projectId,
      itemCode: cleanItemCode,
      itemNumber: nextNumber,
      questionText: data.questionText.trim(),
      itemType: data.itemType,
      variableId: data.variableId,
      dimensionId: data.dimensionId || undefined,
      indicatorId: data.indicatorId || undefined,
      responseScaleId: data.responseScaleId || undefined,
      required: data.required !== undefined ? data.required : true,
      reverseCoded: Boolean(data.reverseCoded),
      status: 'active',
      source: data.source || 'Researcher Created',
      aiCandidateId: data.aiCandidateId || undefined,
      aiGenerationId: data.aiGenerationId || undefined,
      originalAiText: data.originalAiText || undefined,
      modifiedByResearcher: Boolean(data.modifiedByResearcher),
      notes: data.notes?.trim() || '',
      createdAt: now,
      updatedAt: now,
    };

    const allItems = this._getAllItems();
    this._saveItems([...allItems, newItem]);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'item_created',
      entityType: 'item',
      entityId: newItem.id,
      entityName: newItem.itemCode,
      metadata: {
        instrumentId,
        question: newItem.questionText,
        reverseCoded: newItem.reverseCoded,
      },
    });

    return { success: true, data: newItem, statusCode: 201 };
  },

  /**
   * Update an existing item
   */
  updateItem(
    itemId: string,
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    data: Partial<Omit<InstrumentItem, 'id' | 'instrumentId' | 'projectId' | 'createdAt' | 'updatedAt'>>
  ): ServiceResult<InstrumentItem> {
    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    if (instRes.data.status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot be modified. Branch a new version first.',
        statusCode: 403,
      };
    }

    const items = this._getAllItems();
    const index = items.findIndex(it => it.id === itemId && it.instrumentId === instrumentId);
    if (index === -1) {
      return { success: false, error: 'Item not found.', statusCode: 404 };
    }

    const existing = items[index];

    // Check code uniqueness if changing
    if (data.itemCode && data.itemCode.trim().toUpperCase() !== existing.itemCode.toUpperCase()) {
      const cleanCode = data.itemCode.trim().toUpperCase();
      const duplicate = items.find(
        it => it.instrumentId === instrumentId && it.id !== itemId && it.itemCode.toUpperCase() === cleanCode
      );
      if (duplicate) {
        return {
          success: false,
          error: `Item code "${cleanCode}" is already in use by another item in this instrument.`,
          statusCode: 409,
        };
      }
      data.itemCode = cleanCode;
    }

    const updated: InstrumentItem = {
      ...existing,
      ...data,
      questionText: data.questionText !== undefined ? data.questionText.trim() : existing.questionText,
      updatedAt: new Date().toISOString(),
    };

    items[index] = updated;
    this._saveItems(items);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'item_updated',
      entityType: 'item',
      entityId: updated.id,
      entityName: updated.itemCode,
      metadata: {
        updatedFields: Object.keys(data),
      },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Delete an item
   */
  deleteItem(
    itemId: string,
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<boolean> {
    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    if (instRes.data.status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot delete items. Branch a new version first.',
        statusCode: 403,
      };
    }

    const items = this._getAllItems();
    const target = items.find(it => it.id === itemId && it.instrumentId === instrumentId);
    if (!target) {
      return { success: false, error: 'Item not found.', statusCode: 404 };
    }

    const filtered = items.filter(it => it.id !== itemId);
    this._saveItems(filtered);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'item_deleted',
      entityType: 'item',
      entityId: itemId,
      entityName: target.itemCode,
    });

    return { success: true, data: true, statusCode: 200 };
  },

  /**
   * Duplicate an item
   */
  duplicateItem(
    itemId: string,
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<InstrumentItem> {
    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    const inst = instRes.data;
    if (inst.status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot be modified. Branch a new version first.',
        statusCode: 403,
      };
    }

    const items = inst.items || [];
    const target = items.find(it => it.id === itemId);
    if (!target) {
      return { success: false, error: 'Source item not found.', statusCode: 404 };
    }

    // Generate unique code
    let suffix = 1;
    let newCode = `${target.itemCode}_copy`;
    while (items.some(i => i.itemCode.toUpperCase() === newCode.toUpperCase())) {
      suffix++;
      newCode = `${target.itemCode}_copy${suffix}`;
    }

    return this.createItem(instrumentId, projectId, userId, userName, {
      questionText: `${target.questionText} (Copy)`,
      itemCode: newCode,
      itemType: target.itemType,
      variableId: target.variableId,
      dimensionId: target.dimensionId,
      indicatorId: target.indicatorId,
      responseScaleId: target.responseScaleId,
      required: target.required,
      reverseCoded: target.reverseCoded,
      source: target.source,
      notes: target.notes ? `Cloned from ${target.itemCode}. ${target.notes}` : `Cloned from ${target.itemCode}`,
    });
  },

  /**
   * Reorder items within an instrument
   */
  reorderItems(
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string,
    orderedItemIds: string[]
  ): ServiceResult<InstrumentItem[]> {
    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }

    if (instRes.data.status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot reorder items. Branch a new version first.',
        statusCode: 403,
      };
    }

    const allItems = this._getAllItems();
    const instrumentItems = allItems.filter(it => it.instrumentId === instrumentId);

    const updatedItems: InstrumentItem[] = [];
    orderedItemIds.forEach((id, index) => {
      const item = instrumentItems.find(it => it.id === id);
      if (item) {
        item.itemNumber = index + 1;
        item.updatedAt = new Date().toISOString();
        updatedItems.push(item);
      }
    });

    this._saveItems(allItems);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'item_reordered',
      entityType: 'instrument',
      entityId: instrumentId,
      entityName: instRes.data.name,
      metadata: { itemCount: orderedItemIds.length },
    });

    return { success: true, data: updatedItems, statusCode: 200 };
  },

  /**
   * AI Readiness Context Generator (Phase 2 -> Phase 3 handshake)
   * Formats structured research context for future AI Questionnaire Generator
   */
  exportAIContext(
    instrumentId: string,
    projectId: string,
    userId: string
  ): ServiceResult<any> {
    const pRes = projectService.getProject(projectId, userId);
    if (!pRes.success || !pRes.data) {
      return { success: false, error: pRes.error, statusCode: pRes.statusCode };
    }

    const instRes = this.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: instRes.error, statusCode: instRes.statusCode };
    }

    const vRes = variableService.getVariables(projectId, userId);
    const allVars = vRes.data || [];

    const inst = instRes.data;
    const mappedVars = allVars.filter(v => inst.variableIds.includes(v.id));

    const scalesRes = scaleService.getScales(projectId, userId);
    const scales = (scalesRes.data || []).filter(s => !s.isArchived);

    const contextPayload = {
      manifestType: 'AI_QUESTIONNAIRE_GENERATOR_CONTEXT',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      project: {
        id: pRes.data.id,
        title: pRes.data.title,
        researchTopic: pRes.data.researchTopic,
        researchObjective: pRes.data.researchObjective,
        researchMethod: pRes.data.researchMethod,
        targetPopulation: pRes.data.population,
        sampleDescription: pRes.data.sampleDescription,
        researchDesign: pRes.data.researchDesign,
      },
      instrument: {
        id: inst.id,
        name: inst.name,
        code: inst.code,
        description: inst.description,
        purpose: inst.purpose,
        sourceType: inst.sourceType,
        sourceReference: inst.sourceReference,
        currentVersion: inst.version,
        targetVariables: mappedVars.map(v => ({
          id: v.id,
          name: v.name,
          code: v.code,
          role: v.role,
          measurementScale: v.measurementScale,
          conceptualDefinition: v.conceptualDefinition,
          operationalDefinition: v.operationalDefinition,
          dimensions: v.dimensions.map(d => ({
            id: d.id,
            name: d.name,
            code: d.code,
            definition: d.definition,
            indicators: d.indicators.map(ind => ({
              id: ind.id,
              name: ind.name,
              code: ind.code,
              definition: ind.definition,
            })),
          })),
        })),
        availableScales: scales.map(s => ({
          id: s.id,
          name: s.name,
          scaleType: s.scaleType,
          minValue: s.minValue,
          maxValue: s.maxValue,
          options: s.options,
        })),
        existingItemsCount: (inst.items || []).length,
      },
    };

    return { success: true, data: contextPayload, statusCode: 200 };
  },
};
