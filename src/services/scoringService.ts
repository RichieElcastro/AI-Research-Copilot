/**
 * Quantitative Research Platform - Stage 7 Scoring Engine
 * 
 * Strict Architectural Guarantees:
 * 1. Raw Data Immutability: SurveySubmission and rawResponses are NEVER modified, overwritten, or deleted.
 * 2. Processed Data Immutability: ProcessedDataset, ProcessedRecord, and ProcessedItemValue are NEVER modified.
 * 3. Deterministic Pipeline: PROCESSED DATA -> SCORING RULES SNAPSHOT -> SCORED DATASET -> SCORING CODEBOOK.
 * 4. Zero AI/LLM: Scoring calculations are purely deterministic mathematical functions.
 * 5. Full Lineage: Every ScoredRecord traces back to its sourceProcessedRecordId and sourceSubmissionId.
 * 6. Explicit Missingness: Missing scores remain strictly null with inspectable status and reasons; never converted to zero.
 * 7. Numeric Precision: Internal numbers retain full IEEE-754 double precision without silent rounding.
 */

import {
  ProcessedDataset,
  ProcessedRecord,
  ProcessingRun,
  ScoredDataset,
  ScoredDatasetColumn,
  ScoredRecord,
  ScoreStatus,
  ScoreTargetMetadata,
  ScoringCodebookEntry,
  ScoringMethod,
  ScoringMissingPolicy,
  ScoringPrerequisites,
  ScoringPreviewRow,
  ScoringRule,
  ScoringRulesSnapshot,
  ScoringRuleSnapshotItem,
  ScoringRun,
  ScoringRunError,
  ScoringRunWarning,
  ScoringSourceType,
  ScoringTargetType,
} from '../types';
import { auditService } from './auditService';
import { processingService } from './processingService';
import { projectService, ServiceResult } from './projectService';
import { storage } from './storage';
import { variableService } from './variableService';

/**
 * Namespaced storage keys conforming to qrp_v1_*
 */
const SCORING_RUNS_KEY = 'scoring_runs';
const SCORING_RULES_KEY = 'scoring_rules';
const SCORED_DATASETS_KEY = 'scored_datasets';

export interface RunScoringParams {
  projectId: string;
  processingRunId: string;
  rules: ScoringRule[];
  notes?: string;
  userId: string;
  userName: string;
}

