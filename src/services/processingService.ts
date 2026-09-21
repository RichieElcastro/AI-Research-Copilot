/**
 * Quantitative Research Platform - Stage 6 Data Processing Engine
 * 
 * Strict Architectural Guarantees:
 * 1. Raw Data Immutability: SurveySubmission and rawResponses are NEVER modified, overwritten, or deleted.
 * 2. Deterministic Pipeline: RAW DATA -> CODING -> REVERSE CODING -> MISSING VALUE HANDLING -> PROCESSED DATASET -> CODEBOOK.
 * 3. NO AI/LLM for deterministic coding or reverse scoring.
 * 4. Reproducibility: Every transformation event records an immutable rulesSnapshot.
 * 5. Full Provenance: Every processed record links back to its raw submissionId.
 */

import {
  Codebook,
  CodebookEntry,
  ItemProcessingFlagReason,
  ItemProcessingStatus,
  ItemType,
  MissingValuePolicy,
  ProcessedDataset,
  ProcessedDatasetColumn,
  ProcessedItemValue,
  ProcessedRecord,
  ProcessingItemRuleSnapshot,
  ProcessingPrerequisites,
  ProcessingPreviewRow,
  ProcessingRulesSnapshot,
  ProcessingRun,
  ProcessingRunError,
  ProcessingRunStatus,
  ProcessingRunWarning,
  QuestionnaireItemSnapshot,
  QuestionnaireVersion,
  ResponseScaleOption,
  SurveySubmission,
} from '../types';
import { auditService } from './auditService';
import { projectService, ServiceResult } from './projectService';
import { questionnaireService } from './questionnaireService';
import { submissionService } from './submissionService';

let memoryRuns: ProcessingRun[] = [];
let memoryDatasets: ProcessedDataset[] = [];
let memoryCodebooks: Codebook[] = [];

export interface RunProcessingParams {
  projectId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  missingValuePolicy: MissingValuePolicy;
  userMissingCode?: number | string;
  notes?: string;
  userId: string;
  userName: string;
}

