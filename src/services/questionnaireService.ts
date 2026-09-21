import {
  PublicQuestionnaireDTO,
  Questionnaire,
  QuestionnaireItemSnapshot,
  QuestionnaireStatus,
  QuestionnaireVersion,
  ResponseMode,
} from '../types';
import { auditService } from './auditService';
import { instrumentService } from './instrumentService';
import { projectService, ServiceResult } from './projectService';
import { storage } from './storage';

const QUESTIONNAIRES_KEY = 'questionnaires';
const VERSIONS_KEY = 'questionnaire_versions';

/**
 * Normalizes title into a URL-safe human-readable slug
 */
export function generateBaseSlug(title: string): string {
  const slug = (title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'survey';
}

/**
 * Guarantees slug uniqueness across questionnaires in storage
 */
export function ensureUniqueSlug(
  baseSlug: string,
  existingQuestionnaires: Questionnaire[],
  currentQuestionnaireId?: string
): string {
  let candidate = baseSlug;
  let counter = 2;

  const isTaken = (s: string) =>
    existingQuestionnaires.some(
      q => q.publicSlug === s && q.id !== currentQuestionnaireId
    );

  while (isTaken(candidate)) {
    candidate = `${baseSlug}-${counter}`;
    counter++;
  }

  return candidate;
}

export interface QuestionnaireSettingsUpdate {
  title?: string;
  introduction?: string;
  consentStatement?: string;
  closingMessage?: string;
  responseMode?: ResponseMode;
  publicSlug?: string;
  startDate?: string;
  endDate?: string;
  maxResponses?: number;
}

export const questionnaireService = {
  _getAllQuestionnaires(): Questionnaire[] {
    return storage.get<Questionnaire[]>(QUESTIONNAIRES_KEY, []);
  },

  _saveQuestionnaires(list: Questionnaire[]): void {
    storage.set(QUESTIONNAIRES_KEY, list);
  },

  _getAllVersions(): QuestionnaireVersion[] {
    return storage.get<QuestionnaireVersion[]>(VERSIONS_KEY, []);
  },

  _saveVersions(list: QuestionnaireVersion[]): void {
    storage.set(VERSIONS_KEY, list);
  },

  /**
   * Create a new Questionnaire from an APPROVED Instrument
   * Pre-conditions strictly enforced:
   * 1. Researcher owns the project
   * 2. Instrument exists and belongs to the project
   * 3. Instrument status is strictly 'Approved'
   * 4. An immutable approved InstrumentVersion exists
   */
  createFromApprovedInstrument(
    projectId: string,
    instrumentId: string,
    userId: string,
    userName: string,
    initialSettings?: QuestionnaireSettingsUpdate
  ): ServiceResult<Questionnaire> {
    // 1. Verify project authorization
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    // 2. Verify instrument exists
    const instRes = instrumentService.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: instRes.error || 'Instrument not found.', statusCode: 404 };
    }

    const instrument = instRes.data;

    // 3. Strict check: Instrument must be Approved
    if (instrument.status !== 'Approved') {
      return {
        success: false,
        error: `Cannot create questionnaire: Instrument "${instrument.name}" status is "${instrument.status}". A questionnaire may ONLY be created from an APPROVED instrument.`,
        statusCode: 400,
      };
    }

    // 4. Strict check: An immutable approved InstrumentVersion must exist
    const verRes = instrumentService.getInstrumentVersions(instrumentId, projectId, userId);
    const approvedVersions = (verRes.data || []).filter(v => v.status === 'Approved');
    if (approvedVersions.length === 0) {
      return {
        success: false,
        error: 'Cannot create questionnaire: No immutable approved InstrumentVersion snapshot was found for this instrument.',
        statusCode: 400,
      };
    }

    const now = new Date().toISOString();
    const title = initialSettings?.title?.trim() || `${instrument.name} Questionnaire`;
    const allQuestionnaires = this._getAllQuestionnaires();

    const baseSlug = initialSettings?.publicSlug?.trim()
      ? generateBaseSlug(initialSettings.publicSlug)
      : generateBaseSlug(title);
    const publicSlug = ensureUniqueSlug(baseSlug, allQuestionnaires);

    const questionnaire: Questionnaire = {
      id: `qn_${instrument.id}_${Date.now()}`,
      projectId,
      instrumentId: instrument.id,
      ownerId: userId,
      title,
      introduction: initialSettings?.introduction ?? '',
      consentStatement: initialSettings?.consentStatement ?? '',
      closingMessage: initialSettings?.closingMessage ?? '',
      responseMode: initialSettings?.responseMode ?? 'anonymous',
      publicSlug,
      status: 'Draft',
      currentVersion: 0,
      startDate: initialSettings?.startDate,
      endDate: initialSettings?.endDate,
      maxResponses: initialSettings?.maxResponses,
      createdAt: now,
      updatedAt: now,
    };

    this._saveQuestionnaires([questionnaire, ...allQuestionnaires]);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_created',
      entityType: 'questionnaire',
      entityId: questionnaire.id,
      entityName: questionnaire.title,
      metadata: {
        instrumentId: instrument.id,
        instrumentCode: instrument.code,
        publicSlug: questionnaire.publicSlug,
        status: questionnaire.status,
      },
    });

    return { success: true, data: questionnaire, statusCode: 201 };
  },

  /**
   * Retrieve a specific questionnaire with authorization check
   */
  getById(
    questionnaireId: string,
    projectId: string,
    userId: string
  ): ServiceResult<Questionnaire> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const found = all.find(q => q.id === questionnaireId && q.projectId === projectId);
    if (!found) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    return { success: true, data: found, statusCode: 200 };
  },

  /**
   * Retrieve all questionnaires for a project
   */
  getByProject(projectId: string, userId: string): ServiceResult<Questionnaire[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const filtered = all.filter(q => q.projectId === projectId);
    return { success: true, data: filtered, statusCode: 200 };
  },

  /**
   * Retrieve all immutable versions for a questionnaire
   */
  getVersions(
    questionnaireId: string,
    projectId: string,
    userId: string
  ): ServiceResult<QuestionnaireVersion[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const versions = this._getAllVersions();
    const filtered = versions
      .filter(v => v.questionnaireId === questionnaireId)
      .sort((a, b) => b.versionNumber - a.versionNumber);

    return { success: true, data: filtered, statusCode: 200 };
  },

  /**
   * Retrieve the current active version snapshot
   */
  getCurrentVersion(
    questionnaireId: string,
    projectId: string,
    userId: string
  ): ServiceResult<QuestionnaireVersion | null> {
    const qRes = this.getById(questionnaireId, projectId, userId);
    if (!qRes.success || !qRes.data) {
      return { success: false, error: qRes.error, statusCode: qRes.statusCode };
    }

    const q = qRes.data;
    if (q.currentVersion === 0) {
      return { success: true, data: null, statusCode: 200 };
    }

    const versions = this._getAllVersions();
    const found = versions.find(
      v => v.questionnaireId === questionnaireId && v.versionNumber === q.currentVersion
    );

    return { success: true, data: found || null, statusCode: 200 };
  },

  /**
   * Update researcher-configurable questionnaire settings
   * Does NOT alter any existing locked QuestionnaireVersion snapshots
   */
  updateSettings(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    settings: QuestionnaireSettingsUpdate
  ): ServiceResult<Questionnaire> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const index = all.findIndex(q => q.id === questionnaireId && q.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    const q = all[index];
    if (q.status === 'Archived') {
      return {
        success: false,
        error: 'Archived questionnaires cannot be updated.',
        statusCode: 400,
      };
    }

    let publicSlug = q.publicSlug;
    if (settings.publicSlug && settings.publicSlug !== q.publicSlug) {
      const candidateSlug = generateBaseSlug(settings.publicSlug);
      publicSlug = ensureUniqueSlug(candidateSlug, all, q.id);
    } else if (settings.title && settings.title !== q.title && q.status === 'Draft') {
      const candidateSlug = generateBaseSlug(settings.title);
      publicSlug = ensureUniqueSlug(candidateSlug, all, q.id);
    }

    const updated: Questionnaire = {
      ...q,
      title: settings.title !== undefined ? settings.title.trim() : q.title,
      introduction: settings.introduction !== undefined ? settings.introduction : q.introduction,
      consentStatement:
        settings.consentStatement !== undefined ? settings.consentStatement : q.consentStatement,
      closingMessage:
        settings.closingMessage !== undefined ? settings.closingMessage : q.closingMessage,
      responseMode: settings.responseMode || q.responseMode,
      publicSlug,
      startDate: settings.startDate !== undefined ? settings.startDate : q.startDate,
      endDate: settings.endDate !== undefined ? settings.endDate : q.endDate,
      maxResponses: settings.maxResponses !== undefined ? settings.maxResponses : q.maxResponses,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    this._saveQuestionnaires(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_settings_updated',
      entityType: 'questionnaire',
      entityId: q.id,
      entityName: updated.title,
      metadata: {
        publicSlug: updated.publicSlug,
        status: updated.status,
        responseMode: updated.responseMode,
      },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Publish a questionnaire.
   * Creates an immutable QuestionnaireVersion snapshot from the approved InstrumentVersion.
   * Enforces:
   * 1. Authorization
   * 2. Instrument is currently Approved
   * 3. Approved InstrumentVersion exists
   * 4. Title, slug, items, and response scale requirements
   * 5. Increments versionNumber and sets isLocked = true
   */
  publish(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    notes?: string
  ): ServiceResult<{ questionnaire: Questionnaire; version: QuestionnaireVersion }> {
    // 1. Authorization
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const index = all.findIndex(q => q.id === questionnaireId && q.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    const questionnaire = all[index];
    if (questionnaire.status === 'Archived') {
      return {
        success: false,
        error: 'Archived questionnaires cannot be published.',
        statusCode: 400,
      };
    }

    // 2. Verify instrument is Approved
    const instRes = instrumentService.getInstrument(
      questionnaire.instrumentId,
      projectId,
      userId
    );
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Underlying instrument not found.', statusCode: 404 };
    }

    const instrument = instRes.data;
    if (instrument.status !== 'Approved') {
      return {
        success: false,
        error: `Cannot publish: Underlying instrument "${instrument.name}" is "${instrument.status}". Only Approved instruments can be published.`,
        statusCode: 400,
      };
    }

    // 3. Find latest approved InstrumentVersion snapshot
    const verRes = instrumentService.getInstrumentVersions(
      questionnaire.instrumentId,
      projectId,
      userId
    );
    const approvedInstrumentVersions = (verRes.data || []).filter(v => v.status === 'Approved');
    if (approvedInstrumentVersions.length === 0) {
      return {
        success: false,
        error: 'Cannot publish: No approved InstrumentVersion snapshot exists.',
        statusCode: 400,
      };
    }

    const latestApprovedInstVersion = approvedInstrumentVersions[0];
    const sourceItems = latestApprovedInstVersion.snapshot.items || [];
    const sourceScales = latestApprovedInstVersion.snapshot.scalesSnapshot || [];
    const scalesMap = new Map(sourceScales.map(s => [s.id, s]));

    // 4. Validate metadata and item rules
    if (!questionnaire.title || !questionnaire.title.trim()) {
      return {
        success: false,
        error: 'Questionnaire title is required before publishing.',
        statusCode: 400,
      };
    }

    if (!questionnaire.publicSlug || !questionnaire.publicSlug.trim()) {
      return {
        success: false,
        error: 'Questionnaire public slug is required before publishing.',
        statusCode: 400,
      };
    }

    if (sourceItems.length === 0) {
      return {
        success: false,
        error: 'Approved instrument contains no measurement items. Cannot publish an empty questionnaire.',
        statusCode: 400,
      };
    }

    // Check item codes uniqueness and scale configurations
    const seenCodes = new Set<string>();
    for (const item of sourceItems) {
      if (!item.questionText || !item.questionText.trim()) {
        return {
          success: false,
          error: `Item #${item.itemNumber} is missing question prompt text.`,
          statusCode: 400,
        };
      }

      if (!item.itemCode || !item.itemCode.trim()) {
        return {
          success: false,
          error: `Item #${item.itemNumber} is missing an item code.`,
          statusCode: 400,
        };
      }

      const codeLower = item.itemCode.trim().toLowerCase();
      if (seenCodes.has(codeLower)) {
        return {
          success: false,
          error: `Duplicate item code detected: "${item.itemCode}". All items must have unique codes.`,
          statusCode: 400,
        };
      }
      seenCodes.add(codeLower);
    }

    // 5. Construct immutable QuestionnaireItemSnapshot array in deterministic order
    const sortedSourceItems = [...sourceItems].sort((a, b) => a.itemNumber - b.itemNumber);
    const itemsSnapshot: QuestionnaireItemSnapshot[] = sortedSourceItems.map((item, idx) => {
      const scale = item.responseScaleId ? scalesMap.get(item.responseScaleId) : undefined;

      return {
        id: item.id,
        itemCode: item.itemCode,
        itemNumber: idx + 1,
        questionText: item.questionText,
        itemType: item.itemType,
        variableId: item.variableId,
        dimensionId: item.dimensionId,
        indicatorId: item.indicatorId,
        responseScaleId: item.responseScaleId,
        responseScaleName: scale?.name,
        responseScaleType: scale?.scaleType,
        scaleOptions: scale?.options ? JSON.parse(JSON.stringify(scale.options)) : undefined,
        required: item.required,
        reverseCoded: item.reverseCoded,
        source: item.source,
        notes: item.notes,
      };
    });

    const nextVersionNumber = questionnaire.currentVersion + 1;
    const now = new Date().toISOString();

    // 6. Create immutable QuestionnaireVersion
    const versionRecord: QuestionnaireVersion = {
      id: `qver_${questionnaire.id}_v${nextVersionNumber}_${Date.now()}`,
      questionnaireId: questionnaire.id,
      instrumentId: questionnaire.instrumentId,
      instrumentVersionId: latestApprovedInstVersion.id,
      versionNumber: nextVersionNumber,
      publishedAt: now,
      itemsSnapshot,
      isLocked: true,
      notes: notes?.trim() || undefined,
      createdAt: now,
    };

    // Save version record (prepend to version list)
    const existingVersions = this._getAllVersions();
    this._saveVersions([versionRecord, ...existingVersions]);

    // 7. Update questionnaire status to Published and increment currentVersion
    const updatedQuestionnaire: Questionnaire = {
      ...questionnaire,
      status: 'Published',
      currentVersion: nextVersionNumber,
      updatedAt: now,
    };

    all[index] = updatedQuestionnaire;
    this._saveQuestionnaires(all);

    // 8. Record audit log
    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_published',
      entityType: 'questionnaire',
      entityId: questionnaire.id,
      entityName: questionnaire.title,
      metadata: {
        versionNumber: nextVersionNumber,
        instrumentId: questionnaire.instrumentId,
        instrumentVersionId: latestApprovedInstVersion.id,
        publicSlug: questionnaire.publicSlug,
        itemCount: itemsSnapshot.length,
      },
    });

    return {
      success: true,
      data: { questionnaire: updatedQuestionnaire, version: versionRecord },
      statusCode: 200,
    };
  },

  /**
   * Pause a Published questionnaire
   */
  pause(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    reason?: string
  ): ServiceResult<Questionnaire> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const index = all.findIndex(q => q.id === questionnaireId && q.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    const q = all[index];
    if (q.status !== 'Published') {
      return {
        success: false,
        error: `Cannot pause questionnaire in "${q.status}" status. Only Published questionnaires can be paused.`,
        statusCode: 400,
      };
    }

    const updated: Questionnaire = {
      ...q,
      status: 'Paused',
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    this._saveQuestionnaires(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_paused',
      entityType: 'questionnaire',
      entityId: q.id,
      entityName: q.title,
      metadata: { reason, previousStatus: 'Published', newStatus: 'Paused' },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Resume a Paused questionnaire back to Published
   */
  resume(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<Questionnaire> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const index = all.findIndex(q => q.id === questionnaireId && q.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    const q = all[index];
    if (q.status !== 'Paused') {
      return {
        success: false,
        error: `Cannot resume questionnaire in "${q.status}" status. Only Paused questionnaires can be resumed.`,
        statusCode: 400,
      };
    }

    const updated: Questionnaire = {
      ...q,
      status: 'Published',
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    this._saveQuestionnaires(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_resumed',
      entityType: 'questionnaire',
      entityId: q.id,
      entityName: q.title,
      metadata: { previousStatus: 'Paused', newStatus: 'Published' },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Close a Published or Paused questionnaire
   */
  close(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string,
    reason?: string
  ): ServiceResult<Questionnaire> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const index = all.findIndex(q => q.id === questionnaireId && q.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    const q = all[index];
    if (q.status !== 'Published' && q.status !== 'Paused') {
      return {
        success: false,
        error: `Cannot close questionnaire in "${q.status}" status. Only Published or Paused questionnaires can be closed.`,
        statusCode: 400,
      };
    }

    const updated: Questionnaire = {
      ...q,
      status: 'Closed',
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    this._saveQuestionnaires(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_closed',
      entityType: 'questionnaire',
      entityId: q.id,
      entityName: q.title,
      metadata: { reason, previousStatus: q.status, newStatus: 'Closed' },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Archive a questionnaire
   */
  archive(
    questionnaireId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<Questionnaire> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllQuestionnaires();
    const index = all.findIndex(q => q.id === questionnaireId && q.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    const q = all[index];
    if (q.status === 'Archived') {
      return {
        success: false,
        error: 'Questionnaire is already archived.',
        statusCode: 400,
      };
    }

    const updated: Questionnaire = {
      ...q,
      status: 'Archived',
      updatedAt: new Date().toISOString(),
    };

    all[index] = updated;
    this._saveQuestionnaires(all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'questionnaire_archived',
      entityType: 'questionnaire',
      entityId: q.id,
      entityName: q.title,
      metadata: { previousStatus: q.status, newStatus: 'Archived' },
    });

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Safe public resolution by publicSlug for future participant survey.
   * Strips researcher identity, project internals, and audit details.
   */
  getBySlug(publicSlug: string): ServiceResult<PublicQuestionnaireDTO> {
    const cleanSlug = (publicSlug || '').toLowerCase().trim();
    if (!cleanSlug) {
      return { success: false, error: 'Slug is required.', statusCode: 400 };
    }

    const all = this._getAllQuestionnaires();
    const q = all.find(item => item.publicSlug.toLowerCase() === cleanSlug);
    if (!q) {
      return { success: false, error: 'Survey not found.', statusCode: 404 };
    }

    if (q.status === 'Archived') {
      return {
        success: false,
        error: 'This survey has been archived and is no longer accessible.',
        statusCode: 400,
      };
    }

    // Resolve items from locked version
    let items: QuestionnaireItemSnapshot[] = [];
    if (q.currentVersion > 0) {
      const versions = this._getAllVersions();
      const currentVer = versions.find(
        v => v.questionnaireId === q.id && v.versionNumber === q.currentVersion
      );
      if (currentVer) {
        items = currentVer.itemsSnapshot;
      }
    }

    const publicDto: PublicQuestionnaireDTO = {
      id: q.id,
      publicSlug: q.publicSlug,
      title: q.title,
      introduction: q.introduction,
      consentStatement: q.consentStatement,
      closingMessage: q.closingMessage,
      responseMode: q.responseMode,
      status: q.status,
      currentVersion: q.currentVersion,
      startDate: q.startDate,
      endDate: q.endDate,
      items,
    };

    return { success: true, data: publicDto, statusCode: 200 };
  },
};
