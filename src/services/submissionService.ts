import {
  PublicQuestionnaireDTO,
  Questionnaire,
  QuestionnaireItemSnapshot,
  QuestionnaireVersion,
  RawItemResponse,
  ResponseMode,
  SubmissionStatus,
  SubmissionValidationStatus,
  SurveySubmission,
} from '../types';
import { auditService } from './auditService';
import { projectService, ServiceResult } from './projectService';
import { questionnaireService } from './questionnaireService';
import { storage } from './storage';

/**
 * Local storage key for raw survey submissions
 * Conforms to namespacing convention: qrp_v1_survey_submissions
 */
const SUBMISSIONS_KEY = 'survey_submissions';

/**
 * Quality heuristic thresholds
 * These are non-destructive and flag entries without mutating raw data.
 */
export const QUALITY_CONFIG = {
  /**
   * Minimum seconds per question considered realistic human reading and answering speed.
   * Total threshold = itemCount * MIN_SECONDS_PER_ITEM (min bound 5 seconds).
   */
  MIN_SECONDS_PER_ITEM: 1.5,
  /**
   * Minimum number of identical scale questions required to evaluate straightlining.
   */
  MIN_SCALE_ITEMS_FOR_STRAIGHTLINING: 4,
};

export interface StartSurveySessionResult {
  sessionId: string;
  startedAt: string;
  questionnaire: PublicQuestionnaireDTO;
  questionnaireVersionId: string;
}

export interface RawSubmissionPayload {
  questionnaireId: string;
  questionnaireVersionId: string;
  sessionId: string;
  startedAt: string;
  consentGiven: boolean;
  participantIdentifier?: string | null;
  /**
   * Key: item.itemCode, Value: raw participant answer as string
   */
  rawResponses: Record<string, string>;
}

export interface SubmissionValidationResult {
  isValid: boolean;
  errors: string[];
  flags: string[];
}

export interface RawCsvExportResult {
  csvContent: string;
  filename: string;
  totalRows: number;
}

