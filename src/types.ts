/**
 * Quantitative Research Platform - Type Declarations
 * Canonical domain models for Phase 1 & forward-compatibility
 */

export * from './types/index';
import { InstrumentItem, ItemType, ResponseScaleOption } from './types/index';

// Future Phase Interfaces (Questionnaires, Data Processing, Statistical Analysis)
export interface ItemCodingRule {
  [label: string]: number;
}

export type ResponseMode = 'anonymous' | 'identified';

export type QuestionnaireStatus =
  | 'Draft'
  | 'Ready'
  | 'Published'
  | 'Paused'
  | 'Closed'
  | 'Archived';

export interface QuestionnaireItemSnapshot {
  id: string;
  itemCode: string;
  itemNumber: number;
  questionText: string;
  itemType: ItemType;
  variableId: string;
  variableName?: string;
  dimensionId?: string;
  dimensionName?: string;
  indicatorId?: string;
  indicatorName?: string;
  responseScaleId?: string;
  responseScaleName?: string;
  responseScaleType?: string;
  scaleOptions?: ResponseScaleOption[];
  required: boolean;
  reverseCoded: boolean;
  source?: string;
  notes?: string;
}

export interface QuestionnaireVersion {
  id: string;
  questionnaireId: string;
  instrumentId: string;
  instrumentVersionId: string;
  versionNumber: number;
  publishedAt: string;
  itemsSnapshot: QuestionnaireItemSnapshot[];
  isLocked: boolean;
  notes?: string;
  createdAt: string;
}

