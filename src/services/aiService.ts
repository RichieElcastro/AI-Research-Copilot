import { storage } from './storage';
import { projectService, ServiceResult } from './projectService';
import { variableService } from './variableService';
import { instrumentService } from './instrumentService';
import { scaleService } from './scaleService';
import { auditService } from './auditService';
import { qualityEngine } from './qualityEngine';
import {
  AIGeneration,
  AIGeneratedItem,
  AIGenerationRequestPayload,
  AIGenerationResponsePayload,
  InstrumentItem,
} from '../types';

const GENERATIONS_KEY = 'ai_generations';
const CANDIDATES_KEY = 'ai_candidates';

export const aiService = {
  _getAllGenerations(): AIGeneration[] {
    return storage.get<AIGeneration[]>(GENERATIONS_KEY, []);
  },

  _saveGenerations(generations: AIGeneration[]): void {
    storage.set(GENERATIONS_KEY, generations);
  },

  _getAllCandidates(): AIGeneratedItem[] {
    return storage.get<AIGeneratedItem[]>(CANDIDATES_KEY, []);
  },

  _saveCandidates(candidates: AIGeneratedItem[]): void {
    storage.set(CANDIDATES_KEY, candidates);
  },

  /**
   * Generates candidate questionnaire items using structured context
   */
  async generateCandidates(
    payload: AIGenerationRequestPayload,
    userId: string,
    userName: string
  ): Promise<ServiceResult<{ generation: AIGeneration; candidates: AIGeneratedItem[] }>> {
    // 1. Strict Tenant Authorization
    const pRes = projectService.getProject(payload.projectId, userId);
    if (!pRes.success || !pRes.data) {
      return { success: false, error: pRes.error || 'Access denied.', statusCode: pRes.statusCode || 403 };
    }
    const project = pRes.data;

    // 2. Instrument Verification
    const instRes = instrumentService.getInstrument(payload.instrumentId, payload.projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }
    const instrument = instRes.data;

    // Guard: Do not allow AI generation to target an approved instrument directly
    if (instrument.status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot accept new items. Branch a new version first before generating items.',
        statusCode: 403,
      };
    }

    // 3. Variable & Construct Context Resolution
    const varsRes = variableService.getVariables(payload.projectId, userId);
    if (!varsRes.success || !varsRes.data) {
      return { success: false, error: 'Failed to retrieve project variables.', statusCode: 500 };
    }
    const variable = varsRes.data.find((v) => v.id === payload.variableId);
    if (!variable) {
      return { success: false, error: 'Selected variable not found.', statusCode: 400 };
    }

    const dimension = variable.dimensions.find((d) => d.id === payload.dimensionId);
    let indicator = dimension?.indicators.find((ind) => ind.id === payload.indicatorId);
    if (!indicator && payload.indicatorId) {
      // Find across any dimension of this variable
      for (const d of variable.dimensions) {
        const found = d.indicators.find((i) => i.id === payload.indicatorId);
        if (found) {
          indicator = found;
          break;
        }
      }
    }

    if (!indicator) {
      return {
        success: false,
        error: 'An empirical indicator is required to ground item generation.',
        statusCode: 400,
      };
    }

    // 4. Response Scale Resolution
    let responseScaleName = 'Likert 5-point';
    let responseScaleType = 'Likert';
    let responseScaleOptions: { value: number; label: string }[] = [];

    if (payload.responseScaleId) {
      const scalesRes = scaleService.getScales(payload.projectId, userId);
      const scale = scalesRes.data?.find((s) => s.id === payload.responseScaleId);
      if (scale) {
        responseScaleName = scale.name;
        responseScaleType = scale.scaleType;
        responseScaleOptions = scale.options.map((o) => ({ value: o.value, label: o.label }));
      }
    }

    const targetPopulation =
      payload.targetPopulation ||
      project.population ||
      project.sampleDescription ||
      'Undergraduate University Students';

    // 5. Construct Server Request Body
    const requestBody = {
      projectId: payload.projectId,
      instrumentId: payload.instrumentId,
      variableName: variable.name,
      variableDefinition: variable.conceptualDefinition,
      operationalDefinition: variable.operationalDefinition,
      dimensionName: dimension?.name,
      dimensionDefinition: dimension?.definition || dimension?.description,
      indicatorName: indicator.name,
      indicatorDefinition: indicator.definition || indicator.description,
      targetPopulation,
      responseScaleName,
      responseScaleType,
      responseScaleOptions,
      numberOfItems: payload.numberOfItems || 4,
      language: payload.language || 'English',
      additionalInstructions: payload.additionalInstructions || '',
    };

    // 6. Call Backend API (/api/ai/generate-items)
    let apiResult: AIGenerationResponsePayload;
    try {
      const res = await fetch('/api/ai/generate-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP error ${res.status}`);
      }

      apiResult = await res.json();
    } catch (err: any) {
      console.warn('Backend /api/ai/generate-items call failed, using client-side fallback generator...', err);
      // Fallback response in case backend network/endpoint was temporarily unreachable
      apiResult = {
        generationId: `gen_client_${Date.now()}`,
        isDemoMode: true,
        model: 'demo-client-fallback',
        promptVersion: 'questionnaire_generator_v1',
        items: [
          {
            candidateId: `cand_fb_${Date.now()}_1`,
            questionText:
              payload.language === 'Indonesian'
                ? `Saya secara konsisten memperhatikan ${indicator.name.toLowerCase()} dalam aktivitas harian saya.`
                : `I consistently demonstrate ${indicator.name.toLowerCase()} when engaging with relevant daily tasks.`,
            suggestedItemType: 'Likert',
            reverseCoded: false,
            qualityNotes: ['Direct behavioral mapping to indicator.'],
            potentialIssues: [],
            confidence: 'high',
          },
          {
            candidateId: `cand_fb_${Date.now()}_2`,
            questionText:
              payload.language === 'Indonesian'
                ? `Saya merasa sulit untuk mempertahankan ${indicator.name.toLowerCase()} ketika menghadapi tekanan.`
                : `I find it challenging to maintain ${indicator.name.toLowerCase()} under demanding conditions.`,
            suggestedItemType: 'Likert',
            reverseCoded: true,
            qualityNotes: ['Negatively-keyed reverse-scored statement.'],
            potentialIssues: [],
            confidence: 'high',
          },
        ],
        generationNotes: ['Client fallback demo items generated.'],
        warnings: [err.message || 'API endpoint unreachable'],
      };
    }

    // 7. Persist AIGeneration Record
    const now = new Date().toISOString();
    const generation: AIGeneration = {
      id: apiResult.generationId || `gen_${Date.now()}`,
      projectId: payload.projectId,
      instrumentId: payload.instrumentId,
      variableId: payload.variableId,
      dimensionId: payload.dimensionId,
      indicatorId: payload.indicatorId,
      model: apiResult.model,
      promptVersion: apiResult.promptVersion,
      generationParameters: {
        numberOfItems: payload.numberOfItems,
        language: payload.language,
        targetPopulation,
        additionalInstructions: payload.additionalInstructions,
        scaleName: responseScaleName,
        scaleType: responseScaleType,
      },
      isDemoMode: apiResult.isDemoMode,
      generatedAt: now,
      generatedBy: userId,
      status: 'Generated',
      generationNotes: apiResult.generationNotes,
      warnings: apiResult.warnings,
    };

    const allGenerations = this._getAllGenerations();
    this._saveGenerations([...allGenerations, generation]);

    // 8. Quality Check and Duplicate Detection on Existing Items
    const existingItems = (instrument.items || []).map((it) => ({
      id: it.id,
      itemCode: it.itemCode,
      questionText: it.questionText,
    }));

    const candidates: AIGeneratedItem[] = apiResult.items.map((item, idx) => {
      // Deterministic psychometric checks
      const deterministicIssues = qualityEngine.checkItemQuality(
        item.questionText,
        responseScaleType,
        Boolean(item.reverseCoded)
      );

      // Duplicate detection against existing instrument items
      const duplicates = qualityEngine.findDuplicates(item.questionText, existingItems);
      const dupWarning =
        duplicates.length > 0
          ? `Potential duplicate: ${duplicates[0].similarity}% match with item ${duplicates[0].itemCode || ''} ("${duplicates[0].text.substring(0, 45)}...")`
          : undefined;

      const combinedQualityFlags = [
        ...item.qualityNotes,
        ...deterministicIssues.filter((i) => i.type === 'info').map((i) => i.message),
      ];

      const combinedPotentialIssues = [
        ...item.potentialIssues,
        ...deterministicIssues.filter((i) => i.type !== 'info').map((i) => i.message),
      ];

      return {
        id: `cand_${Date.now()}_${idx + 1}_${Math.random().toString(36).substring(2, 6)}`,
        generationId: generation.id,
        candidateId: item.candidateId,
        questionText: item.questionText,
        suggestedItemType: item.suggestedItemType,
        variableId: payload.variableId,
        dimensionId: payload.dimensionId,
        indicatorId: payload.indicatorId,
        responseScaleId: payload.responseScaleId,
        reverseCoded: Boolean(item.reverseCoded),
        qualityFlags: combinedQualityFlags,
        potentialIssues: combinedPotentialIssues,
        confidence: item.confidence,
        generationMetadata: {
          model: apiResult.model,
          promptVersion: apiResult.promptVersion,
          isDemo: apiResult.isDemoMode,
        },
        status: 'Candidate',
        originalText: item.questionText,
        modifiedByResearcher: false,
        duplicateWarning: dupWarning,
        createdAt: now,
      };
    });

    const allCandidates = this._getAllCandidates();
    this._saveCandidates([...allCandidates, ...candidates]);

    // 9. Audit Log
    auditService.logAction({
      userId,
      userName,
      projectId: payload.projectId,
      action: 'ai_generation_created',
      entityType: 'ai_generation',
      entityId: generation.id,
      entityName: `${indicator.name} (${apiResult.model})`,
      metadata: {
        instrumentId: payload.instrumentId,
        itemCount: candidates.length,
        isDemoMode: apiResult.isDemoMode,
        promptVersion: apiResult.promptVersion,
        language: payload.language,
      },
    });

    return {
      success: true,
      data: { generation, candidates },
      statusCode: 200,
    };
  },

  /**
   * Retrieve generations for an instrument
   */
  getGenerations(instrumentId: string, projectId: string, userId: string): ServiceResult<AIGeneration[]> {
    const pRes = projectService.getProject(projectId, userId);
    if (!pRes.success) {
      return { success: false, error: pRes.error, statusCode: pRes.statusCode };
    }

    const all = this._getAllGenerations();
    const filtered = all
      .filter((g) => g.instrumentId === instrumentId && g.projectId === projectId)
      .sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

    return { success: true, data: filtered, statusCode: 200 };
  },

  /**
   * Retrieve candidate items for a specific generation
   */
  getCandidates(generationId: string, projectId: string, userId: string): ServiceResult<AIGeneratedItem[]> {
    const pRes = projectService.getProject(projectId, userId);
    if (!pRes.success) {
      return { success: false, error: pRes.error, statusCode: pRes.statusCode };
    }

    const all = this._getAllCandidates();
    const filtered = all.filter((c) => c.generationId === generationId);

    return { success: true, data: filtered, statusCode: 200 };
  },

  /**
   * Retrieve all candidate items associated with an instrument
   */
  getAllCandidatesForInstrument(
    instrumentId: string,
    projectId: string,
    userId: string
  ): ServiceResult<AIGeneratedItem[]> {
    const pRes = projectService.getProject(projectId, userId);
    if (!pRes.success) {
      return { success: false, error: pRes.error, statusCode: pRes.statusCode };
    }

    const generations = this._getAllGenerations().filter(
      (g) => g.instrumentId === instrumentId && g.projectId === projectId
    );
    const genIds = new Set(generations.map((g) => g.id));

    const candidates = this._getAllCandidates().filter((c) => genIds.has(c.generationId));
    return { success: true, data: candidates, statusCode: 200 };
  },

  /**
   * Accept an AI candidate item: converts it into a draft InstrumentItem
   * Preserves full provenance: original text, generation ID, candidate ID
   */
  acceptCandidate(
    candidateId: string,
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<{ item: InstrumentItem; candidate: AIGeneratedItem }> {
    const pRes = projectService.getProject(projectId, userId);
    if (!pRes.success) {
      return { success: false, error: pRes.error, statusCode: pRes.statusCode };
    }

    const candidates = this._getAllCandidates();
    const cIndex = candidates.findIndex((c) => c.id === candidateId);
    if (cIndex === -1) {
      return { success: false, error: 'Candidate item not found.', statusCode: 404 };
    }
    const candidate = candidates[cIndex];

    const instRes = instrumentService.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }
    const instrument = instRes.data;

    if (instrument.status === 'Approved') {
      return {
        success: false,
        error: 'Approved instruments cannot accept new items. Branch a new version first.',
        statusCode: 403,
      };
    }

    // Auto-generate code e.g. "DMS.09" or "ITEM.01"
    const prefix = instrument.code || 'ITEM';
    const existingCodes = new Set((instrument.items || []).map((it) => it.itemCode.toUpperCase()));
    let nextNum = (instrument.items || []).length + 1;
    let proposedCode = `${prefix}.${String(nextNum).padStart(2, '0')}`;
    while (existingCodes.has(proposedCode.toUpperCase())) {
      nextNum++;
      proposedCode = `${prefix}.${String(nextNum).padStart(2, '0')}`;
    }

    const finalText = candidate.finalText || candidate.questionText;

    // Create item via instrumentService
    const createRes = instrumentService.createItem(instrumentId, projectId, userId, userName, {
      questionText: finalText,
      itemCode: proposedCode,
      itemType: candidate.suggestedItemType || 'Likert',
      variableId: candidate.variableId,
      dimensionId: candidate.dimensionId,
      indicatorId: candidate.indicatorId,
      responseScaleId: candidate.responseScaleId,
      required: true,
      reverseCoded: candidate.reverseCoded,
      source: 'AI Generated',
      aiCandidateId: candidate.id,
      aiGenerationId: candidate.generationId,
      originalAiText: candidate.originalText,
      modifiedByResearcher: candidate.modifiedByResearcher,
      notes: candidate.modifiedByResearcher
        ? `AI Generated candidate edited by researcher. Original: "${candidate.originalText}"`
        : 'AI Generated candidate accepted into instrument as draft item.',
    });

    if (!createRes.success || !createRes.data) {
      return { success: false, error: createRes.error, statusCode: createRes.statusCode };
    }

    // Update candidate status
    candidate.status = 'AddedToInstrument';
    candidate.acceptedItemId = createRes.data.id;
    candidates[cIndex] = candidate;
    this._saveCandidates(candidates);

    // Update parent generation status
    const generations = this._getAllGenerations();
    const gIndex = generations.findIndex((g) => g.id === candidate.generationId);
    if (gIndex !== -1) {
      const genCandidates = candidates.filter((c) => c.generationId === candidate.generationId);
      const allAccepted = genCandidates.every((c) => c.status === 'AddedToInstrument');
      generations[gIndex].status = allAccepted ? 'Accepted' : 'Partially Accepted';
      this._saveGenerations(generations);
    }

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'ai_candidate_accepted',
      entityType: 'ai_item',
      entityId: candidate.id,
      entityName: proposedCode,
      metadata: {
        instrumentId,
        generationId: candidate.generationId,
        itemId: createRes.data.id,
        modifiedByResearcher: candidate.modifiedByResearcher,
      },
    });

    return {
      success: true,
      data: { item: createRes.data, candidate },
      statusCode: 200,
    };
  },

  /**
   * Edit an AI candidate item prior to acceptance
   * Preserves the original AI text while storing researcher revisions
   */
  editCandidate(
    candidateId: string,
    projectId: string,
    userId: string,
    userName: string,
    updates: {
      questionText: string;
      reverseCoded?: boolean;
    }
  ): ServiceResult<AIGeneratedItem> {
    const pRes = projectService.getProject(projectId, userId);
    if (!pRes.success) {
      return { success: false, error: pRes.error, statusCode: pRes.statusCode };
    }

    const candidates = this._getAllCandidates();
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      return { success: false, error: 'Candidate not found.', statusCode: 404 };
    }

    const candidate = candidates[index];
    const newText = updates.questionText.trim();
    if (!newText) {
      return { success: false, error: 'Question text cannot be empty.', statusCode: 400 };
    }

    const isDifferent = newText !== candidate.originalText;
    candidate.finalText = newText;
    candidate.questionText = newText;
    if (updates.reverseCoded !== undefined) {
      candidate.reverseCoded = updates.reverseCoded;
    }
    candidate.modifiedByResearcher = isDifferent;
    candidate.status = 'Edited';

    // Re-run quality check on edited text
    const deterministicIssues = qualityEngine.checkItemQuality(newText, undefined, candidate.reverseCoded);
    candidate.potentialIssues = deterministicIssues.filter((i) => i.type !== 'info').map((i) => i.message);

    candidates[index] = candidate;
    this._saveCandidates(candidates);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'ai_candidate_edited',
      entityType: 'ai_item',
      entityId: candidate.id,
      entityName: candidate.candidateId,
      metadata: {
        originalText: candidate.originalText,
        finalText: newText,
      },
    });

    return { success: true, data: candidate, statusCode: 200 };
  },

  /**
   * Reject an AI candidate item
   * Preserves the candidate in generation history marked as Rejected
   */
  rejectCandidate(
    candidateId: string,
    projectId: string,
    userId: string,
    userName: string,
    rejectionReason?: string
  ): ServiceResult<AIGeneratedItem> {
    const pRes = projectService.getProject(projectId, userId);
    if (!pRes.success) {
      return { success: false, error: pRes.error, statusCode: pRes.statusCode };
    }

    const candidates = this._getAllCandidates();
    const index = candidates.findIndex((c) => c.id === candidateId);
    if (index === -1) {
      return { success: false, error: 'Candidate not found.', statusCode: 404 };
    }

    const candidate = candidates[index];
    candidate.status = 'Rejected';
    candidates[index] = candidate;
    this._saveCandidates(candidates);

    // Update parent generation status if all rejected
    const generations = this._getAllGenerations();
    const gIndex = generations.findIndex((g) => g.id === candidate.generationId);
    if (gIndex !== -1) {
      const genCandidates = candidates.filter((c) => c.generationId === candidate.generationId);
      const allRejected = genCandidates.every((c) => c.status === 'Rejected');
      if (allRejected) {
        generations[gIndex].status = 'Rejected';
        this._saveGenerations(generations);
      }
    }

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'ai_candidate_rejected',
      entityType: 'ai_item',
      entityId: candidate.id,
      entityName: candidate.candidateId,
      metadata: {
        reason: rejectionReason || 'Rejected by researcher',
      },
    });

    return { success: true, data: candidate, statusCode: 200 };
  },

  /**
   * Batch accept multiple selected candidates
   */
  batchAcceptCandidates(
    candidateIds: string[],
    instrumentId: string,
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<{ acceptedCount: number; items: InstrumentItem[] }> {
    const acceptedItems: InstrumentItem[] = [];

    for (const cId of candidateIds) {
      const res = this.acceptCandidate(cId, instrumentId, projectId, userId, userName);
      if (res.success && res.data) {
        acceptedItems.push(res.data.item);
      }
    }

    if (acceptedItems.length > 0) {
      auditService.logAction({
        userId,
        userName,
        projectId,
        action: 'ai_candidates_batch_accepted',
        entityType: 'ai_item',
        entityId: instrumentId,
        entityName: `Batch (${acceptedItems.length} items)`,
        metadata: {
          count: acceptedItems.length,
          itemCodes: acceptedItems.map((i) => i.itemCode),
        },
      });
    }

    return {
      success: true,
      data: { acceptedCount: acceptedItems.length, items: acceptedItems },
      statusCode: 200,
    };
  },

  /**
   * Batch reject candidates
   */
  batchRejectCandidates(
    candidateIds: string[],
    projectId: string,
    userId: string,
    userName: string
  ): ServiceResult<number> {
    let count = 0;
    for (const cId of candidateIds) {
      const res = this.rejectCandidate(cId, projectId, userId, userName);
      if (res.success) count++;
    }
    return { success: true, data: count, statusCode: 200 };
  },

  /**
   * Calculate indicator coverage for a variable within an instrument
   */
  getIndicatorCoverage(
    instrumentId: string,
    variableId: string,
    projectId: string,
    userId: string
  ): ServiceResult<{
    totalIndicators: number;
    coveredIndicators: number;
    coveragePercent: number;
    details: {
      dimensionId: string;
      dimensionName: string;
      indicatorId: string;
      indicatorCode: string;
      indicatorName: string;
      itemCount: number;
    }[];
  }> {
    const instRes = instrumentService.getInstrument(instrumentId, projectId, userId);
    if (!instRes.success || !instRes.data) {
      return { success: false, error: 'Instrument not found.', statusCode: 404 };
    }
    const instrument = instRes.data;

    const varsRes = variableService.getVariables(projectId, userId);
    if (!varsRes.success || !varsRes.data) {
      return { success: false, error: 'Failed to fetch variables.', statusCode: 500 };
    }
    const variable = varsRes.data.find((v) => v.id === variableId);
    if (!variable) {
      return { success: false, error: 'Variable not found.', statusCode: 404 };
    }

    const items = instrument.items || [];
    const details: {
      dimensionId: string;
      dimensionName: string;
      indicatorId: string;
      indicatorCode: string;
      indicatorName: string;
      itemCount: number;
    }[] = [];

    let totalIndicators = 0;
    let coveredIndicators = 0;

    for (const dim of variable.dimensions) {
      for (const ind of dim.indicators) {
        totalIndicators++;
        const count = items.filter((it) => it.indicatorId === ind.id).length;
        if (count > 0) coveredIndicators++;
        details.push({
          dimensionId: dim.id,
          dimensionName: dim.name,
          indicatorId: ind.id,
          indicatorCode: ind.code,
          indicatorName: ind.name,
          itemCount: count,
        });
      }
    }

    const coveragePercent =
      totalIndicators > 0 ? Math.round((coveredIndicators / totalIndicators) * 100) : 0;

    return {
      success: true,
      data: {
        totalIndicators,
        coveredIndicators,
        coveragePercent,
        details,
      },
      statusCode: 200,
    };
  },
};