export const processingService = {
  // ==========================================
  // STORAGE ACCESSORS
  // ==========================================

  _getAllRuns(): ProcessingRun[] {
    return memoryRuns;
  },

  _saveRuns(runs: ProcessingRun[]): void {
    memoryRuns = runs;
  },

  _getAllDatasets(): ProcessedDataset[] {
    return memoryDatasets;
  },

  _saveDatasets(datasets: ProcessedDataset[]): void {
    memoryDatasets = datasets;
  },

  _getAllCodebooks(): Codebook[] {
    return memoryCodebooks;
  },

  _saveCodebooks(codebooks: Codebook[]): void {
    memoryCodebooks = codebooks;
  },

  // ==========================================
  // DETERMINISTIC CODING ENGINE
  // ==========================================

  /**
   * Deterministically maps a raw participant response to its numeric or structured code
   * using the explicit response scale options embedded in the questionnaire snapshot.
   */
  codeRawValue(
    rawValue: string | null | undefined,
    item: QuestionnaireItemSnapshot,
    scaleOptions: ResponseScaleOption[] | undefined,
    codingMap: Record<string, number | string>
  ): {
    codedValue: number | string | null;
    status: ItemProcessingStatus;
    flagReason?: ItemProcessingFlagReason;
  } {
    // 1. Missing value check
    if (rawValue === undefined || rawValue === null || rawValue.trim() === '') {
      return {
        codedValue: null,
        status: 'Missing',
        flagReason: 'MISSING_VALUE',
      };
    }

    const trimmed = rawValue.trim();

    // 2. Short Text items: preserve raw text, remain uncoded
    if (item.itemType === 'Short Text') {
      return {
        codedValue: null,
        status: 'Uncoded',
        flagReason: 'TEXT_UNCODED',
      };
    }

    // 3. Numeric items: preserve and validate numeric representation
    if (item.itemType === 'Numeric') {
      const parsedNum = Number(trimmed);
      if (isNaN(parsedNum)) {
        return {
          codedValue: null,
          status: 'Invalid',
          flagReason: 'INVALID_NUMERIC',
        };
      }
      return {
        codedValue: parsedNum,
        status: 'Processed',
      };
    }

    // 4. Likert, Single Choice, Multiple Choice, Yes/No
    // Normalize lookup: lowercase trimmed label
    const normalizedKey = trimmed.toLowerCase();

    // Check precomputed codingMap first
    if (codingMap[normalizedKey] !== undefined) {
      const code = codingMap[normalizedKey];
      return {
        codedValue: code,
        status: 'Processed',
      };
    }

    // Check direct match on option value if participant answered with the numeric code as string
    if (scaleOptions && scaleOptions.length > 0) {
      const valMatch = scaleOptions.find(opt => String(opt.value) === trimmed);
      if (valMatch) {
        return {
          codedValue: valMatch.value,
          status: 'Processed',
        };
      }

      // Check case-insensitive match on option label
      const labelMatch = scaleOptions.find(
        opt => opt.label.trim().toLowerCase() === normalizedKey
      );
      if (labelMatch) {
        return {
          codedValue: labelMatch.value,
          status: 'Processed',
        };
      }

      // If options exist but no match is found, do NOT guess
      return {
        codedValue: null,
        status: 'Error',
        flagReason: 'UNMAPPED_OPTION',
      };
    }

    // 5. If no scale options exist for a scale/choice item, rule is missing
    if (item.itemType === 'Likert' || item.itemType === 'Single Choice' || item.itemType === 'Multiple Choice') {
      return {
        codedValue: null,
        status: 'Error',
        flagReason: 'CODING_RULE_MISSING',
      };
    }

    // 6. Yes/No fallback if no options explicitly defined
    if (item.itemType === 'Yes/No') {
      if (normalizedKey === 'yes' || normalizedKey === 'true') {
        return { codedValue: 1, status: 'Processed' };
      }
      if (normalizedKey === 'no' || normalizedKey === 'false') {
        return { codedValue: 0, status: 'Processed' };
      }
      return {
        codedValue: null,
        status: 'Error',
        flagReason: 'UNMAPPED_OPTION',
      };
    }

    return {
      codedValue: null,
      status: 'Uncoded',
      flagReason: 'CODING_RULE_MISSING',
    };
  },

  // ==========================================
  // DETERMINISTIC REVERSE CODING ENGINE
  // ==========================================

  /**
   * Deterministically applies reverse coding: reverseValue = max + min - originalValue
   * Requires explicit scale bounds (min and max).
   * Transformation order: RAW VALUE -> CODING -> REVERSE CODING -> PROCESSED VALUE.
   */
  reverseCodeValue(
    codedValue: number | string | null,
    reverseRule: { minValue: number; maxValue: number; formula: string } | null | undefined,
    reverseCoded: boolean
  ): {
    reverseCodedValue: number | null;
    statusOverride?: ItemProcessingStatus;
    flagReason?: ItemProcessingFlagReason;
  } {
    // If not flagged for reverse coding or not numeric, pass through
    if (!reverseCoded || codedValue === null || typeof codedValue !== 'number') {
      return {
        reverseCodedValue: typeof codedValue === 'number' ? codedValue : null,
      };
    }

    // If reverse coding is requested but bounds are missing, generate error
    if (!reverseRule || isNaN(reverseRule.minValue) || isNaN(reverseRule.maxValue) || reverseRule.maxValue <= reverseRule.minValue) {
      return {
        reverseCodedValue: null,
        statusOverride: 'Error',
        flagReason: 'REVERSE_RULE_MISSING',
      };
    }

    // Formula: reverseValue = max + min - originalValue
    const reversed = reverseRule.maxValue + reverseRule.minValue - codedValue;

    return {
      reverseCodedValue: reversed,
    };
  },

  // ==========================================
  // MISSING VALUE POLICY HANDLER
  // ==========================================

  /**
   * Applies missing value policy without statistical imputation.
   */
  applyMissingPolicy(
    policy: MissingValuePolicy,
    userMissingCode?: number | string
  ): number | string | null {
    if (policy === 'user_defined_code' && userMissingCode !== undefined && userMissingCode !== '') {
      const parsed = Number(userMissingCode);
      return isNaN(parsed) ? userMissingCode : parsed;
    }
    return null; // Preserve missing as null
  },

  // ==========================================
  // RULES SNAPSHOT BUILDER
  // ==========================================

  /**
   * Builds an immutable rules snapshot from the questionnaire items snapshot and scale definitions.
   * Resolves item code collisions across multiple instruments deterministically.
   */
  buildRulesSnapshot(
    projectId: string,
    questionnaireId: string,
    questionnaireTitle: string,
    version: QuestionnaireVersion,
    missingValuePolicy: MissingValuePolicy,
    userMissingCode?: number | string
  ): ProcessingRulesSnapshot {
    const itemCodeCounts: Record<string, number> = {};
    for (const item of version.itemsSnapshot) {
      itemCodeCounts[item.itemCode] = (itemCodeCounts[item.itemCode] || 0) + 1;
    }

    const seenItemCodes: Record<string, number> = {};

    const items: ProcessingItemRuleSnapshot[] = version.itemsSnapshot.map(item => {
      // Column name collision resolution
      let columnName = item.itemCode;
      if (itemCodeCounts[item.itemCode] > 1) {
        const occ = (seenItemCodes[item.itemCode] || 0) + 1;
        seenItemCodes[item.itemCode] = occ;
        columnName = `${item.itemCode}_inst_${occ}`;
      }

      // Build explicit codingMap
      const codingMap: Record<string, number | string> = {};
      let minVal = Infinity;
      let maxVal = -Infinity;

      if (item.scaleOptions && item.scaleOptions.length > 0) {
        for (const opt of item.scaleOptions) {
          codingMap[opt.label.trim().toLowerCase()] = opt.value;
          codingMap[String(opt.value)] = opt.value;
          if (typeof opt.value === 'number') {
            if (opt.value < minVal) minVal = opt.value;
            if (opt.value > maxVal) maxVal = opt.value;
          }
        }
      } else if (item.itemType === 'Yes/No') {
        codingMap['yes'] = 1;
        codingMap['no'] = 0;
        codingMap['true'] = 1;
        codingMap['false'] = 0;
        minVal = 0;
        maxVal = 1;
      }

      // Reverse coding rule
      let reverseCodingRule: { minValue: number; maxValue: number; formula: string } | null = null;
      if (item.reverseCoded) {
        if (minVal !== Infinity && maxVal !== -Infinity && maxVal > minVal) {
          reverseCodingRule = {
            minValue: minVal,
            maxValue: maxVal,
            formula: `max(${maxVal}) + min(${minVal}) - x`,
          };
        }
      }

      return {
        itemId: item.id,
        itemCode: item.itemCode,
        columnName,
        itemNumber: item.itemNumber,
        questionText: item.questionText,
        itemType: item.itemType,
        variableId: item.variableId,
        variableName: item.variableName,
        dimensionId: item.dimensionId,
        dimensionName: item.dimensionName,
        indicatorId: item.indicatorId,
        indicatorName: item.indicatorName,
        responseScaleId: item.responseScaleId,
        responseScaleName: item.responseScaleName,
        responseScaleType: item.responseScaleType,
        scaleOptions: item.scaleOptions,
        codingMap,
        reverseCoded: item.reverseCoded,
        reverseCodingRule,
        missingValuePolicy,
        userMissingCode,
        notes: item.notes,
      };
    });

    return {
      createdAt: new Date().toISOString(),
      projectId,
      questionnaireId,
      questionnaireTitle,
      questionnaireVersionId: version.id,
      questionnaireVersionNumber: version.versionNumber,
      missingValuePolicy,
      userMissingCode,
      items,
    };
  },

  // ==========================================
  // PREREQUISITES & PREVIEW
  // ==========================================

  /**
   * Validates prerequisites for data processing.
   */
  getProcessingPrerequisites(
    questionnaireId: string,
    projectId: string,
    userId: string
  ): ServiceResult<ProcessingPrerequisites> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const allQ = questionnaireService._getAllQuestionnaires();
    const q = allQ.find(item => item.id === questionnaireId && item.projectId === projectId);
    if (!q) {
      return { success: false, error: 'Questionnaire not found in project.', statusCode: 404 };
    }

    const allVersions = questionnaireService._getAllVersions();
    const version = allVersions.find(
      v => v.questionnaireId === q.id && v.versionNumber === q.currentVersion
    );
    if (!version) {
      return {
        success: true,
        data: {
          canProcess: false,
          reasons: ['No locked questionnaire version snapshot found.'],
          submissionCount: 0,
          itemCount: 0,
          hasErrors: true,
          errorMessages: ['Cannot process without a locked questionnaire version snapshot.'],
          warningMessages: [],
        },
        statusCode: 200,
      };
    }

    const subRes = submissionService.getByQuestionnaire(q.id, projectId, userId);
    const submissions = (subRes.data || []).filter(s => s.status === 'Submitted');

    const errorMessages: string[] = [];
    const warningMessages: string[] = [];

    if (submissions.length === 0) {
      errorMessages.push('No submitted participant responses available to process.');
    }

    if (!version.itemsSnapshot || version.itemsSnapshot.length === 0) {
      errorMessages.push('Questionnaire version snapshot contains zero items.');
    }

    // Check item scales
    for (const item of version.itemsSnapshot || []) {
      if (item.itemType === 'Likert' && (!item.scaleOptions || item.scaleOptions.length === 0)) {
        errorMessages.push(`Likert item "${item.itemCode}" is missing explicit scale options.`);
      }
      if (item.reverseCoded) {
        if (!item.scaleOptions || item.scaleOptions.length < 2) {
          errorMessages.push(`Reverse-coded item "${item.itemCode}" lacks scale boundaries for mathematical reversal.`);
        }
      }
      if (item.itemType === 'Short Text') {
        warningMessages.push(`Short Text item "${item.itemCode}" will remain uncoded (qualitative responses preserved).`);
      }
    }

    // Flagged submissions warning
    const flaggedCount = submissions.filter(s => s.validationStatus === 'Flagged').length;
    if (flaggedCount > 0) {
      warningMessages.push(`${flaggedCount} submission(s) have data collection quality flags (e.g. speeder/straightline) which will be carried forward.`);
    }

    const canProcess = errorMessages.length === 0 && submissions.length > 0;

    return {
      success: true,
      data: {
        canProcess,
        reasons: errorMessages,
        submissionCount: submissions.length,
        itemCount: version.itemsSnapshot ? version.itemsSnapshot.length : 0,
        hasErrors: errorMessages.length > 0,
        errorMessages,
        warningMessages,
      },
      statusCode: 200,
    };
  },

  /**
   * Generates an item-by-item processing preview based on a sample submission or default rules.
   */
  generateProcessingPreview(
    questionnaireId: string,
    projectId: string,
    userId: string,
    missingValuePolicy: MissingValuePolicy = 'preserve_missing',
    userMissingCode?: number | string
  ): ServiceResult<ProcessingPreviewRow[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const allQ = questionnaireService._getAllQuestionnaires();
    const q = allQ.find(item => item.id === questionnaireId && item.projectId === projectId);
    if (!q) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    const allVersions = questionnaireService._getAllVersions();
    const version = allVersions.find(
      v => v.questionnaireId === q.id && v.versionNumber === q.currentVersion
    );
    if (!version) {
      return { success: false, error: 'Questionnaire version not found.', statusCode: 404 };
    }

    const subRes = submissionService.getByQuestionnaire(q.id, projectId, userId);
    const submissions = (subRes.data || []).filter(s => s.status === 'Submitted');
    const sampleSub = submissions[0] || null;

    const snapshot = this.buildRulesSnapshot(
      projectId,
      q.id,
      q.title,
      version,
      missingValuePolicy,
      userMissingCode
    );

    const previewRows: ProcessingPreviewRow[] = snapshot.items.map(rule => {
      // Find raw value from sample submission if present
      let sampleRaw = '';
      if (sampleSub && sampleSub.rawResponses[rule.itemCode] !== undefined) {
        sampleRaw = sampleSub.rawResponses[rule.itemCode];
      } else if (rule.scaleOptions && rule.scaleOptions.length > 0) {
        // Mock sample for preview if no submissions exist yet
        sampleRaw = rule.scaleOptions[rule.scaleOptions.length - 1]?.label || '';
      } else if (rule.itemType === 'Numeric') {
        sampleRaw = '42';
      } else if (rule.itemType === 'Yes/No') {
        sampleRaw = 'Yes';
      } else if (rule.itemType === 'Short Text') {
        sampleRaw = 'Sample qualitative text';
      }

      // Apply Coding
      const itemSnapshot = version.itemsSnapshot.find(i => i.itemCode === rule.itemCode);
      const codeRes = this.codeRawValue(
        sampleRaw,
        itemSnapshot || ({ ...rule, id: rule.itemId, required: true } as any),
        rule.scaleOptions,
        rule.codingMap
      );

      // Apply Reverse Coding
      const revRes = this.reverseCodeValue(
        codeRes.codedValue,
        rule.reverseCodingRule,
        rule.reverseCoded
      );

      // Determine Final Processed Value
      let finalVal: number | string | null = null;
      let finalStatus: ItemProcessingStatus = revRes.statusOverride || codeRes.status;
      let flagReason = revRes.flagReason || codeRes.flagReason;

      if (finalStatus === 'Missing') {
        finalVal = this.applyMissingPolicy(rule.missingValuePolicy, rule.userMissingCode);
      } else if (finalStatus === 'Processed') {
        finalVal = rule.reverseCoded ? revRes.reverseCodedValue : codeRes.codedValue;
      } else if (finalStatus === 'Uncoded' && rule.itemType === 'Short Text') {
        finalVal = sampleRaw;
      }

      // Format scale summary
      let scaleSummary = 'No explicit options';
      if (rule.scaleOptions && rule.scaleOptions.length > 0) {
        scaleSummary = rule.scaleOptions.map(o => `${o.value}=${o.label}`).join(', ');
      } else if (rule.itemType === 'Yes/No') {
        scaleSummary = '1=Yes, 0=No';
      } else if (rule.itemType === 'Numeric') {
        scaleSummary = 'Continuous numeric values';
      } else if (rule.itemType === 'Short Text') {
        scaleSummary = 'Uncoded text string';
      }

      let reverseSummary = 'No';
      if (rule.reverseCoded) {
        reverseSummary = rule.reverseCodingRule
          ? `Yes: ${rule.reverseCodingRule.formula}`
          : 'Yes (Rule Missing)';
      }

      return {
        itemCode: rule.itemCode,
        columnName: rule.columnName,
        questionText: rule.questionText,
        itemType: rule.itemType,
        sampleRawValue: sampleRaw || '(empty)',
        resolvedCode: codeRes.codedValue,
        reverseCodedValue: revRes.reverseCodedValue,
        finalProcessedValue: finalVal,
        status: finalStatus,
        flagReason,
        scaleSummary,
        reverseRuleSummary: reverseSummary,
      };
    });

    return {
      success: true,
      data: previewRows,
      statusCode: 200,
    };
  },

  // ==========================================
  // EXECUTE DETERMINISTIC PROCESSING RUN
  // ==========================================

  /**
   * Executes a deterministic Data Processing Run.
   * 
   * Strict safety mandates:
   * 1. Raw submissions are read-only and NEVER modified.
   * 2. An immutable ProcessingRulesSnapshot is created and sealed.
   * 3. Processed records preserve full lineage back to the raw submission.
   * 4. Automatic codebook is generated from actual rules applied.
   * 5. Failure safety: on fatal errors, run is marked Failed and raw data is untouched.
   */
  runProcessing(params: RunProcessingParams): ServiceResult<{
    run: ProcessingRun;
    dataset: ProcessedDataset;
    codebook: Codebook;
  }> {
    // 1. Authorize researcher access
    const pCheck = projectService.getProject(params.projectId, params.userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    // 2. Resolve questionnaire
    const allQ = questionnaireService._getAllQuestionnaires();
    const q = allQ.find(
      item => item.id === params.questionnaireId && item.projectId === params.projectId
    );
    if (!q) {
      return { success: false, error: 'Questionnaire not found in project.', statusCode: 404 };
    }

    // 3. Resolve questionnaire version snapshot
    const allVersions = questionnaireService._getAllVersions();
    const version = allVersions.find(v => v.id === params.questionnaireVersionId);
    if (!version) {
      return { success: false, error: 'Questionnaire version snapshot not found.', statusCode: 404 };
    }

    // 4. Fetch raw submissions (read-only)
    const allSubmissions = submissionService._getAllSubmissions();
    const targetSubmissions = allSubmissions.filter(
      s =>
        s.projectId === params.projectId &&
        s.questionnaireId === params.questionnaireId &&
        s.questionnaireVersionId === params.questionnaireVersionId &&
        s.status === 'Submitted'
    );

    if (targetSubmissions.length === 0) {
      return {
        success: false,
        error: 'No submitted raw responses found for this questionnaire version.',
        statusCode: 400,
      };
    }

    const runId = `run_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const nowIso = new Date().toISOString();

    // 5. Build immutable rules snapshot
    const rulesSnapshot = this.buildRulesSnapshot(
      params.projectId,
      q.id,
      q.title,
      version,
      params.missingValuePolicy,
      params.userMissingCode
    );

    // 6. Initialize ProcessingRun
    const processingRun: ProcessingRun = {
      id: runId,
      projectId: params.projectId,
      questionnaireId: params.questionnaireId,
      questionnaireVersionId: params.questionnaireVersionId,
      createdBy: params.userId,
      createdAt: nowIso,
      status: 'Running',
      sourceSubmissionCount: targetSubmissions.length,
      processedRecordCount: 0,
      rulesSnapshot,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      warnings: [],
      notes: params.notes,
    };

    // Save initial run
    const runs = this._getAllRuns();
    this._saveRuns([processingRun, ...runs]);

    // Audit initial run creation
    auditService.logAction({
      userId: params.userId,
      userName: params.userName,
      projectId: params.projectId,
      action: 'processing_run_created',
      entityType: 'processing_run',
      entityId: runId,
      entityName: `Processing Run for ${q.title} (v${version.versionNumber})`,
      metadata: {
        questionnaireId: q.id,
        questionnaireVersionId: version.id,
        sourceSubmissionCount: targetSubmissions.length,
        missingValuePolicy: params.missingValuePolicy,
      },
    });

    const runErrors: ProcessingRunError[] = [];
    const runWarnings: ProcessingRunWarning[] = [];
    const processedRecords: ProcessedRecord[] = [];

    // Map columns definition
    const columns: ProcessedDatasetColumn[] = rulesSnapshot.items.map(rule => ({
      columnName: rule.columnName,
      originalItemCode: rule.itemCode,
      questionText: rule.questionText,
      itemType: rule.itemType,
      reverseCoded: rule.reverseCoded,
      variableName: rule.variableName,
      indicatorName: rule.indicatorName,
    }));

    // 7. Execute deterministic processing across all raw submissions
    try {
      for (const rawSub of targetSubmissions) {
        const itemResults: Record<string, ProcessedItemValue> = {};

        // Track warnings from raw quality flags
        if (rawSub.validationStatus === 'Flagged' && rawSub.validationFlags.length > 0) {
          runWarnings.push({
            submissionId: rawSub.id,
            warningType: 'RAW_QUALITY_FLAG',
            message: `Raw submission contains quality flags: ${rawSub.validationFlags.join(', ')}`,
          });
        }

        for (const rule of rulesSnapshot.items) {
          const rawAnswer = rawSub.rawResponses[rule.itemCode];
          const itemSnapshot = version.itemsSnapshot.find(i => i.itemCode === rule.itemCode);

          // Step A: Coding
          const codeRes = this.codeRawValue(
            rawAnswer,
            itemSnapshot || ({ ...rule, id: rule.itemId, required: true } as any),
            rule.scaleOptions,
            rule.codingMap
          );

          // Step B: Reverse Coding
          const revRes = this.reverseCodeValue(
            codeRes.codedValue,
            rule.reverseCodingRule,
            rule.reverseCoded
          );

          let finalStatus: ItemProcessingStatus = revRes.statusOverride || codeRes.status;
          let flagReason = revRes.flagReason || codeRes.flagReason;
          let finalVal: number | string | null = null;

          // Step C: Missing Value Policy & Processed Value resolution
          if (finalStatus === 'Missing') {
            finalVal = this.applyMissingPolicy(rule.missingValuePolicy, rule.userMissingCode);
          } else if (finalStatus === 'Processed') {
            finalVal = rule.reverseCoded ? revRes.reverseCodedValue : codeRes.codedValue;
          } else if (finalStatus === 'Uncoded' && rule.itemType === 'Short Text') {
            finalVal = rawAnswer || null;
            runWarnings.push({
              submissionId: rawSub.id,
              itemCode: rule.itemCode,
              columnName: rule.columnName,
              warningType: 'TEXT_UNCODED',
              message: `Short text response preserved uncoded.`,
            });
          } else {
            // Error or Invalid
            runErrors.push({
              submissionId: rawSub.id,
              itemCode: rule.itemCode,
              columnName: rule.columnName,
              errorType: flagReason || 'PROCESSING_ERROR',
              message: `Item ${rule.itemCode} processing failure: ${flagReason}`,
            });
          }

          itemResults[rule.columnName] = {
            originalItemCode: rule.itemCode,
            columnName: rule.columnName,
            rawValue: rawAnswer !== undefined ? rawAnswer : null,
            codedValue: codeRes.codedValue,
            reverseCodedValue: revRes.reverseCodedValue,
            processedValue: finalVal,
            status: finalStatus,
            flagReason,
          };
        }

        // Build ProcessedRecord preserving complete provenance back to raw submission
        const recordId = `prec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        processedRecords.push({
          id: recordId,
          processingRunId: runId,
          projectId: params.projectId,
          questionnaireId: params.questionnaireId,
          questionnaireVersionId: params.questionnaireVersionId,
          submissionId: rawSub.id, // Immutable lineage to raw submission
          participantIdentifier: rawSub.participantIdentifier,
          submittedAt: rawSub.submittedAt,
          sourceValidationStatus: rawSub.validationStatus,
          sourceValidationFlags: [...rawSub.validationFlags],
          items: itemResults,
        });
      }

      // 8. Create ProcessedDataset
      const datasetId = `pdata_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const dataset: ProcessedDataset = {
        id: datasetId,
        processingRunId: runId,
        projectId: params.projectId,
        questionnaireId: params.questionnaireId,
        questionnaireVersionId: params.questionnaireVersionId,
        createdAt: new Date().toISOString(),
        recordCount: processedRecords.length,
        columns,
        records: processedRecords,
      };

      // 9. Generate Codebook directly from rules snapshot
      const codebookId = `cbook_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const codebookEntries: CodebookEntry[] = rulesSnapshot.items.map(rule => {
        let codingMapStr = 'None';
        if (rule.scaleOptions && rule.scaleOptions.length > 0) {
          codingMapStr = rule.scaleOptions.map(o => `${o.value} = ${o.label}`).join(', ');
        } else if (rule.itemType === 'Yes/No') {
          codingMapStr = '1 = Yes, 0 = No';
        } else if (rule.itemType === 'Numeric') {
          codingMapStr = 'Numeric value preserved';
        } else if (rule.itemType === 'Short Text') {
          codingMapStr = 'Uncoded text';
        }

        let reverseStr = 'No';
        if (rule.reverseCoded) {
          reverseStr = rule.reverseCodingRule
            ? `Yes (${rule.reverseCodingRule.formula})`
            : 'Yes (Rule Missing)';
        }

        let missingStr = 'Preserve Missing (null)';
        if (rule.missingValuePolicy === 'user_defined_code') {
          missingStr = `User-defined code (${rule.userMissingCode})`;
        }

        return {
          projectId: params.projectId,
          processingRunId: runId,
          instrumentId: version.instrumentId,
          questionnaireVersionId: version.id,
          itemId: rule.itemId,
          itemCode: rule.itemCode,
          columnName: rule.columnName,
          variableId: rule.variableId,
          variableName: rule.variableName || 'Unassigned',
          dimensionId: rule.dimensionId,
          dimensionName: rule.dimensionName,
          indicatorId: rule.indicatorId,
          indicatorName: rule.indicatorName,
          questionText: rule.questionText,
          itemType: rule.itemType,
          measurementScale: rule.measurementScale || (rule.itemType === 'Likert' ? 'Ordinal' : 'Nominal'),
          responseScale: rule.responseScaleName || rule.itemType,
          codingMap: codingMapStr,
          reverseCoded: rule.reverseCoded,
          reverseCodingRule: reverseStr,
          missingValuePolicy: missingStr,
          notes: rule.notes,
        };
      });

      const codebook: Codebook = {
        id: codebookId,
        processingRunId: runId,
        projectId: params.projectId,
        questionnaireId: params.questionnaireId,
        questionnaireVersionId: params.questionnaireVersionId,
        createdAt: new Date().toISOString(),
        entries: codebookEntries,
      };

      // 10. Update ProcessingRun status to Completed
      const completedIso = new Date().toISOString();
      const finalStatus: ProcessingRunStatus = runErrors.length > 0 ? 'Completed' : 'Completed';

      processingRun.status = finalStatus;
      processingRun.completedAt = completedIso;
      processingRun.processedRecordCount = processedRecords.length;
      processingRun.errorCount = runErrors.length;
      processingRun.warningCount = runWarnings.length;
      processingRun.errors = runErrors;
      processingRun.warnings = runWarnings;

      // Persist run, dataset, and codebook separately
      const currentRuns = this._getAllRuns().map(r => (r.id === runId ? processingRun : r));
      this._saveRuns(currentRuns);

      const allDatasets = this._getAllDatasets();
      this._saveDatasets([dataset, ...allDatasets]);

      const allCodebooks = this._getAllCodebooks();
      this._saveCodebooks([codebook, ...allCodebooks]);

      // Audit completion
      auditService.logAction({
        userId: params.userId,
        userName: params.userName,
        projectId: params.projectId,
        action: 'processing_run_completed',
        entityType: 'processing_run',
        entityId: runId,
        entityName: `Completed Processing Run for ${q.title}`,
        metadata: {
          processedRecordCount: processedRecords.length,
          errorCount: runErrors.length,
          warningCount: runWarnings.length,
          datasetId: dataset.id,
          codebookId: codebook.id,
        },
      });

      return {
        success: true,
        data: {
          run: processingRun,
          dataset,
          codebook,
        },
        statusCode: 201,
      };
    } catch (err: any) {
      // Failure safety: mark run Failed, raw data stays untouched
      processingRun.status = 'Failed';
      processingRun.completedAt = new Date().toISOString();
      processingRun.errorCount = runErrors.length + 1;
      processingRun.errors = [
        ...runErrors,
        {
          errorType: 'FATAL_EXCEPTION',
          message: err?.message || 'Unexpected processing error occurred.',
        },
      ];

      const currentRuns = this._getAllRuns().map(r => (r.id === runId ? processingRun : r));
      this._saveRuns(currentRuns);

      auditService.logAction({
        userId: params.userId,
        userName: params.userName,
        projectId: params.projectId,
        action: 'processing_run_failed',
        entityType: 'processing_run',
        entityId: runId,
        entityName: `Failed Processing Run for ${q.title}`,
        metadata: {
          error: err?.message || 'Processing failed.',
        },
      });

      return {
        success: false,
        error: `Processing run failed: ${err?.message || 'Unknown deterministic error.'}`,
        statusCode: 500,
      };
    }
  },

  // ==========================================
  // QUERY & LINEAGE ACCESSORS (WITH AUTH)
  // ==========================================

  /**
   * Retrieves all processing runs for a project.
   */
  getRunsByProject(projectId: string, userId: string): ServiceResult<ProcessingRun[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const runs = this._getAllRuns().filter(r => r.projectId === projectId);
    return { success: true, data: runs, statusCode: 200 };
  },

  /**
   * Retrieves a single processing run with authorization.
   */
  getRunById(runId: string, projectId: string, userId: string): ServiceResult<ProcessingRun> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const run = this._getAllRuns().find(r => r.id === runId && r.projectId === projectId);
    if (!run) {
      return { success: false, error: 'Processing run not found.', statusCode: 404 };
    }

    return { success: true, data: run, statusCode: 200 };
  },

  /**
   * Retrieves the processed dataset generated by a specific run with authorization.
   */
  getDatasetByRunId(runId: string, projectId: string, userId: string): ServiceResult<ProcessedDataset> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const dataset = this._getAllDatasets().find(
      d => d.processingRunId === runId && d.projectId === projectId
    );
    if (!dataset) {
      return { success: false, error: 'Processed dataset not found for this run.', statusCode: 404 };
    }

    return { success: true, data: dataset, statusCode: 200 };
  },

  /**
   * Retrieves the codebook generated by a specific run with authorization.
   */
  getCodebookByRunId(runId: string, projectId: string, userId: string): ServiceResult<Codebook> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const codebook = this._getAllCodebooks().find(
      c => c.processingRunId === runId && c.projectId === projectId
    );
    if (!codebook) {
      return { success: false, error: 'Codebook not found for this run.', statusCode: 404 };
    }

    return { success: true, data: codebook, statusCode: 200 };
  },

  // ==========================================
  // DETERMINISTIC EXPORTS
  // ==========================================

  /**
   * Exports the processed dataset to standard CSV format.
   * Does NOT leak raw responses into processed dataset export unless explicitly requested.
   */
  exportDatasetCsv(dataset: ProcessedDataset): { csvContent: string; filename: string } {
    const headers = [
      'Submission_ID',
      'Submitted_At',
      'Validation_Status',
      'Quality_Flags',
      ...dataset.columns.map(c => c.columnName),
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = dataset.records.map(record => {
      const row = [
        escapeCsv(record.submissionId),
        escapeCsv(record.submittedAt),
        escapeCsv(record.sourceValidationStatus),
        escapeCsv(record.sourceValidationFlags.join('; ')),
      ];

      for (const col of dataset.columns) {
        const itemVal = record.items[col.columnName];
        row.push(escapeCsv(itemVal?.processedValue));
      }

      return row.join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `qrp_processed_dataset_${dataset.id}_${Date.now()}.csv`;

    return { csvContent, filename };
  },

  /**
   * Exports the Codebook to standard CSV format.
   */
  exportCodebookCsv(codebook: Codebook): { csvContent: string; filename: string } {
    const headers = [
      'Item_Code',
      'Column_Name',
      'Variable_Name',
      'Dimension_Name',
      'Indicator_Name',
      'Question_Prompt',
      'Item_Type',
      'Measurement_Scale',
      'Response_Scale',
      'Coding_Map',
      'Reverse_Coded',
      'Reverse_Coding_Rule',
      'Missing_Value_Policy',
      'Notes',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = codebook.entries.map(entry => [
      escapeCsv(entry.itemCode),
      escapeCsv(entry.columnName),
      escapeCsv(entry.variableName),
      escapeCsv(entry.dimensionName || ''),
      escapeCsv(entry.indicatorName || ''),
      escapeCsv(entry.questionText),
      escapeCsv(entry.itemType),
      escapeCsv(entry.measurementScale),
      escapeCsv(entry.responseScale),
      escapeCsv(entry.codingMap),
      escapeCsv(entry.reverseCoded ? 'Yes' : 'No'),
      escapeCsv(entry.reverseCodingRule),
      escapeCsv(entry.missingValuePolicy),
      escapeCsv(entry.notes || ''),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const filename = `qrp_codebook_${codebook.id}_${Date.now()}.csv`;

    return { csvContent, filename };
  },
};