export interface Questionnaire {
  id: string;
  projectId: string;
  instrumentId: string;
  ownerId: string;
  title: string;
  introduction: string;
  consentStatement: string;
  closingMessage: string;
  responseMode: ResponseMode;
  publicSlug: string;
  status: QuestionnaireStatus;
  currentVersion: number;
  startDate?: string;
  endDate?: string;
  maxResponses?: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicQuestionnaireDTO {
  id: string;
  publicSlug: string;
  title: string;
  introduction: string;
  consentStatement: string;
  closingMessage: string;
  responseMode: ResponseMode;
  status: QuestionnaireStatus;
  currentVersion: number;
  currentVersionId?: string;
  startDate?: string;
  endDate?: string;
  items: QuestionnaireItemSnapshot[];
}

export interface RawItemResponse {
  itemId: string;
  itemCode: string;
  rawValue: string;
  rawDisplayValue: string;
}

export type SubmissionStatus = 'InProgress' | 'Submitted';
export type SubmissionValidationStatus = 'Valid' | 'Flagged' | 'Excluded';

export interface SurveySubmission {
  id: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  questionnaireVersion: number;
  projectId: string;
  sessionId: string;
  participantMode: ResponseMode;
  participantIdentifier?: string | null;
  consentGiven: boolean;
  startedAt: string;
  submittedAt: string;
  durationSeconds: number;
  status: SubmissionStatus;
  validationStatus: SubmissionValidationStatus;
  validationFlags: string[];
  rawResponses: Record<string, string>; // itemCode -> rawValue
  rawItemDetails?: RawItemResponse[]; // detailed snapshot of each item's raw answer
  researcherDecisionNotes?: string;
  createdAt: string;
}

export interface ProcessedItemRecord {
  itemCode: string;
  rawValue: string;
  numericCodedValue: number | null;
  reverseCodedValue: number | null;
  finalScore: number | null;
  isMissing: boolean;
}

// ========================================================
// STAGE 6: DATA PROCESSING ENGINE ENTITIES & SNAPSHOTS
// ========================================================

export type MissingValuePolicy = 'preserve_missing' | 'user_defined_code';

export type ItemProcessingStatus =
  | 'Processed'
  | 'Missing'
  | 'Uncoded'
  | 'Invalid'
  | 'Error';

export type ItemProcessingFlagReason =
  | 'CODING_RULE_MISSING'
  | 'REVERSE_RULE_MISSING'
  | 'INVALID_NUMERIC'
  | 'TEXT_UNCODED'
  | 'MISSING_VALUE'
  | 'OUT_OF_RANGE'
  | 'UNMAPPED_OPTION';

export interface ProcessingItemRuleSnapshot {
  itemId: string;
  itemCode: string;
  columnName: string;
  itemNumber: number;
  questionText: string;
  itemType: ItemType;
  variableId: string;
  variableName?: string;
  dimensionId?: string;
  dimensionName?: string;
  indicatorId?: string;
  indicatorName?: string;
  responseScaleId?: string;
  responseScaleName?: string;
  responseScaleType?: string;
  scaleOptions?: ResponseScaleOption[];
  codingMap: Record<string, number | string>; // label/value lowercased/trimmed -> numeric/string code
  reverseCoded: boolean;
  reverseCodingRule?: {
    minValue: number;
    maxValue: number;
    formula: string; // e.g., "max(5) + min(1) - x"
  } | null;
  missingValuePolicy: MissingValuePolicy;
  userMissingCode?: number | string;
  measurementScale?: string;
  notes?: string;
}

export interface ProcessingRulesSnapshot {
  createdAt: string;
  projectId: string;
  questionnaireId: string;
  questionnaireTitle: string;
  questionnaireVersionId: string;
  questionnaireVersionNumber: number;
  missingValuePolicy: MissingValuePolicy;
  userMissingCode?: number | string;
  items: ProcessingItemRuleSnapshot[];
}

export interface ProcessingRunError {
  submissionId?: string;
  itemCode?: string;
  columnName?: string;
  errorType: string;
  message: string;
}

export interface ProcessingRunWarning {
  submissionId?: string;
  itemCode?: string;
  columnName?: string;
  warningType: string;
  message: string;
}

export type ProcessingRunStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface ProcessingRun {
  id: string;
  projectId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  status: ProcessingRunStatus;
  sourceSubmissionCount: number;
  processedRecordCount: number;
  rulesSnapshot: ProcessingRulesSnapshot;
  errorCount: number;
  warningCount: number;
  errors?: ProcessingRunError[];
  warnings?: ProcessingRunWarning[];
  notes?: string;
}

export interface ProcessedItemValue {
  originalItemCode: string;
  columnName: string;
  rawValue: string | null;
  codedValue: number | string | null;
  reverseCodedValue: number | null;
  processedValue: number | string | null;
  status: ItemProcessingStatus;
  flagReason?: string;
}

export interface ProcessedRecord {
  id: string;
  processingRunId: string;
  projectId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  submissionId: string; // Lineage back to raw SurveySubmission
  participantIdentifier?: string | null;
  submittedAt: string;
  sourceValidationStatus: SubmissionValidationStatus;
  sourceValidationFlags: string[];
  items: Record<string, ProcessedItemValue>; // key is columnName
}

export interface ProcessedDatasetColumn {
  columnName: string;
  originalItemCode: string;
  questionText: string;
  itemType: ItemType;
  reverseCoded: boolean;
  variableName?: string;
  indicatorName?: string;
}

export interface ProcessedDataset {
  id: string;
  processingRunId: string;
  projectId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  createdAt: string;
  recordCount: number;
  columns: ProcessedDatasetColumn[];
  records: ProcessedRecord[];
}

export interface CodebookEntry {
  projectId: string;
  processingRunId: string;
  instrumentId?: string;
  questionnaireVersionId: string;
  itemId: string;
  itemCode: string;
  columnName: string;
  variableId: string;
  variableName: string;
  dimensionId?: string;
  dimensionName?: string;
  indicatorId?: string;
  indicatorName?: string;
  questionText: string;
  itemType: ItemType;
  measurementScale: string;
  responseScale: string;
  codingMap: string;
  reverseCoded: boolean;
  reverseCodingRule: string;
  missingValuePolicy: string;
  notes?: string;
}

export interface Codebook {
  id: string;
  processingRunId: string;
  projectId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  createdAt: string;
  entries: CodebookEntry[];
}

export interface ProcessingPreviewRow {
  itemCode: string;
  columnName: string;
  questionText: string;
  itemType: ItemType;
  sampleRawValue: string;
  resolvedCode: number | string | null;
  reverseCodedValue: number | null;
  finalProcessedValue: number | string | null;
  status: ItemProcessingStatus;
  flagReason?: string;
  scaleSummary: string;
  reverseRuleSummary: string;
}

export interface ProcessingPrerequisites {
  canProcess: boolean;
  reasons: string[];
  submissionCount: number;
  itemCount: number;
  hasErrors: boolean;
  errorMessages: string[];
  warningMessages: string[];
}

// ========================================================
// STAGE 7: SCORING ENGINE ENTITIES & SNAPSHOTS
// ========================================================

export type ScoringMethod = 'MEAN' | 'SUM' | 'MEDIAN' | 'MIN' | 'MAX';

export type ScoringTargetType = 'Dimension' | 'Variable';

export type ScoringSourceType = 'items' | 'dimensions';

export type ScoringMissingPolicy = 'complete_case' | 'available_case' | 'minimum_required_items';

export type ScoreStatus = 'Scored' | 'Missing' | 'Invalid' | 'Error';

export interface ScoringRule {
  id: string;
  projectId: string;
  targetType: ScoringTargetType;
  targetId: string;
  targetCode: string;
  targetName: string;
  method: ScoringMethod;
  sourceType: ScoringSourceType;
  sourceItemIds: string[];
  sourceItemCodes: string[];
  sourceDimensionIds?: string[];
  sourceDimensionCodes?: string[];
  missingValuePolicy: ScoringMissingPolicy;
  minimumRequiredItems?: number;
  expectedRange?: {
    min: number;
    max: number;
  };
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  notes?: string;
}

export interface ScoringRuleSnapshotItem {
  ruleId: string;
  targetType: ScoringTargetType;
  targetId: string;
  targetCode: string;
  targetName: string;
  method: ScoringMethod;
  sourceType: ScoringSourceType;
  sourceItemIds: string[];
  sourceItemCodes: string[];
  sourceDimensionIds?: string[];
  sourceDimensionCodes?: string[];
  missingValuePolicy: ScoringMissingPolicy;
  minimumRequiredItems?: number;
  expectedRange?: {
    min: number;
    max: number;
  };
  version: number;
}

export interface ScoringRulesSnapshot {
  snapshotId: string;
  projectId: string;
  processingRunId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  capturedAt: string;
  rules: ScoringRuleSnapshotItem[];
}

export type ScoringRunStatus = 'Pending' | 'Running' | 'Completed' | 'Failed';

export interface ScoringRunError {
  submissionId?: string;
  targetCode?: string;
  errorType: string;
  message: string;
}

export interface ScoringRunWarning {
  submissionId?: string;
  targetCode?: string;
  warningType: string;
  message: string;
}

export interface ScoringRun {
  id: string;
  projectId: string;
  processingRunId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  createdBy: string;
  createdAt: string;
  completedAt?: string;
  status: ScoringRunStatus;
  sourceRecordCount: number;
  scoredRecordCount: number;
  rulesSnapshot: ScoringRulesSnapshot;
  errorCount: number;
  warningCount: number;
  errors?: ScoringRunError[];
  warnings?: ScoringRunWarning[];
  notes?: string;
}

export interface ScoreTargetMetadata {
  targetCode: string;
  targetName: string;
  targetType: ScoringTargetType;
  method: ScoringMethod;
  score: number | null;
  status: ScoreStatus;
  flagReason?: string;
  totalSourceItems: number;
  validItemCount: number;
  missingItemCount: number;
  missingItemCodes: string[];
  missingValuePolicy: ScoringMissingPolicy;
  minimumRequiredItems?: number;
  sourceValues: Record<string, number | null>;
  formulaSummary: string;
}

export interface ScoredRecord {
  id: string;
  scoringRunId: string;
  processingRunId: string;
  projectId: string;
  sourceProcessedRecordId: string;
  sourceSubmissionId: string;
  questionnaireVersionId: string;
  participantIdentifier?: string | null;
  submittedAt: string;
  scores: Record<string, number | null>;
  scoreMetadata: Record<string, ScoreTargetMetadata>;
  status: 'valid' | 'flagged' | 'incomplete';
  createdAt: string;
}

export interface ScoredDatasetColumn {
  targetCode: string;
  targetName: string;
  targetType: ScoringTargetType;
  method: ScoringMethod;
  sourceType: ScoringSourceType;
  sourceCodes: string[];
  missingValuePolicy: ScoringMissingPolicy;
  expectedMin?: number;
  expectedMax?: number;
}

export interface ScoredDataset {
  id: string;
  scoringRunId: string;
  processingRunId: string;
  projectId: string;
  questionnaireId: string;
  questionnaireVersionId: string;
  createdAt: string;
  recordCount: number;
  columns: ScoredDatasetColumn[];
  records: ScoredRecord[];
}

export interface ScoringCodebookEntry {
  projectId: string;
  scoringRunId: string;
  processingRunId: string;
  targetType: ScoringTargetType;
  targetId: string;
  targetCode: string;
  targetName: string;
  scoringMethod: ScoringMethod;
  sourceType: ScoringSourceType;
  sourceCodes: string;
  missingValuePolicy: string;
  minimumRequiredItems: string;
  expectedRange: string;
  formulaDescription: string;
  version: number;
}

export interface ScoringPreviewRow {
  submissionId: string;
  participantIdentifier?: string | null;
  inputValues: Record<string, number | null>;
  calculatedScores: Record<string, {
    score: number | null;
    status: ScoreStatus;
    flagReason?: string;
    validCount: number;
    totalCount: number;
    formulaSummary: string;
  }>;
}

export interface ScoringPrerequisites {
  canScore: boolean;
  reasons: string[];
  processingRunExists: boolean;
  processingRunCompleted: boolean;
  processedRecordCount: number;
  rulesConfiguredCount: number;
  hasErrors: boolean;
  errorMessages: string[];
  warningMessages: string[];
}

export interface ProcessedResponseRecord {
  submissionId: string;
  participantIdentifier?: string;
  submittedAt: string;
  status: 'valid' | 'flagged' | 'excluded';
  validationFlags: string[];
  items: Record<string, ProcessedItemRecord>;
  compositeScores: Record<string, number>;
}

export interface ProvenanceLog {
  id: string;
  submissionId: string;
  itemCode: string;
  timestamp: string;
  step: 'RAW_RECORDED' | 'CODED' | 'REVERSE_CODED' | 'SCORED' | 'VALIDATION_FLAG';
  inputValue: string;
  outputValue: string;
  ruleApplied: string;
  actor: string;
}

export interface DescriptiveStats {
  itemOrVar: string;
  n: number;
  mean: number;
  median: number;
  mode?: number;
  sd: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  skewness: number;
  kurtosis: number;
}

export interface ReliabilityResult {
  variableCode: string;
  variableName: string;
  sampleSize: number;
  itemCount: number;
  cronbachsAlpha: number;
  interpretation: string;
  itemTotalStats: {
    itemCode: string;
    itemPrompt: string;
    scaleMeanIfItemDeleted: number;
    scaleVarianceIfItemDeleted: number;
    correctedItemTotalCorrelation: number;
    alphaIfItemDeleted: number;
  }[];
}

export interface CorrelationResult {
  var1: string;
  var2: string;
  pearsonR: number;
  spearmanRho: number;
  n: number;
  tStat: number;
  pValue: number;
  ciLower: number;
  ciUpper: number;
  isSignificant: boolean;
  effectSizeInterpretation: string;
}

export interface RegressionResult {
  dependentVar: string;
  independentVars: string[];
  n: number;
  r: number;
  rSquared: number;
  adjustedRSquared: number;
  standardErrorOfEstimate: number;
  fStat: number;
  fPValue: number;
  dfRegression: number;
  dfResidual: number;
  coefficients: {
    variable: string;
    unstandardizedB: number;
    standardError: number;
    standardizedBeta: number;
    tStat: number;
    pValue: number;
    ciLower: number;
    ciUpper: number;
    tolerance: number;
    vif: number;
  }[];
}

export interface GroupComparisonResult {
  testType: 'independent_t_test' | 'paired_t_test' | 'one_way_anova';
  groupingVar: string;
  dependentVar: string;
  groups: {
    name: string;
    n: number;
    mean: number;
    sd: number;
  }[];
  testStatistic: number;
  degreesOfFreedom: string;
  pValue: number;
  effectSizeName: string;
  effectSizeValue: number;
  leveneStat?: number;
  levenePValue?: number;
  equalVariancesAssumed?: boolean;
}

export interface AssumptionCheck {
  name: string;
  description: string;
  status: 'satisfied' | 'violated' | 'caution';
  metric: string;
  detail: string;
}
