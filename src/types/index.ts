/**
 * Quantitative Research Platform - Core Domain Types (Phase 1)
 */

export type UserRole = 'researcher' | 'student' | 'faculty' | 'reviewer';

export interface User {
  id: string;
  email: string;
  name: string;
  institution?: string;
  role: UserRole;
  createdAt: string;
}

export type ProjectStatus = 'Draft' | 'Data Collection' | 'Analysis' | 'Completed' | 'Archived';

export interface ResearchProject {
  id: string;
  userId: string;
  title: string;
  researchTopic: string;
  researchObjective: string;
  researchMethod: string;
  population: string;
  sampleDescription: string;
  researchDesign: string;
  status: ProjectStatus;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type VariableRole =
  | 'Independent Variable'
  | 'Dependent Variable'
  | 'Control Variable'
  | 'Demographic Variable'
  | 'Other';

export type MeasurementScale = 'Nominal' | 'Ordinal' | 'Interval' | 'Ratio';

export interface Indicator {
  id: string;
  dimensionId: string;
  variableId: string;
  name: string;
  code: string; // e.g. "IND-1.1"
  definition?: string;
  description?: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export interface Dimension {
  id: string;
  variableId: string;
  name: string;
  code: string; // e.g. "DIM-1"
  definition?: string;
  description?: string;
  orderIndex: number;
  indicators: Indicator[];
  createdAt: string;
  updatedAt: string;
}

export interface Variable {
  id: string;
  projectId: string;
  name: string;
  code: string; // e.g. "X1", "Y1", "C1" - must be unique within project
  variableType: string; // e.g. "Latent Construct", "Observed Variable", "Categorical Attribute"
  role: VariableRole;
  measurementScale: MeasurementScale;
  conceptualDefinition: string;
  operationalDefinition: string;
  description?: string;
  orderIndex: number;
  dimensions: Dimension[];
  createdAt: string;
  updatedAt: string;
}

export type AuditAction =
  | 'project_created'
  | 'project_updated'
  | 'project_archived'
  | 'project_unarchived'
  | 'project_deleted'
  | 'variable_created'
  | 'variable_updated'
  | 'variable_deleted'
  | 'dimension_created'
  | 'dimension_updated'
  | 'dimension_deleted'
  | 'indicator_created'
  | 'indicator_updated'
  | 'indicator_deleted'
  | 'instrument_created'
  | 'instrument_updated'
  | 'instrument_approved'
  | 'instrument_archived'
  | 'instrument_version_created'
  | 'instrument_deleted'
  | 'item_created'
  | 'item_updated'
  | 'item_deleted'
  | 'item_reordered'
  | 'scale_created'
  | 'scale_updated'
  | 'scale_archived'
  | 'variable_mapped'
  | 'dimension_mapped'
  | 'indicator_mapped'
  | 'ai_generation_created'
  | 'ai_candidate_accepted'
  | 'ai_candidate_edited'
  | 'ai_candidate_rejected'
  | 'ai_candidates_batch_accepted';

export type AuditEntityType =
  | 'project'
  | 'variable'
  | 'dimension'
  | 'indicator'
  | 'instrument'
  | 'item'
  | 'scale'
  | 'ai_generation'
  | 'ai_item';

// ==========================================
// PHASE 2: INSTRUMENT & MEASUREMENT DOMAIN TYPES
// ==========================================

export type InstrumentSourceType =
  | 'Researcher Developed'
  | 'Adapted Instrument'
  | 'Standardized Instrument'
  | 'Existing Scale'
  | 'Other';

export type InstrumentStatus = 'Draft' | 'Review' | 'Approved' | 'Archived';

export type ResponseScaleType =
  | 'Likert'
  | 'Semantic Differential'
  | 'Numeric Rating'
  | 'Binary'
  | 'Custom Categorical';

export interface ResponseScaleOption {
  value: number;
  label: string;
  code?: string;
}

export interface ResponseScale {
  id: string;
  projectId: string;
  name: string;
  scaleType: ResponseScaleType;
  minValue: number;
  maxValue: number;
  options: ResponseScaleOption[];
  isArchived: boolean;
  isSystemPreset?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ItemType =
  | 'Likert'
  | 'Multiple Choice'
  | 'Single Choice'
  | 'Yes/No'
  | 'Numeric'
  | 'Short Text';

export type ItemSource =
  | 'Researcher Created'
  | 'AI Generated'
  | 'Imported'
  | 'Adapted'
  | 'Existing Instrument';

export interface InstrumentItem {
  id: string;
  instrumentId: string;
  projectId: string;
  itemCode: string; // e.g. "X1.01", unique within instrument
  itemNumber: number; // sequential display index
  questionText: string;
  itemType: ItemType;
  variableId: string;
  dimensionId?: string;
  indicatorId?: string;
  responseScaleId?: string;
  required: boolean;
  reverseCoded: boolean;
  status: 'draft' | 'active' | 'archived';
  source: ItemSource;
  aiCandidateId?: string;
  aiGenerationId?: string;
  originalAiText?: string;
  modifiedByResearcher?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Instrument {
  id: string;
  projectId: string;
  name: string;
  code: string; // e.g. "AMS01", unique within project
  description: string;
  purpose: string;
  sourceType: InstrumentSourceType;
  sourceReference: string;
  version: string; // e.g. "1.0"
  status: InstrumentStatus;
  variableIds: string[]; // Variables measured by this instrument
  items?: InstrumentItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InstrumentVersion {
  id: string;
  instrumentId: string;
  projectId: string;
  versionNumber: string;
  status: 'Approved' | 'Archived';
  snapshot: {
    instrument: Omit<Instrument, 'items'>;
    items: InstrumentItem[];
    scalesSnapshot: ResponseScale[];
    approvedAt: string;
    approvedBy: string;
    notes?: string;
  };
  createdAt: string;
}

export interface InstrumentValidationIssue {
  type: 'error' | 'warning';
  field?: string;
  itemId?: string;
  itemCode?: string;
  message: string;
}

export interface InstrumentValidationReport {
  isValidForApproval: boolean;
  errors: InstrumentValidationIssue[];
  warnings: InstrumentValidationIssue[];
  summary: {
    hasMetadata: boolean;
    hasVariables: boolean;
    itemCount: number;
    scalesConfigured: boolean;
    codingValid: boolean;
    indicatorsMapped: boolean;
  };
}

export interface AuditLog {
  id: string;
  userId: string;
  userName?: string;
  projectId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityName?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

export interface WorkflowStage {
  id: number;
  name: string;
  description: string;
  phaseNumber: number;
  isImplemented: boolean;
  status: 'completed' | 'active' | 'upcoming';
}

// ==========================================
// PHASE 3: AI QUESTIONNAIRE GENERATOR TYPES
// ==========================================

export type AIGenerationStatus = 'Generated' | 'Partially Accepted' | 'Accepted' | 'Rejected';

export type AICandidateStatus = 'Candidate' | 'Accepted' | 'Rejected' | 'Edited' | 'AddedToInstrument';

export interface AIGenerationParameters {
  numberOfItems: number;
  language: 'English' | 'Indonesian';
  targetPopulation: string;
  additionalInstructions?: string;
  scaleName?: string;
  scaleType?: string;
}

export interface AIGeneration {
  id: string;
  projectId: string;
  instrumentId: string;
  variableId: string;
  dimensionId?: string;
  indicatorId?: string;
  model: string;
  promptVersion: string;
  generationParameters: AIGenerationParameters;
  isDemoMode: boolean;
  generatedAt: string;
  generatedBy: string;
  status: AIGenerationStatus;
  generationNotes?: string[];
  warnings?: string[];
}

export interface AIGeneratedItem {
  id: string;
  generationId: string;
  candidateId: string;
  questionText: string;
  suggestedItemType: ItemType;
  variableId: string;
  dimensionId?: string;
  indicatorId?: string;
  responseScaleId?: string;
  reverseCoded: boolean;
  qualityFlags: string[];
  potentialIssues: string[];
  confidence: 'high' | 'medium' | 'low';
  generationMetadata?: {
    model: string;
    promptVersion: string;
    isDemo: boolean;
  };
  status: AICandidateStatus;
  acceptedItemId?: string;
  originalText: string;
  finalText?: string;
  modifiedByResearcher: boolean;
  duplicateWarning?: string;
  createdAt: string;
}

export interface AIGenerationRequestPayload {
  projectId: string;
  instrumentId: string;
  variableId: string;
  dimensionId?: string;
  indicatorId?: string;
  responseScaleId?: string;
  numberOfItems: number;
  language: 'English' | 'Indonesian';
  targetPopulation?: string;
  additionalInstructions?: string;
  userId?: string;
}

export interface AIGenerationResponsePayload {
  generationId: string;
  isDemoMode: boolean;
  model: string;
  promptVersion: string;
  items: {
    candidateId: string;
    questionText: string;
    suggestedItemType: ItemType;
    reverseCoded?: boolean;
    qualityNotes: string[];
    potentialIssues: string[];
    confidence: 'high' | 'medium' | 'low';
  }[];
  generationNotes: string[];
  warnings: string[];
}