export const submissionService = {
  _getAllSubmissions(): SurveySubmission[] {
    return storage.get<SurveySubmission[]>(SUBMISSIONS_KEY, []);
  },

  _saveSubmissions(list: SurveySubmission[]): void {
    storage.set(SUBMISSIONS_KEY, list);
  },

  /**
   * Starts a secure participant session for a public survey.
   * Verifies that the questionnaire is in 'Published' state and within active date/max-response windows.
   */
  startSession(publicSlug: string): ServiceResult<StartSurveySessionResult> {
    const slugRes = questionnaireService.getBySlug(publicSlug);
    if (!slugRes.success || !slugRes.data) {
      return {
        success: false,
        error: slugRes.error || 'Public survey not found.',
        statusCode: slugRes.statusCode || 404,
      };
    }

    const publicDto = slugRes.data;

    // Check status
    if (publicDto.status !== 'Published') {
      return {
        success: false,
        error: `This survey is currently not accepting submissions (status: ${publicDto.status}).`,
        statusCode: 400,
      };
    }

    // Check date windows
    const now = new Date();
    if (publicDto.startDate && new Date(publicDto.startDate) > now) {
      return {
        success: false,
        error: `This survey is scheduled to open on ${new Date(publicDto.startDate).toLocaleDateString()}.`,
        statusCode: 400,
      };
    }
    if (publicDto.endDate && new Date(publicDto.endDate) < now) {
      return {
        success: false,
        error: `This survey closed on ${new Date(publicDto.endDate).toLocaleDateString()}.`,
        statusCode: 400,
      };
    }

    // Resolve current locked questionnaire version
    const allVersions = questionnaireService._getAllVersions();
    const lockedVersion = allVersions.find(
      v => v.questionnaireId === publicDto.id && v.versionNumber === publicDto.currentVersion
    );

    if (!lockedVersion) {
      return {
        success: false,
        error: 'Published questionnaire release version snapshot could not be resolved.',
        statusCode: 500,
      };
    }

    // Check max responses if configured
    const allSubmissions = this._getAllSubmissions();
    const existingCount = allSubmissions.filter(
      s => s.questionnaireId === publicDto.id && s.status === 'Submitted'
    ).length;

    // Need raw questionnaire to check maxResponses
    const fullQ = questionnaireService
      ._getAllQuestionnaires()
      .find(q => q.id === publicDto.id);
    if (fullQ?.maxResponses && existingCount >= fullQ.maxResponses) {
      return {
        success: false,
        error: 'This survey has reached its maximum response quota and is no longer accepting submissions.',
        statusCode: 400,
      };
    }

    // Create random non-sequential, non-predictable session ID
    const randomBytes = Math.random().toString(36).substring(2, 12);
    const timeFragment = Date.now().toString(36);
    const sessionId = `sess_${timeFragment}_${randomBytes}`;
    const startedAt = new Date().toISOString();

    // Log lineage audit event (anonymous session initiation, no participant identity)
    if (fullQ) {
      auditService.logAction({
        userId: 'participant_anonymous',
        userName: 'Survey Participant',
        projectId: fullQ.projectId,
        action: 'survey_session_started',
        entityType: 'survey_submission',
        entityId: sessionId,
        entityName: `Participant Session for ${publicDto.title}`,
        metadata: {
          questionnaireId: publicDto.id,
          questionnaireVersionId: lockedVersion.id,
          versionNumber: publicDto.currentVersion,
          publicSlug: publicDto.publicSlug,
        },
      });
    }

    return {
      success: true,
      data: {
        sessionId,
        startedAt,
        questionnaire: publicDto,
        questionnaireVersionId: lockedVersion.id,
      },
      statusCode: 200,
    };
  },

  /**
   * Deterministic server/service-side validation of a participant submission.
   * Verifies questionnaire existence, availability, consent, required items, valid options,
   * participant identifier mode, and duplicate submission prevention.
   */
  validateSubmission(
    payload: RawSubmissionPayload,
    questionnaire: Questionnaire,
    version: QuestionnaireVersion
  ): SubmissionValidationResult {
    const errors: string[] = [];
    const flags: string[] = [];

    // 1. Consent validation
    if (!payload.consentGiven) {
      errors.push('Informed consent must be explicitly granted before submitting responses.');
    }

    // 2. Questionnaire availability check
    if (questionnaire.status !== 'Published') {
      errors.push(`Questionnaire is not currently published (current status: ${questionnaire.status}).`);
    }

    const now = new Date();
    if (questionnaire.startDate && new Date(questionnaire.startDate) > now) {
      errors.push('Questionnaire has not opened yet.');
    }
    if (questionnaire.endDate && new Date(questionnaire.endDate) < now) {
      errors.push('Questionnaire submission period has ended.');
    }

    // 3. Version integrity check
    if (version.questionnaireId !== questionnaire.id) {
      errors.push('Version does not match questionnaire.');
    }
    if (!version.isLocked) {
      errors.push('Target questionnaire version is not frozen/locked.');
    }

    // 4. Duplicate submission check (session ID uniqueness)
    const existing = this._getAllSubmissions();
    const duplicateSession = existing.find(
      s => s.sessionId === payload.sessionId && s.status === 'Submitted'
    );
    if (duplicateSession) {
      errors.push('A submission has already been recorded for this participant session.');
    }

    // 5. Response Mode & Participant Identifier check
    if (questionnaire.responseMode === 'identified') {
      if (!payload.participantIdentifier || !payload.participantIdentifier.trim()) {
        errors.push('Participant identifier is required for this identified survey.');
      }
    }

    // 6. Max responses check
    if (questionnaire.maxResponses) {
      const submittedCount = existing.filter(
        s => s.questionnaireId === questionnaire.id && s.status === 'Submitted'
      ).length;
      if (submittedCount >= questionnaire.maxResponses) {
        errors.push('The response limit for this questionnaire has been reached.');
      }
    }

    // 7. Item-level response validation against version snapshot
    const itemMap = new Map<string, QuestionnaireItemSnapshot>();
    version.itemsSnapshot.forEach(item => {
      itemMap.set(item.itemCode, item);
    });

    // Check every submitted item actually exists in snapshot
    for (const code of Object.keys(payload.rawResponses)) {
      if (!itemMap.has(code)) {
        errors.push(`Submitted item code "${code}" does not exist in questionnaire version snapshot.`);
      }
    }

    // Check required items and value validity
    for (const item of version.itemsSnapshot) {
      const rawVal = payload.rawResponses[item.itemCode];
      const isProvided = rawVal !== undefined && rawVal !== null && rawVal.trim() !== '';

      if (item.required && !isProvided) {
        errors.push(`Question ${item.itemNumber} (${item.itemCode}) is required.`);
        continue;
      }

      if (isProvided) {
        // Validate option according to item type
        if (item.itemType === 'Likert' || item.itemType === 'Multiple Choice') {
          if (item.scaleOptions && item.scaleOptions.length > 0) {
            const allowedLabels = item.scaleOptions.map(o => o.label.trim().toLowerCase());
            const valNormalized = rawVal.trim().toLowerCase();
            const matchesOption = allowedLabels.includes(valNormalized);
            if (!matchesOption) {
              errors.push(
                `Invalid response for Question ${item.itemNumber}: "${rawVal}" is not an authorized option.`
              );
            }
          }
        } else if (item.itemType === 'Yes/No') {
          const valNormalized = rawVal.trim().toLowerCase();
          if (valNormalized !== 'yes' && valNormalized !== 'no') {
            errors.push(`Invalid response for Question ${item.itemNumber}: value must be "Yes" or "No".`);
          }
        } else if (item.itemType === 'Numeric') {
          const num = Number(rawVal.trim());
          if (isNaN(num)) {
            errors.push(`Invalid response for Question ${item.itemNumber}: "${rawVal}" is not a valid number.`);
          }
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      flags,
    };
  },

  /**
   * Evaluates non-destructive quality heuristics after valid submission.
   * Does NOT alter raw responses.
   */
  _computeQualityFlags(
    rawResponses: Record<string, string>,
    durationSeconds: number,
    itemsSnapshot: QuestionnaireItemSnapshot[]
  ): string[] {
    const flags: string[] = [];

    // 1. SPEEDER heuristic
    const minExpectedSeconds = Math.max(
      5,
      itemsSnapshot.length * QUALITY_CONFIG.MIN_SECONDS_PER_ITEM
    );
    if (durationSeconds < minExpectedSeconds) {
      flags.push('SPEEDER');
    }

    // 2. STRAIGHTLINING heuristic (scale questions only)
    const scaleItems = itemsSnapshot.filter(
      item => (item.itemType === 'Likert' || item.itemType === 'Multiple Choice') && item.scaleOptions
    );

    if (scaleItems.length >= QUALITY_CONFIG.MIN_SCALE_ITEMS_FOR_STRAIGHTLINING) {
      const scaleAnswers = scaleItems
        .map(i => rawResponses[i.itemCode])
        .filter(val => val !== undefined && val !== null && val.trim() !== '');

      if (scaleAnswers.length >= QUALITY_CONFIG.MIN_SCALE_ITEMS_FOR_STRAIGHTLINING) {
        const first = scaleAnswers[0].trim().toLowerCase();
        const allIdentical = scaleAnswers.every(a => a.trim().toLowerCase() === first);
        if (allIdentical) {
          flags.push('STRAIGHTLINING');
        }
      }
    }

    return flags;
  },

  /**
   * Submit raw participant responses.
   * Strictly preserves raw submitted values without converting to numeric codes.
   */
  submit(payload: RawSubmissionPayload): ServiceResult<SurveySubmission> {
    // 1. Resolve questionnaire
    const allQ = questionnaireService._getAllQuestionnaires();
    const q = allQ.find(item => item.id === payload.questionnaireId);
    if (!q) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    // 2. Resolve questionnaire version
    const allV = questionnaireService._getAllVersions();
    const version = allV.find(v => v.id === payload.questionnaireVersionId);
    if (!version) {
      return { success: false, error: 'Questionnaire version not found.', statusCode: 404 };
    }

    // 3. Strict Service-Side Validation
    const valResult = this.validateSubmission(payload, q, version);
    if (!valResult.isValid) {
      return {
        success: false,
        error: valResult.errors.join(' '),
        statusCode: 400,
      };
    }

    // 4. Calculate duration
    const submittedAt = new Date().toISOString();
    const startMs = new Date(payload.startedAt).getTime();
    const submitMs = new Date(submittedAt).getTime();
    const rawDiffSec = Math.round((submitMs - (isNaN(startMs) ? submitMs : startMs)) / 1000);
    const durationSeconds = Math.max(0, rawDiffSec);

    // 5. Run non-destructive quality heuristics
    const qualityFlags = this._computeQualityFlags(
      payload.rawResponses,
      durationSeconds,
      version.itemsSnapshot
    );

    const validationStatus: SubmissionValidationStatus =
      qualityFlags.length > 0 ? 'Flagged' : 'Valid';

    // 6. Build RawItemResponse details preserving raw values
    const rawItemDetails: RawItemResponse[] = [];
    for (const item of version.itemsSnapshot) {
      const val = payload.rawResponses[item.itemCode] ?? '';
      rawItemDetails.push({
        itemId: item.id,
        itemCode: item.itemCode,
        rawValue: val,
        rawDisplayValue: val,
      });
    }

    // 7. Construct immutable SurveySubmission record
    const submissionId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const submission: SurveySubmission = {
      id: submissionId,
      questionnaireId: q.id,
      questionnaireVersionId: version.id,
      questionnaireVersion: version.versionNumber,
      projectId: q.projectId,
      sessionId: payload.sessionId,
      participantMode: q.responseMode,
      participantIdentifier:
        q.responseMode === 'identified' ? payload.participantIdentifier?.trim() || null : null,
      consentGiven: true,
      startedAt: payload.startedAt,
      submittedAt,
      durationSeconds,
      status: 'Submitted',
      validationStatus,
      validationFlags: qualityFlags,
      rawResponses: { ...payload.rawResponses },
      rawItemDetails,
      createdAt: submittedAt,
    };

    // 8. Persist raw submission
    const submissions = this._getAllSubmissions();
    this._saveSubmissions([submission, ...submissions]);

    // 9. Audit event (lineage record without leaking raw participant answers)
    auditService.logAction({
      userId: 'participant_anonymous',
      userName: 'Survey Participant',
      projectId: q.projectId,
      action: 'submission_received',
      entityType: 'survey_submission',
      entityId: submission.id,
      entityName: `Submission for ${q.title} (v${version.versionNumber})`,
      metadata: {
        questionnaireId: q.id,
        questionnaireVersionId: version.id,
        versionNumber: version.versionNumber,
        sessionId: payload.sessionId,
        durationSeconds,
        validationStatus,
        flagCount: qualityFlags.length,
        flags: qualityFlags,
      },
    });

    return {
      success: true,
      data: submission,
      statusCode: 201,
    };
  },

  /**
   * Retrieve a submission by ID with strict project-level authorization.
   */
  getById(submissionId: string, projectId: string, userId: string): ServiceResult<SurveySubmission> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const submissions = this._getAllSubmissions();
    const submission = submissions.find(s => s.id === submissionId && s.projectId === projectId);
    if (!submission) {
      return { success: false, error: 'Submission not found.', statusCode: 404 };
    }

    return { success: true, data: submission, statusCode: 200 };
  },

  /**
   * Retrieve submissions for a questionnaire with strict project authorization.
   */
  getByQuestionnaire(
    questionnaireId: string,
    projectId: string,
    userId: string
  ): ServiceResult<SurveySubmission[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllSubmissions();
    const filtered = all.filter(
      s => s.questionnaireId === questionnaireId && s.projectId === projectId
    );

    return { success: true, data: filtered, statusCode: 200 };
  },

  /**
   * Retrieve all submissions for a project with strict project authorization.
   */
  getProjectSubmissions(projectId: string, userId: string): ServiceResult<SurveySubmission[]> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllSubmissions();
    const filtered = all.filter(s => s.projectId === projectId);

    return { success: true, data: filtered, statusCode: 200 };
  },

  /**
   * Count submissions for a questionnaire by status.
   */
  countByQuestionnaire(
    questionnaireId: string,
    projectId: string,
    userId: string
  ): ServiceResult<{
    total: number;
    valid: number;
    flagged: number;
    excluded: number;
    averageDurationSeconds: number;
    latestSubmittedAt: string | null;
  }> {
    const res = this.getByQuestionnaire(questionnaireId, projectId, userId);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error,
        statusCode: res.statusCode,
      };
    }

    const submissions = res.data.filter(s => s.status === 'Submitted');
    const total = submissions.length;
    const valid = submissions.filter(s => s.validationStatus === 'Valid').length;
    const flagged = submissions.filter(s => s.validationStatus === 'Flagged').length;
    const excluded = submissions.filter(s => s.validationStatus === 'Excluded').length;

    const totalDuration = submissions.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
    const averageDurationSeconds = total > 0 ? Math.round(totalDuration / total) : 0;

    let latestSubmittedAt: string | null = null;
    if (submissions.length > 0) {
      const sorted = [...submissions].sort(
        (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );
      latestSubmittedAt = sorted[0].submittedAt;
    }

    return {
      success: true,
      data: {
        total,
        valid,
        flagged,
        excluded,
        averageDurationSeconds,
        latestSubmittedAt,
      },
      statusCode: 200,
    };
  },

  /**
   * Update researcher validation status (e.g. manually mark Flagged or Excluded)
   * Raw responses are never altered.
   */
  updateValidationDecision(
    submissionId: string,
    projectId: string,
    userId: string,
    decision: {
      validationStatus: SubmissionValidationStatus;
      notes?: string;
    }
  ): ServiceResult<SurveySubmission> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    const all = this._getAllSubmissions();
    const index = all.findIndex(s => s.id === submissionId && s.projectId === projectId);
    if (index === -1) {
      return { success: false, error: 'Submission not found.', statusCode: 404 };
    }

    const current = all[index];
    const updated: SurveySubmission = {
      ...current,
      validationStatus: decision.validationStatus,
      researcherDecisionNotes: decision.notes ?? current.researcherDecisionNotes,
    };

    all[index] = updated;
    this._saveSubmissions(all);

    return { success: true, data: updated, statusCode: 200 };
  },

  /**
   * Deterministic Raw CSV Export
   * Output strictly preserves raw submitted text/values without numeric coding or reverse coding.
   */
  exportRawData(
    questionnaireId: string,
    projectId: string,
    userId: string
  ): ServiceResult<RawCsvExportResult> {
    const pCheck = projectService.getProject(projectId, userId);
    if (!pCheck.success) {
      return { success: false, error: pCheck.error, statusCode: pCheck.statusCode };
    }

    // Get questionnaire
    const allQ = questionnaireService._getAllQuestionnaires();
    const q = allQ.find(item => item.id === questionnaireId && item.projectId === projectId);
    if (!q) {
      return { success: false, error: 'Questionnaire not found.', statusCode: 404 };
    }

    // Get versions to determine stable item order
    const versions = questionnaireService._getAllVersions().filter(v => v.questionnaireId === q.id);
    if (versions.length === 0) {
      return { success: false, error: 'No questionnaire versions found.', statusCode: 400 };
    }

    // Sort versions by versionNumber descending to get items list (union of all items or latest)
    const latestVersion = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
    const orderedItems = [...latestVersion.itemsSnapshot].sort((a, b) => a.itemNumber - b.itemNumber);

    // Get submissions
    const submissionsRes = this.getByQuestionnaire(questionnaireId, projectId, userId);
    if (!submissionsRes.success || !submissionsRes.data) {
      return { success: false, error: submissionsRes.error, statusCode: submissionsRes.statusCode };
    }

    const submissions = submissionsRes.data.filter(s => s.status === 'Submitted');

    // Build CSV header
    // Metadata columns + one column per item code
    const metaHeaders = [
      'submission_id',
      'session_id',
      'participant_mode',
      'participant_identifier',
      'questionnaire_version',
      'started_at',
      'submitted_at',
      'duration_seconds',
      'validation_status',
      'validation_flags',
    ];

    const itemHeaders = orderedItems.map(item => item.itemCode);
    const headers = [...metaHeaders, ...itemHeaders];

    const escapeCsv = (str: string | number | null | undefined): string => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows: string[] = [];
    rows.push(headers.join(','));

    for (const sub of submissions) {
      const rowVals: string[] = [
        escapeCsv(sub.id),
        escapeCsv(sub.sessionId),
        escapeCsv(sub.participantMode),
        escapeCsv(sub.participantIdentifier || ''),
        escapeCsv(sub.questionnaireVersion),
        escapeCsv(sub.startedAt),
        escapeCsv(sub.submittedAt),
        escapeCsv(sub.durationSeconds),
        escapeCsv(sub.validationStatus),
        escapeCsv(sub.validationFlags.join('; ')),
      ];

      for (const item of orderedItems) {
        const rawVal = sub.rawResponses[item.itemCode] ?? '';
        rowVals.push(escapeCsv(rawVal));
      }

      rows.push(rowVals.join(','));
    }

    const csvContent = rows.join('\r\n');
    const safeTitle = q.title.toLowerCase().replace(/[^a-z0-9]+/g, '_');
    const filename = `raw_responses_${safeTitle}_v${q.currentVersion}_${new Date().toISOString().split('T')[0]}.csv`;

    return {
      success: true,
      data: {
        csvContent,
        filename,
        totalRows: submissions.length,
      },
      statusCode: 200,
    };
  },
};
