/**
 * Quantitative Research Platform - Type Declarations
 * Canonical domain models for Phase 1 & forward-compatibility
 */

export * from './types/index';
import { InstrumentItem } from './types/index';

// Future Phase Interfaces (Questionnaires, Data Processing, Statistical Analysis)
export interface ItemCodingRule {
  [label: string]: number;
}

export interface QuestionnaireVersion {
  versionNumber: number;
  publishedAt: string;
  itemsSnapshot: InstrumentItem[];
  isLocked: boolean;
}

export interface Questionnaire {
  id: string;
  projectId: string;
  publicSlug: string;
  title: string;
  introduction: string;
  consentStatement: string;
  closingMessage: string;
  responseMode: 'anonymous' | 'identified';
  maxResponses?: number;
  startDate?: string;
  endDate?: string;
  isActive: boolean;
  currentVersion: number;
  versions: QuestionnaireVersion[];
}

export interface RawItemResponse {
  itemCode: string;
  rawValue: string;
}

export interface SurveySubmission {
  id: string;
  questionnaireId: string;
  questionnaireVersion: number;
  sessionId: string;
  consentGiven: boolean;
  participantIdentifier?: string;
  submittedAt: string;
  startedAt: string;
  durationSeconds: number;
  rawResponses: Record<string, string>;
  validationStatus: 'valid' | 'flagged' | 'excluded';
  validationFlags: string[];
  researcherDecisionNotes?: string;
}

export interface ProcessedItemRecord {
  itemCode: string;
  rawValue: string;
  numericCodedValue: number | null;
  reverseCodedValue: number | null;
  finalScore: number | null;
  isMissing: boolean;
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