export const scoringService = {
  // ==========================================
  // STORAGE ACCESSORS
  // ==========================================

  _getAllRuns(): ScoringRun[] {
    return storage.get<ScoringRun[]>(SCORING_RUNS_KEY, []);
  },

  _saveRuns(runs: ScoringRun[]): void {
    storage.set(SCORING_RUNS_KEY, runs);
  },

  _getAllRules(): ScoringRule[] {
    return storage.get<ScoringRule[]>(SCORING_RULES_KEY, []);
  },

  _saveRules(rules: ScoringRule[]): void {
    storage.set(SCORING_RULES_KEY, rules);
  },

  _getAllDatasets(): ScoredDataset[] {
    return storage.get<ScoredDataset[]>(SCORED_DATASETS_KEY, []);
  },

  _saveDatasets(datasets: ScoredDataset[]): void {
    storage.set(SCORED_DATASETS_KEY, datasets);
  },

  // ==========================================
  // MATHEMATICAL CALCULATION ENGINE
  // ==========================================

  /**
   * Deterministically calculates the score for a list of valid numeric values.
   * Returns null if no values provided.
   * Stores full floating-point precision without silent rounding.
   */
  calculateScore(values: number[], method: ScoringMethod): number | null {
    if (!values || values.length === 0) {
      return null;
    }

    switch (method) {
      case 'MEAN': {
        const sum = values.reduce((acc, curr) => acc + curr, 0);
        return sum / values.length;
      }
      case 'SUM': {
        return values.reduce((acc, curr) => acc + curr, 0);
      }
      case 'MEDIAN': {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        if (sorted.length % 2 !== 0) {
          return sorted[mid];
        }
        return (sorted[mid - 1] + sorted[mid]) / 2;
      }
      case 'MIN': {
        return Math.min(...values);
      }
      case 'MAX': {
        return Math.max(...values);
      }
      default:
        return null;
    }
  },

  /**
   * Evaluates whether a score can be calculated according to the explicit missing value policy.
   */
  evaluateMissingPolicy(
    totalSourceCount: number,
    validValues: number[],
    policy: ScoringMissingPolicy,
    minimumRequired?: number
  ): { canCalculate: boolean; flagReason?: string } {
    if (totalSourceCount === 0) {
      return { canCalculate: false, flagReason: 'NO_SOURCE_ITEMS_CONFIGURED' };
    }

    if (policy === 'complete_case') {
      if (validValues.length === totalSourceCount) {
        return { canCalculate: true };
      }
      return {
        canCalculate: false,
        flagReason: `INCOMPLETE_CASE_MISSING_${totalSourceCount - validValues.length}_ITEMS`,
      };
    }

    if (policy === 'available_case') {
      if (validValues.length >= 1) {
        return { canCalculate: true };
      }
      return { canCalculate: false, flagReason: 'NO_VALID_ITEMS_AVAILABLE' };
    }

    if (policy === 'minimum_required_items') {
      const required = typeof minimumRequired === 'number' && minimumRequired > 0
        ? minimumRequired
        : totalSourceCount;

      if (validValues.length >= required) {
        return { canCalculate: true };
      }
      return {
        canCalculate: false,
        flagReason: `MINIMUM_REQUIRED_NOT_MET_REQUIRED_${required}_FOUND_${validValues.length}`,
      };
    }

    return { canCalculate: false, flagReason: 'UNRECOGNIZED_MISSING_POLICY' };
  },

  /**
   * Validates whether a calculated score falls within mathematically possible bounds.
   */
  validateScoreBounds(
    score: number,
    method: ScoringMethod,
    validCount: number,
    expectedRange?: { min: number; max: number }
  ): { isValid: boolean; reason?: string } {
    if (!expectedRange || typeof expectedRange.min !== 'number' || typeof expectedRange.max !== 'number') {
      return { isValid: true };
    }

    const EPSILON = 1e-7;

    if (method === 'MEAN' || method === 'MEDIAN' || method === 'MIN' || method === 'MAX') {
      if (score < expectedRange.min - EPSILON || score > expectedRange.max + EPSILON) {
        return {
          isValid: false,
          reason: `SCORE_OUT_OF_BOUNDS_${score}_EXPECTED_[${expectedRange.min},${expectedRange.max}]`,
        };
      }
      return { isValid: true };
    }

    if (method === 'SUM') {
      const minPossible = expectedRange.min * validCount;
      const maxPossible = expectedRange.max * validCount;
      if (score < minPossible - EPSILON || score > maxPossible + EPSILON) {
        return {
          isValid: false,
          reason: `SUM_OUT_OF_BOUNDS_${score}_EXPECTED_[${minPossible},${maxPossible}]`,
        };
      }
      return { isValid: true };
    }

    return { isValid: true };
  },

  /**
   * Generates an explicit, non-AI human-readable rule summary directly from rule parameters.
   */
  generateRuleSummary(rule: {
    targetName: string;
    targetCode: string;
    method: ScoringMethod;
    sourceType?: ScoringSourceType;
    sourceItemCodes?: string[];
    sourceDimensionCodes?: string[];
    missingValuePolicy: ScoringMissingPolicy;
    minimumRequiredItems?: number;
  }): string {
    const sources = rule.sourceType === 'dimensions' && rule.sourceDimensionCodes?.length
      ? rule.sourceDimensionCodes.join(', ')
      : (rule.sourceItemCodes && rule.sourceItemCodes.length > 0 ? rule.sourceItemCodes.join(', ') : 'None');

    let policyText = '';
    if (rule.missingValuePolicy === 'complete_case') {
      policyText = 'requiring all source inputs to be present (Complete Case)';
    } else if (rule.missingValuePolicy === 'available_case') {
      policyText = 'calculated from available valid inputs (Available Case)';
    } else if (rule.missingValuePolicy === 'minimum_required_items') {
      policyText = `requiring at least ${rule.minimumRequiredItems ?? 'N'} valid source inputs`;
    }

    return `${rule.targetName} (${rule.targetCode}) = ${rule.method}(${sources}), ${policyText}.`;
  },

  // ==========================================
  // SCORING RULE MANAGEMENT
  // ==========================================

  getRulesByProject(projectId: string, userId: string): ServiceResult<ScoringRule[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    const allRules = this._getAllRules();
    const projectRules = allRules.filter(r => r.projectId === projectId);
    return { success: true, data: projectRules };
  },

  getRule(ruleId: string, userId: string): ServiceResult<ScoringRule> {
    const allRules = this._getAllRules();
    const rule = allRules.find(r => r.id === ruleId);
    if (!rule) {
      return { success: false, error: 'Scoring rule not found.', statusCode: 404 };
    }

    const pCheck = projectService.getProject(rule.projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    return { success: true, data: rule };
  },

  saveRule(
    payload: Omit<ScoringRule, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy'> & { id?: string; createdBy?: string },
    userId: string,
    userName: string
  ): ServiceResult<ScoringRule> {
    const pCheck = projectService.getProject(payload.projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    // Validation
    if (!payload.targetCode || !payload.targetName) {
      return { success: false, error: 'Target code and target name are required.', statusCode: 400 };
    }

    if (!payload.method) {
      return { success: false, error: 'Scoring method is required.', statusCode: 400 };
    }

    const hasItems = payload.sourceItemCodes && payload.sourceItemCodes.length > 0;
    const hasDims = payload.sourceDimensionCodes && payload.sourceDimensionCodes.length > 0;

    if (!hasItems && !hasDims) {
      return {
        success: false,
        error: 'At least one source item or source dimension must be selected.',
        statusCode: 400,
      };
    }

    if (payload.missingValuePolicy === 'minimum_required_items') {
      const totalCount = payload.sourceType === 'dimensions' ? (payload.sourceDimensionCodes?.length || 0) : (payload.sourceItemCodes?.length || 0);
      if (!payload.minimumRequiredItems || payload.minimumRequiredItems < 1 || payload.minimumRequiredItems > totalCount) {
        return {
          success: false,
          error: `Minimum required items must be between 1 and total source count (${totalCount}).`,
          statusCode: 400,
        };
      }
    }

    const allRules = this._getAllRules();
    const now = new Date().toISOString();

    if (payload.id) {
      const existingIdx = allRules.findIndex(r => r.id === payload.id);
      if (existingIdx === -1) {
        return { success: false, error: 'Scoring rule not found for update.', statusCode: 404 };
      }

      const existing = allRules[existingIdx];
      const updatedRule: ScoringRule = {
        ...existing,
        ...payload,
        id: existing.id,
        version: existing.version + 1,
        updatedAt: now,
      };

      allRules[existingIdx] = updatedRule;
      this._saveRules(allRules);

      auditService.logAction({
        userId,
        userName,
        projectId: payload.projectId,
        action: 'scoring_rule_updated',
        entityType: 'scoring_rule',
        entityId: updatedRule.id,
        entityName: updatedRule.targetName,
        metadata: {
          targetCode: updatedRule.targetCode,
          targetType: updatedRule.targetType,
          method: updatedRule.method,
          version: updatedRule.version,
        },
      });

      return { success: true, data: updatedRule };
    }

    // Create new rule
    const newRule: ScoringRule = {
      ...payload,
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    };

    allRules.push(newRule);
    this._saveRules(allRules);

    auditService.logAction({
      userId,
      userName,
      projectId: payload.projectId,
      action: 'scoring_rule_created',
      entityType: 'scoring_rule',
      entityId: newRule.id,
      entityName: newRule.targetName,
      metadata: {
        targetCode: newRule.targetCode,
        targetType: newRule.targetType,
        method: newRule.method,
        version: newRule.version,
      },
    });

    return { success: true, data: newRule };
  },

  deleteRule(ruleId: string, userId: string, userName: string): ServiceResult<boolean> {
    const allRules = this._getAllRules();
    const rule = allRules.find(r => r.id === ruleId);
    if (!rule) {
      return { success: false, error: 'Scoring rule not found.', statusCode: 404 };
    }

    const pCheck = projectService.getProject(rule.projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    const filtered = allRules.filter(r => r.id !== ruleId);
    this._saveRules(filtered);

    auditService.logAction({
      userId,
      userName,
      projectId: rule.projectId,
      action: 'scoring_rule_deleted',
      entityType: 'scoring_rule',
      entityId: rule.id,
      entityName: rule.targetName,
      metadata: { targetCode: rule.targetCode },
    });

    return { success: true, data: true };
  },

  /**
   * Helper that auto-generates standard MEAN scoring rules based on the construct & dimension operationalization
   * without overwriting existing custom rules.
   */
  autoGenerateDefaultRules(
    projectId: string,
    processingRunId: string,
    userId: string,
    userName: string
  ): ServiceResult<ScoringRule[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    const runs = processingService.getRunsByProject(projectId, userId);
    const targetRun = runs.data?.find(r => r.id === processingRunId);
    if (!targetRun) {
      return { success: false, error: 'Processing run not found.', statusCode: 404 };
    }

    const items = targetRun.rulesSnapshot.items;
    const vRes = variableService.getVariables(projectId, userId);
    const variables = vRes.data || [];

    const existingRules = this._getAllRules().filter(r => r.projectId === projectId);
    const createdRules: ScoringRule[] = [];

    // 1. Group items by Dimension
    const dimensionItemMap: Record<string, typeof items> = {};
    items.forEach(item => {
      if (item.dimensionId) {
        if (!dimensionItemMap[item.dimensionId]) {
          dimensionItemMap[item.dimensionId] = [];
        }
        dimensionItemMap[item.dimensionId].push(item);
      }
    });

    // 2. Create rules for Dimensions
    variables.forEach(v => {
      v.dimensions.forEach(d => {
        const dimItems = dimensionItemMap[d.id] || [];
        if (dimItems.length > 0) {
          const targetCode = `DIM_${d.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`;
          const alreadyExists = existingRules.some(r => r.targetId === d.id || r.targetCode === targetCode);

          if (!alreadyExists) {
            // Find scale min/max if available
            let expectedRange: { min: number; max: number } | undefined;
            const firstItemWithScale = dimItems.find(i => i.reverseCodingRule);
            if (firstItemWithScale?.reverseCodingRule) {
              expectedRange = {
                min: firstItemWithScale.reverseCodingRule.minValue,
                max: firstItemWithScale.reverseCodingRule.maxValue,
              };
            }

            const ruleRes = this.saveRule(
              {
                projectId,
                targetType: 'Dimension',
                targetId: d.id,
                targetCode,
                targetName: d.name,
                method: 'MEAN',
                sourceType: 'items',
                sourceItemIds: dimItems.map(i => i.itemId),
                sourceItemCodes: dimItems.map(i => i.itemCode),
                missingValuePolicy: 'available_case',
                minimumRequiredItems: Math.ceil(dimItems.length / 2),
                expectedRange,
                notes: `Auto-generated mean scoring rule for dimension ${d.name}`,
              },
              userId,
              userName
            );

            if (ruleRes.success && ruleRes.data) {
              createdRules.push(ruleRes.data);
              existingRules.push(ruleRes.data);
            }
          }
        }
      });

      // 3. Create rule for Variable/Construct
      // If variable has multiple dimensions, aggregate dimension scores;
      // If variable has 0 dimensions, aggregate all its items directly.
      const varDimensions = v.dimensions.filter(d => (dimensionItemMap[d.id] || []).length > 0);
      const varTargetCode = `VAR_${v.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`;
      const varAlreadyExists = existingRules.some(r => r.targetId === v.id || r.targetCode === varTargetCode);

      if (!varAlreadyExists) {
        if (varDimensions.length > 1) {
          // Construct score from dimensions
          const dimCodes = varDimensions.map(d => `DIM_${d.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
          const dimIds = varDimensions.map(d => d.id);

          const ruleRes = this.saveRule(
            {
              projectId,
              targetType: 'Variable',
              targetId: v.id,
              targetCode: varTargetCode,
              targetName: v.name,
              method: 'MEAN',
              sourceType: 'dimensions',
              sourceItemIds: [],
              sourceItemCodes: [],
              sourceDimensionIds: dimIds,
              sourceDimensionCodes: dimCodes,
              missingValuePolicy: 'available_case',
              minimumRequiredItems: Math.ceil(varDimensions.length / 2),
              notes: `Auto-generated composite mean construct score from ${varDimensions.length} dimensions`,
            },
            userId,
            userName
          );

          if (ruleRes.success && ruleRes.data) {
            createdRules.push(ruleRes.data);
            existingRules.push(ruleRes.data);
          }
        } else {
          // Construct score directly from all variable items
          const varItems = items.filter(i => i.variableId === v.id);
          if (varItems.length > 0) {
            let expectedRange: { min: number; max: number } | undefined;
            const firstItemWithScale = varItems.find(i => i.reverseCodingRule);
            if (firstItemWithScale?.reverseCodingRule) {
              expectedRange = {
                min: firstItemWithScale.reverseCodingRule.minValue,
                max: firstItemWithScale.reverseCodingRule.maxValue,
              };
            }

            const ruleRes = this.saveRule(
              {
                projectId,
                targetType: 'Variable',
                targetId: v.id,
                targetCode: varTargetCode,
                targetName: v.name,
                method: 'MEAN',
                sourceType: 'items',
                sourceItemIds: varItems.map(i => i.itemId),
                sourceItemCodes: varItems.map(i => i.itemCode),
                missingValuePolicy: 'available_case',
                minimumRequiredItems: Math.ceil(varItems.length / 2),
                expectedRange,
                notes: `Auto-generated mean construct score directly from ${varItems.length} items`,
              },
              userId,
              userName
            );

            if (ruleRes.success && ruleRes.data) {
              createdRules.push(ruleRes.data);
              existingRules.push(ruleRes.data);
            }
          }
        }
      }
    });

    return { success: true, data: createdRules };
  },

  // ==========================================
  // PREREQUISITES AND INTEGRITY VALIDATION
  // ==========================================

  checkPrerequisites(
    projectId: string,
    processingRunId: string | null,
    userId: string
  ): ServiceResult<ScoringPrerequisites> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    const reasons: string[] = [];
    const errorMessages: string[] = [];
    const warningMessages: string[] = [];

    const allProcessingRuns = processingService.getRunsByProject(projectId, userId).data || [];
    const completedRuns = allProcessingRuns.filter(r => r.status === 'Completed');

    if (allProcessingRuns.length === 0) {
      errorMessages.push('No Stage 6 Data Processing run exists yet. Execute data processing first.');
      reasons.push('Data Processing Run Required');
    } else if (completedRuns.length === 0) {
      errorMessages.push('No completed Data Processing run exists. The latest run may have failed or is pending.');
      reasons.push('Completed Processing Run Required');
    }

    let targetRun: ProcessingRun | undefined;
    if (processingRunId) {
      targetRun = completedRuns.find(r => r.id === processingRunId);
      if (!targetRun) {
        errorMessages.push(`Selected ProcessingRun (${processingRunId}) was not found or is not completed.`);
        reasons.push('Invalid Processing Run');
      }
    } else if (completedRuns.length > 0) {
      targetRun = completedRuns[0];
    }

    let processedRecordCount = 0;
    if (targetRun) {
      const allDatasets = processingService._getAllDatasets();
      const dataset = allDatasets.find(d => d.processingRunId === targetRun!.id);
      if (!dataset || dataset.records.length === 0) {
        errorMessages.push('The selected ProcessingRun has no processed records in its dataset.');
        reasons.push('Empty Processed Dataset');
      } else {
        processedRecordCount = dataset.records.length;
      }
    }

    const rules = this._getAllRules().filter(r => r.projectId === projectId);
    if (rules.length === 0) {
      warningMessages.push('No scoring rules have been configured yet. Define at least one rule to generate scores.');
      reasons.push('Scoring Rules Needed');
    }

    // Cross-version & item existence check
    if (targetRun && rules.length > 0) {
      const snapshotItemCodes = new Set(targetRun.rulesSnapshot.items.map(i => i.itemCode));
      const invalidRules: string[] = [];

      rules.forEach(rule => {
        if (rule.sourceType !== 'dimensions' && rule.sourceItemCodes && rule.sourceItemCodes.length > 0) {
          const missingCodes = rule.sourceItemCodes.filter(c => !snapshotItemCodes.has(c));
          if (missingCodes.length > 0) {
            invalidRules.push(
              `Rule "${rule.targetName}" references item codes (${missingCodes.join(', ')}) not found in Questionnaire Version ${targetRun!.rulesSnapshot.questionnaireVersionNumber}`
            );
          }
        }
      });

      if (invalidRules.length > 0) {
        errorMessages.push(...invalidRules);
        reasons.push('Version Mismatch: Rules reference items missing from questionnaire snapshot');
      }
    }

    const canScore = errorMessages.length === 0 && rules.length > 0 && processedRecordCount > 0;

    return {
      success: true,
      data: {
        canScore,
        reasons,
        processingRunExists: allProcessingRuns.length > 0,
        processingRunCompleted: completedRuns.length > 0,
        processedRecordCount,
        rulesConfiguredCount: rules.length,
        hasErrors: errorMessages.length > 0,
        errorMessages,
        warningMessages,
      },
    };
  },

  // ==========================================
  // PREVIEW GENERATION
  // ==========================================

  generatePreview(
    projectId: string,
    processingRunId: string,
    rules: ScoringRule[],
    limit: number = 5,
    userId: string
  ): ServiceResult<ScoringPreviewRow[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    const runs = processingService.getRunsByProject(projectId, userId);
    const targetRun = runs.data?.find(r => r.id === processingRunId);
    if (!targetRun) {
      return { success: false, error: 'Processing run not found.', statusCode: 404 };
    }

    const allDatasets = processingService._getAllDatasets();
    const dataset = allDatasets.find(d => d.processingRunId === processingRunId);
    if (!dataset || dataset.records.length === 0) {
      return { success: false, error: 'No processed records found for this run.', statusCode: 404 };
    }

    const sampleRecords = dataset.records.slice(0, limit);
    const previewRows: ScoringPreviewRow[] = [];

    // Separate dimension rules from variable rules so dimensions are scored first
    const dimensionRules = rules.filter(r => r.targetType === 'Dimension');
    const variableRules = rules.filter(r => r.targetType === 'Variable');

    for (const rec of sampleRecords) {
      const inputValues: Record<string, number | null> = {};
      const calculatedScores: ScoringPreviewRow['calculatedScores'] = {};

      // 1. Collect all input item values
      for (const [colName, valObj] of Object.entries(rec.items)) {
        inputValues[colName] = typeof valObj.processedValue === 'number' ? valObj.processedValue : null;
      }

      // 2. Score Dimensions first
      for (const rule of dimensionRules) {
        const itemCodes = rule.sourceItemCodes || [];
        const validValues: number[] = [];
        const missingCodes: string[] = [];

        itemCodes.forEach(code => {
          const itemVal = rec.items[code];
          if (itemVal && typeof itemVal.processedValue === 'number') {
            validValues.push(itemVal.processedValue);
          } else {
            missingCodes.push(code);
          }
        });

        const policyEval = this.evaluateMissingPolicy(
          itemCodes.length,
          validValues,
          rule.missingValuePolicy,
          rule.minimumRequiredItems
        );

        let finalScore: number | null = null;
        let status: ScoreStatus = 'Scored';
        let flagReason = policyEval.flagReason;

        if (policyEval.canCalculate) {
          finalScore = this.calculateScore(validValues, rule.method);
          if (finalScore !== null) {
            const bounds = this.validateScoreBounds(finalScore, rule.method, validValues.length, rule.expectedRange);
            if (!bounds.isValid) {
              status = 'Invalid';
              flagReason = bounds.reason;
            }
          } else {
            status = 'Error';
            flagReason = 'CALCULATION_RETURNED_NULL';
          }
        } else {
          status = 'Missing';
        }

        calculatedScores[rule.targetCode] = {
          score: finalScore,
          status,
          flagReason,
          validCount: validValues.length,
          totalCount: itemCodes.length,
          formulaSummary: this.generateRuleSummary(rule),
        };
      }

      // 3. Score Variables
      for (const rule of variableRules) {
        let validValues: number[] = [];
        let totalCount = 0;
        let missingCodes: string[] = [];

        if (rule.sourceType === 'dimensions' && rule.sourceDimensionCodes && rule.sourceDimensionCodes.length > 0) {
          totalCount = rule.sourceDimensionCodes.length;
          rule.sourceDimensionCodes.forEach(dimCode => {
            const dimScore = calculatedScores[dimCode]?.score;
            if (typeof dimScore === 'number') {
              validValues.push(dimScore);
            } else {
              missingCodes.push(dimCode);
            }
          });
        } else {
          const itemCodes = rule.sourceItemCodes || [];
          totalCount = itemCodes.length;
          itemCodes.forEach(code => {
            const itemVal = rec.items[code];
            if (itemVal && typeof itemVal.processedValue === 'number') {
              validValues.push(itemVal.processedValue);
            } else {
              missingCodes.push(code);
            }
          });
        }

        const policyEval = this.evaluateMissingPolicy(
          totalCount,
          validValues,
          rule.missingValuePolicy,
          rule.minimumRequiredItems
        );

        let finalScore: number | null = null;
        let status: ScoreStatus = 'Scored';
        let flagReason = policyEval.flagReason;

        if (policyEval.canCalculate) {
          finalScore = this.calculateScore(validValues, rule.method);
          if (finalScore !== null) {
            const bounds = this.validateScoreBounds(finalScore, rule.method, validValues.length, rule.expectedRange);
            if (!bounds.isValid) {
              status = 'Invalid';
              flagReason = bounds.reason;
            }
          } else {
            status = 'Error';
            flagReason = 'CALCULATION_RETURNED_NULL';
          }
        } else {
          status = 'Missing';
        }

        calculatedScores[rule.targetCode] = {
          score: finalScore,
          status,
          flagReason,
          validCount: validValues.length,
          totalCount,
          formulaSummary: this.generateRuleSummary(rule),
        };
      }

      previewRows.push({
        submissionId: rec.submissionId,
        participantIdentifier: rec.participantIdentifier,
        inputValues,
        calculatedScores,
      });
    }

    return { success: true, data: previewRows };
  },

  // ==========================================
  // SCORING ENGINE EXECUTION
  // ==========================================

  runScoring(params: RunScoringParams): ServiceResult<{ scoringRun: ScoringRun; dataset: ScoredDataset }> {
    const { projectId, processingRunId, rules, notes, userId, userName } = params;

    // 1. Multi-tenant authorization
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    // 2. Validate ProcessingRun
    const allProcessingRuns = processingService.getRunsByProject(projectId, userId).data || [];
    const processingRun = allProcessingRuns.find(r => r.id === processingRunId);

    if (!processingRun) {
      return {
        success: false,
        error: 'Source ProcessingRun not found.',
        statusCode: 404,
      };
    }

    if (processingRun.status !== 'Completed') {
      return {
        success: false,
        error: `Cannot score incomplete ProcessingRun (Status: ${processingRun.status}).`,
        statusCode: 400,
      };
    }

    // 3. Validate ProcessedDataset
    const allDatasets = processingService._getAllDatasets();
    const processedDataset = allDatasets.find(d => d.processingRunId === processingRunId);

    if (!processedDataset || processedDataset.records.length === 0) {
      return {
        success: false,
        error: 'Source ProcessedDataset not found or contains zero records.',
        statusCode: 400,
      };
    }

    // 4. Validate Rules
    if (!rules || rules.length === 0) {
      return {
        success: false,
        error: 'At least one scoring rule is required to execute scoring.',
        statusCode: 400,
      };
    }

    // Cross-version validation
    const snapshotItemCodes = new Set(processingRun.rulesSnapshot.items.map(i => i.itemCode));
    for (const rule of rules) {
      if (rule.sourceType !== 'dimensions' && rule.sourceItemCodes) {
        for (const code of rule.sourceItemCodes) {
          if (!snapshotItemCodes.has(code)) {
            return {
              success: false,
              error: `Cross-version safety violation: Rule "${rule.targetName}" references item "${code}" which is not present in Questionnaire Version ${processingRun.rulesSnapshot.questionnaireVersionNumber}.`,
              statusCode: 400,
            };
          }
        }
      }
    }

    // Check duplicate target codes
    const targetCodes = rules.map(r => r.targetCode);
    const uniqueTargetCodes = new Set(targetCodes);
    if (uniqueTargetCodes.size !== targetCodes.length) {
      return {
        success: false,
        error: 'Duplicate target codes found in scoring rules. Each target code must be unique.',
        statusCode: 400,
      };
    }

    const now = new Date().toISOString();
    const runId = `sc_run_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const datasetId = `sc_ds_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // 5. Create immutable ScoringRulesSnapshot
    const ruleSnapshotItems: ScoringRuleSnapshotItem[] = rules.map(r => ({
      ruleId: r.id,
      targetType: r.targetType,
      targetId: r.targetId,
      targetCode: r.targetCode,
      targetName: r.targetName,
      method: r.method,
      sourceType: r.sourceType,
      sourceItemIds: r.sourceItemIds,
      sourceItemCodes: r.sourceItemCodes,
      sourceDimensionIds: r.sourceDimensionIds,
      sourceDimensionCodes: r.sourceDimensionCodes,
      missingValuePolicy: r.missingValuePolicy,
      minimumRequiredItems: r.minimumRequiredItems,
      expectedRange: r.expectedRange,
      version: r.version,
    }));

    const rulesSnapshot: ScoringRulesSnapshot = {
      snapshotId: `sc_snap_${Date.now()}`,
      projectId,
      processingRunId,
      questionnaireId: processingRun.questionnaireId,
      questionnaireVersionId: processingRun.questionnaireVersionId,
      capturedAt: now,
      rules: ruleSnapshotItems,
    };

    // 6. Create initial ScoringRun
    const scoringRun: ScoringRun = {
      id: runId,
      projectId,
      processingRunId,
      questionnaireId: processingRun.questionnaireId,
      questionnaireVersionId: processingRun.questionnaireVersionId,
      createdBy: userId,
      createdAt: now,
      status: 'Running',
      sourceRecordCount: processedDataset.records.length,
      scoredRecordCount: 0,
      rulesSnapshot,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      warnings: [],
      notes,
    };

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'scoring_run_created',
      entityType: 'scoring_run',
      entityId: runId,
      entityName: `Scoring Run #${runId.substring(runId.length - 6)}`,
      metadata: {
        processingRunId,
        rulesCount: rules.length,
        sourceRecordCount: processedDataset.records.length,
      },
    });

    try {
      // 7. Execute Deterministic Scoring on each ProcessedRecord
      const dimensionRules = ruleSnapshotItems.filter(r => r.targetType === 'Dimension');
      const variableRules = ruleSnapshotItems.filter(r => r.targetType === 'Variable');

      const scoredRecords: ScoredRecord[] = [];
      const errors: ScoringRunError[] = [];
      const warnings: ScoringRunWarning[] = [];

      for (const procRec of processedDataset.records) {
        const scores: Record<string, number | null> = {};
        const scoreMetadata: Record<string, ScoreTargetMetadata> = {};

        // Phase A: Calculate Dimension Scores
        for (const dimRule of dimensionRules) {
          const itemCodes = dimRule.sourceItemCodes || [];
          const validValues: number[] = [];
          const missingCodes: string[] = [];
          const sourceValues: Record<string, number | null> = {};

          itemCodes.forEach(code => {
            const itemObj = procRec.items[code];
            if (itemObj && typeof itemObj.processedValue === 'number') {
              validValues.push(itemObj.processedValue);
              sourceValues[code] = itemObj.processedValue;
            } else {
              missingCodes.push(code);
              sourceValues[code] = null;
            }
          });

          const policyEval = this.evaluateMissingPolicy(
            itemCodes.length,
            validValues,
            dimRule.missingValuePolicy,
            dimRule.minimumRequiredItems
          );

          let finalScore: number | null = null;
          let status: ScoreStatus = 'Scored';
          let flagReason = policyEval.flagReason;

          if (policyEval.canCalculate) {
            finalScore = this.calculateScore(validValues, dimRule.method);
            if (finalScore !== null) {
              const bounds = this.validateScoreBounds(
                finalScore,
                dimRule.method,
                validValues.length,
                dimRule.expectedRange
              );
              if (!bounds.isValid) {
                status = 'Invalid';
                flagReason = bounds.reason;
                warnings.push({
                  submissionId: procRec.submissionId,
                  targetCode: dimRule.targetCode,
                  warningType: 'SCORE_OUT_OF_BOUNDS',
                  message: `Score ${finalScore} for ${dimRule.targetCode} exceeded mathematical bounds.`,
                });
              }
            } else {
              status = 'Error';
              flagReason = 'CALCULATION_NULL';
              errors.push({
                submissionId: procRec.submissionId,
                targetCode: dimRule.targetCode,
                errorType: 'CALCULATION_ERROR',
                message: `Calculation returned null for ${dimRule.targetCode}.`,
              });
            }
          } else {
            status = 'Missing';
          }

          scores[dimRule.targetCode] = finalScore;
          scoreMetadata[dimRule.targetCode] = {
            targetCode: dimRule.targetCode,
            targetName: dimRule.targetName,
            targetType: dimRule.targetType,
            method: dimRule.method,
            score: finalScore,
            status,
            flagReason,
            totalSourceItems: itemCodes.length,
            validItemCount: validValues.length,
            missingItemCount: missingCodes.length,
            missingItemCodes: missingCodes,
            missingValuePolicy: dimRule.missingValuePolicy,
            minimumRequiredItems: dimRule.minimumRequiredItems,
            sourceValues,
            formulaSummary: this.generateRuleSummary(dimRule),
          };
        }

        // Phase B: Calculate Variable / Construct Scores
        for (const varRule of variableRules) {
          const validValues: number[] = [];
          const missingCodes: string[] = [];
          const sourceValues: Record<string, number | null> = {};
          let totalCount = 0;

          if (varRule.sourceType === 'dimensions' && varRule.sourceDimensionCodes?.length) {
            totalCount = varRule.sourceDimensionCodes.length;
            varRule.sourceDimensionCodes.forEach(dimCode => {
              const dimScore = scores[dimCode];
              if (typeof dimScore === 'number') {
                validValues.push(dimScore);
                sourceValues[dimCode] = dimScore;
              } else {
                missingCodes.push(dimCode);
                sourceValues[dimCode] = null;
              }
            });
          } else {
            const itemCodes = varRule.sourceItemCodes || [];
            totalCount = itemCodes.length;
            itemCodes.forEach(code => {
              const itemObj = procRec.items[code];
              if (itemObj && typeof itemObj.processedValue === 'number') {
                validValues.push(itemObj.processedValue);
                sourceValues[code] = itemObj.processedValue;
              } else {
                missingCodes.push(code);
                sourceValues[code] = null;
              }
            });
          }

          const policyEval = this.evaluateMissingPolicy(
            totalCount,
            validValues,
            varRule.missingValuePolicy,
            varRule.minimumRequiredItems
          );

          let finalScore: number | null = null;
          let status: ScoreStatus = 'Scored';
          let flagReason = policyEval.flagReason;

          if (policyEval.canCalculate) {
            finalScore = this.calculateScore(validValues, varRule.method);
            if (finalScore !== null) {
              const bounds = this.validateScoreBounds(
                finalScore,
                varRule.method,
                validValues.length,
                varRule.expectedRange
              );
              if (!bounds.isValid) {
                status = 'Invalid';
                flagReason = bounds.reason;
                warnings.push({
                  submissionId: procRec.submissionId,
                  targetCode: varRule.targetCode,
                  warningType: 'SCORE_OUT_OF_BOUNDS',
                  message: `Score ${finalScore} for construct ${varRule.targetCode} exceeded expected bounds.`,
                });
              }
            } else {
              status = 'Error';
              flagReason = 'CALCULATION_NULL';
              errors.push({
                submissionId: procRec.submissionId,
                targetCode: varRule.targetCode,
                errorType: 'CALCULATION_ERROR',
                message: `Calculation returned null for construct ${varRule.targetCode}.`,
              });
            }
          } else {
            status = 'Missing';
          }

          scores[varRule.targetCode] = finalScore;
          scoreMetadata[varRule.targetCode] = {
            targetCode: varRule.targetCode,
            targetName: varRule.targetName,
            targetType: varRule.targetType,
            method: varRule.method,
            score: finalScore,
            status,
            flagReason,
            totalSourceItems: totalCount,
            validItemCount: validValues.length,
            missingItemCount: missingCodes.length,
            missingItemCodes: missingCodes,
            missingValuePolicy: varRule.missingValuePolicy,
            minimumRequiredItems: varRule.minimumRequiredItems,
            sourceValues,
            formulaSummary: this.generateRuleSummary(varRule),
          };
        }

        const anyMissing = Object.values(scoreMetadata).some(m => m.status === 'Missing');
        const anyInvalid = Object.values(scoreMetadata).some(m => m.status === 'Invalid' || m.status === 'Error');
        const recordStatus = anyInvalid ? 'flagged' : anyMissing ? 'incomplete' : 'valid';

        const scoredRec: ScoredRecord = {
          id: `sc_rec_${Date.now()}_${procRec.id}`,
          scoringRunId: runId,
          processingRunId,
          projectId,
          sourceProcessedRecordId: procRec.id,
          sourceSubmissionId: procRec.submissionId,
          questionnaireVersionId: procRec.questionnaireVersionId,
          participantIdentifier: procRec.participantIdentifier,
          submittedAt: procRec.submittedAt,
          scores,
          scoreMetadata,
          status: recordStatus,
          createdAt: now,
        };

        scoredRecords.push(scoredRec);
      }

      // 8. Build ScoredDataset Columns
      const columns: ScoredDatasetColumn[] = ruleSnapshotItems.map(r => ({
        targetCode: r.targetCode,
        targetName: r.targetName,
        targetType: r.targetType,
        method: r.method,
        sourceType: r.sourceType,
        sourceCodes: r.sourceType === 'dimensions' ? (r.sourceDimensionCodes || []) : (r.sourceItemCodes || []),
        missingValuePolicy: r.missingValuePolicy,
        expectedMin: r.expectedRange?.min,
        expectedMax: r.expectedRange?.max,
      }));

      // 9. Assemble ScoredDataset
      const scoredDataset: ScoredDataset = {
        id: datasetId,
        scoringRunId: runId,
        processingRunId,
        projectId,
        questionnaireId: processingRun.questionnaireId,
        questionnaireVersionId: processingRun.questionnaireVersionId,
        createdAt: now,
        recordCount: scoredRecords.length,
        columns,
        records: scoredRecords,
      };

      // 10. Complete the ScoringRun
      scoringRun.status = errors.length > 0 && scoredRecords.length === 0 ? 'Failed' : 'Completed';
      scoringRun.completedAt = new Date().toISOString();
      scoringRun.scoredRecordCount = scoredRecords.length;
      scoringRun.errorCount = errors.length;
      scoringRun.warningCount = warnings.length;
      scoringRun.errors = errors;
      scoringRun.warnings = warnings;

      // 11. Persist immutable records
      const allRuns = this._getAllRuns();
      allRuns.unshift(scoringRun);
      this._saveRuns(allRuns);

      const allSavedDatasets = this._getAllDatasets();
      allSavedDatasets.unshift(scoredDataset);
      this._saveDatasets(allSavedDatasets);

      auditService.logAction({
        userId,
        userName,
        projectId,
        action: 'scoring_run_completed',
        entityType: 'scoring_run',
        entityId: runId,
        entityName: `Scoring Run #${runId.substring(runId.length - 6)}`,
        metadata: {
          processingRunId,
          datasetId,
          scoredRecordCount: scoredRecords.length,
          errorCount: errors.length,
          warningCount: warnings.length,
        },
      });

      return {
        success: true,
        data: {
          scoringRun,
          dataset: scoredDataset,
        },
      };
    } catch (err: any) {
      scoringRun.status = 'Failed';
      scoringRun.completedAt = new Date().toISOString();
      scoringRun.errorCount = 1;
      scoringRun.errors = [
        {
          errorType: 'SYSTEM_EXECUTION_ERROR',
          message: err?.message || 'Unexpected failure during scoring execution.',
        },
      ];

      const allRuns = this._getAllRuns();
      allRuns.unshift(scoringRun);
      this._saveRuns(allRuns);

      auditService.logAction({
        userId,
        userName,
        projectId,
        action: 'scoring_run_failed',
        entityType: 'scoring_run',
        entityId: runId,
        entityName: `Scoring Run #${runId.substring(runId.length - 6)}`,
        metadata: { error: err?.message || 'Unknown error' },
      });

      return {
        success: false,
        error: `Scoring run failed: ${err?.message || 'Unknown error'}`,
        statusCode: 500,
      };
    }
  },

  // ==========================================
  // QUERY & ACCESSORS
  // ==========================================

  getRunsByProject(projectId: string, userId: string): ServiceResult<ScoringRun[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    const allRuns = this._getAllRuns();
    const projectRuns = allRuns.filter(r => r.projectId === projectId);
    return { success: true, data: projectRuns };
  },

  getDatasetByRunId(scoringRunId: string, userId: string): ServiceResult<ScoredDataset> {
    const allRuns = this._getAllRuns();
    const run = allRuns.find(r => r.id === scoringRunId);
    if (!run) {
      return { success: false, error: 'Scoring run not found.', statusCode: 404 };
    }

    const pCheck = projectService.getProject(run.projectId, userId);
    if (!pCheck.success) {
      return {
        success: false,
        error: 'Access denied: You do not own this research project.',
        statusCode: 403,
      };
    }

    const allDatasets = this._getAllDatasets();
    const dataset = allDatasets.find(d => d.scoringRunId === scoringRunId);
    if (!dataset) {
      return { success: false, error: 'Scored dataset not found for run.', statusCode: 404 };
    }

    return { success: true, data: dataset };
  },

  // ==========================================
  // DETERMINISTIC EXPORT ENGINES
  // ==========================================

  /**
   * Generates standard comma-separated values (CSV) for the scored dataset.
   * Format:
   * submission_id, participant_identifier, processing_run_id, scoring_run_id, submitted_at, <TARGET_1>, <TARGET_2>, ...
   */
  generateScoredDatasetCsv(dataset: ScoredDataset): string {
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const targetCols = dataset.columns.map(c => c.targetCode);
    const headers = [
      'submission_id',
      'participant_identifier',
      'processing_run_id',
      'scoring_run_id',
      'submitted_at',
      'status',
      ...targetCols,
    ];

    const rows: string[] = [headers.join(',')];

    for (const rec of dataset.records) {
      const rowVals: string[] = [
        escapeCsv(rec.sourceSubmissionId),
        escapeCsv(rec.participantIdentifier || ''),
        escapeCsv(rec.processingRunId),
        escapeCsv(rec.scoringRunId),
        escapeCsv(rec.submittedAt),
        escapeCsv(rec.status),
      ];

      for (const col of targetCols) {
        const scoreVal = rec.scores[col];
        // Retain unrounded numeric precision in export
        rowVals.push(scoreVal !== null && scoreVal !== undefined ? String(scoreVal) : '');
      }

      rows.push(rowVals.join(','));
    }

    return rows.join('\n');
  },

  /**
   * Generates a deterministic scoring codebook CSV from an immutable ScoringRulesSnapshot.
   */
  generateScoringCodebookCsv(snapshot: ScoringRulesSnapshot): string {
    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const headers = [
      'project_id',
      'processing_run_id',
      'snapshot_id',
      'target_type',
      'target_code',
      'target_name',
      'scoring_method',
      'source_type',
      'source_codes',
      'missing_value_policy',
      'minimum_required_items',
      'expected_range',
      'formula_description',
      'rule_version',
    ];

    const rows: string[] = [headers.join(',')];

    for (const rule of snapshot.rules) {
      const sourceCodes = rule.sourceType === 'dimensions'
        ? (rule.sourceDimensionCodes?.join('; ') || '')
        : (rule.sourceItemCodes?.join('; ') || '');

      const expectedRangeStr = rule.expectedRange
        ? `[${rule.expectedRange.min}, ${rule.expectedRange.max}]`
        : 'Not Specified';

      const minReqStr = rule.missingValuePolicy === 'minimum_required_items'
        ? String(rule.minimumRequiredItems ?? 'All')
        : rule.missingValuePolicy === 'complete_case'
        ? 'All'
        : '1';

      const formula = this.generateRuleSummary(rule);

      const rowVals = [
        escapeCsv(snapshot.projectId),
        escapeCsv(snapshot.processingRunId),
        escapeCsv(snapshot.snapshotId),
        escapeCsv(rule.targetType),
        escapeCsv(rule.targetCode),
        escapeCsv(rule.targetName),
        escapeCsv(rule.method),
        escapeCsv(rule.sourceType),
        escapeCsv(sourceCodes),
        escapeCsv(rule.missingValuePolicy),
        escapeCsv(minReqStr),
        escapeCsv(expectedRangeStr),
        escapeCsv(formula),
        escapeCsv(rule.version),
      ];

      rows.push(rowVals.join(','));
    }

    return rows.join('\n');
  },
};
