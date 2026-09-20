import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  X,
  AlertCircle,
  Loader2,
  CheckCircle2,
  History,
  Target,
  Globe2,
  Sliders,
  RotateCcw,
  ShieldCheck,
  ChevronRight,
  ListFilter,
  CheckCheck,
} from 'lucide-react';
import {
  ResearchProject,
  Instrument,
  Variable,
  Dimension,
  Indicator,
  ResponseScale,
  AIGeneration,
  AIGeneratedItem,
} from '../../types';
import { aiService } from '../../services/aiService';
import { variableService } from '../../services/variableService';
import { scaleService } from '../../services/scaleService';
import { CandidateItemCard } from './CandidateItemCard';

interface AIGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  project: ResearchProject;
  instrument: Instrument;
  userId: string;
  userName: string;
  initialIndicatorId?: string;
  onItemsAddedToInstrument: () => void;
}

export const AIGeneratorModal: React.FC<AIGeneratorModalProps> = ({
  isOpen,
  onClose,
  project,
  instrument,
  userId,
  userName,
  initialIndicatorId,
  onItemsAddedToInstrument,
}) => {
  // Research Context State
  const [variables, setVariables] = useState<Variable[]>([]);
  const [scales, setScales] = useState<ResponseScale[]>([]);
  const [selectedVariableId, setSelectedVariableId] = useState<string>('');
  const [selectedDimensionId, setSelectedDimensionId] = useState<string>('');
  const [selectedIndicatorId, setSelectedIndicatorId] = useState<string>('');
  const [selectedScaleId, setSelectedScaleId] = useState<string>('');
  const [numberOfItems, setNumberOfItems] = useState<number>(4);
  const [language, setLanguage] = useState<'English' | 'Indonesian'>('English');
  const [targetPopulation, setTargetPopulation] = useState<string>('');
  const [additionalInstructions, setAdditionalInstructions] = useState<string>('');

  // Generation & Candidates State
  const [generations, setGenerations] = useState<AIGeneration[]>([]);
  const [activeGeneration, setActiveGeneration] = useState<AIGeneration | null>(null);
  const [candidates, setCandidates] = useState<AIGeneratedItem[]>([]);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // Coverage State
  const [coverageData, setCoverageData] = useState<{
    totalIndicators: number;
    coveredIndicators: number;
    coveragePercent: number;
    details: any[];
  } | null>(null);

  // UI State
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  // Load project variables, scales, and generation history on open
  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccessMessage(null);

    // Fetch variables
    const varsRes = variableService.getVariables(project.id, userId);
    if (varsRes.success && varsRes.data) {
      // Only include variables mapped to this instrument if configured
      const relevant =
        instrument.variableIds && instrument.variableIds.length > 0
          ? varsRes.data.filter((v) => instrument.variableIds.includes(v.id))
          : varsRes.data;
      setVariables(relevant);

      // Default to first variable
      if (relevant.length > 0 && !selectedVariableId) {
        setSelectedVariableId(relevant[0].id);
      }
    }

    // Fetch response scales
    const scalesRes = scaleService.getScales(project.id, userId);
    if (scalesRes.success && scalesRes.data) {
      setScales(scalesRes.data);
      if (scalesRes.data.length > 0 && !selectedScaleId) {
        setSelectedScaleId(scalesRes.data[0].id);
      }
    }

    // Default target population from project
    setTargetPopulation(
      project.population || project.sampleDescription || 'Undergraduate University Students'
    );

    // Fetch generation history
    loadGenerations();
  }, [isOpen, project.id, instrument.id, userId]);

  // Update dimension and indicator options when variable changes
  useEffect(() => {
    if (!selectedVariableId) return;

    const currentVar = variables.find((v) => v.id === selectedVariableId);
    if (currentVar) {
      if (currentVar.dimensions.length > 0) {
        setSelectedDimensionId(currentVar.dimensions[0].id);
        if (currentVar.dimensions[0].indicators.length > 0) {
          setSelectedIndicatorId(currentVar.dimensions[0].indicators[0].id);
        } else {
          setSelectedIndicatorId('');
        }
      } else {
        setSelectedDimensionId('');
        setSelectedIndicatorId('');
      }

      // Refresh indicator coverage for this variable
      loadCoverage(selectedVariableId);
    }
  }, [selectedVariableId, variables]);

  // Handle dimension change
  const handleDimensionChange = (dimId: string) => {
    setSelectedDimensionId(dimId);
    const currentVar = variables.find((v) => v.id === selectedVariableId);
    const dim = currentVar?.dimensions.find((d) => d.id === dimId);
    if (dim && dim.indicators.length > 0) {
      setSelectedIndicatorId(dim.indicators[0].id);
    } else {
      setSelectedIndicatorId('');
    }
  };

  // Preselect indicator if requested
  useEffect(() => {
    if (initialIndicatorId && variables.length > 0) {
      for (const v of variables) {
        for (const d of v.dimensions) {
          const ind = d.indicators.find((i) => i.id === initialIndicatorId);
          if (ind) {
            setSelectedVariableId(v.id);
            setSelectedDimensionId(d.id);
            setSelectedIndicatorId(ind.id);
            break;
          }
        }
      }
    }
  }, [initialIndicatorId, variables]);

  const loadGenerations = () => {
    const res = aiService.getGenerations(instrument.id, project.id, userId);
    if (res.success && res.data) {
      setGenerations(res.data);
      if (res.data.length > 0 && !activeGeneration) {
        setActiveGeneration(res.data[0]);
        loadCandidatesForGeneration(res.data[0].id);
      }
    }
  };

  const loadCandidatesForGeneration = (generationId: string) => {
    const res = aiService.getCandidates(generationId, project.id, userId);
    if (res.success && res.data) {
      setCandidates(res.data);
      setSelectedCandidateIds([]);
    }
  };

  const loadCoverage = (varId: string) => {
    const res = aiService.getIndicatorCoverage(instrument.id, varId, project.id, userId);
    if (res.success && res.data) {
      setCoverageData(res.data);
    }
  };

  // Trigger Generation
  const handleGenerate = async () => {
    if (!selectedVariableId || !selectedIndicatorId) {
      setError('Please select both a Variable and an Indicator to ground generation.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await aiService.generateCandidates(
        {
          projectId: project.id,
          instrumentId: instrument.id,
          variableId: selectedVariableId,
          dimensionId: selectedDimensionId || undefined,
          indicatorId: selectedIndicatorId,
          responseScaleId: selectedScaleId || undefined,
          numberOfItems,
          language,
          targetPopulation,
          additionalInstructions,
        },
        userId,
        userName
      );

      if (!res.success || !res.data) {
        setError(res.error || 'Failed to generate candidates.');
      } else {
        setActiveGeneration(res.data.generation);
        setCandidates(res.data.candidates);
        setSelectedCandidateIds([]);
        loadGenerations();
        setSuccessMessage(
          `Successfully generated ${res.data.candidates.length} candidate items via ${
            res.data.generation.isDemoMode ? 'Demo Generator' : 'Gemini 3.8 Flash'
          }.`
        );
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during generation.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Candidate Actions
  const handleAccept = (candidateId: string) => {
    const res = aiService.acceptCandidate(candidateId, instrument.id, project.id, userId, userName);
    if (!res.success || !res.data) {
      setError(res.error || 'Failed to accept candidate.');
      return;
    }

    // Refresh candidates
    if (activeGeneration) {
      loadCandidatesForGeneration(activeGeneration.id);
    }
    loadCoverage(selectedVariableId);
    onItemsAddedToInstrument();
    setSuccessMessage(`Item ${res.data.item.itemCode} accepted and added to instrument as draft.`);
  };

  const handleEdit = (candidateId: string, newText: string, reverseCoded: boolean) => {
    const res = aiService.editCandidate(candidateId, project.id, userId, userName, {
      questionText: newText,
      reverseCoded,
    });
    if (!res.success) {
      setError(res.error || 'Failed to save candidate edits.');
      return;
    }

    if (activeGeneration) {
      loadCandidatesForGeneration(activeGeneration.id);
    }
  };

  const handleReject = (candidateId: string) => {
    const res = aiService.rejectCandidate(candidateId, project.id, userId, userName);
    if (!res.success) {
      setError(res.error || 'Failed to reject candidate.');
      return;
    }

    if (activeGeneration) {
      loadCandidatesForGeneration(activeGeneration.id);
    }
  };

  // Batch actions
  const handleToggleSelect = (candidateId: string) => {
    setSelectedCandidateIds((prev) =>
      prev.includes(candidateId) ? prev.filter((id) => id !== candidateId) : [...prev, candidateId]
    );
  };

  const handleSelectAll = () => {
    const actionable = candidates
      .filter((c) => c.status !== 'AddedToInstrument' && c.status !== 'Rejected')
      .map((c) => c.id);
    setSelectedCandidateIds(actionable);
  };

  const handleDeselectAll = () => {
    setSelectedCandidateIds([]);
  };

  const handleBatchAccept = () => {
    if (selectedCandidateIds.length === 0) return;

    const res = aiService.batchAcceptCandidates(
      selectedCandidateIds,
      instrument.id,
      project.id,
      userId,
      userName
    );

    if (!res.success || !res.data) {
      setError(res.error || 'Failed to batch accept candidates.');
      return;
    }

    setShowBatchConfirm(false);
    setSelectedCandidateIds([]);
    if (activeGeneration) {
      loadCandidatesForGeneration(activeGeneration.id);
    }
    loadCoverage(selectedVariableId);
    onItemsAddedToInstrument();
    setSuccessMessage(`Successfully accepted ${res.data.acceptedCount} items into instrument.`);
  };

  if (!isOpen) return null;

  const currentVariable = variables.find((v) => v.id === selectedVariableId);
  const currentDimension = currentVariable?.dimensions.find((d) => d.id === selectedDimensionId);
  const currentIndicator = currentDimension?.indicators.find((i) => i.id === selectedIndicatorId);
  const currentScale = scales.find((s) => s.id === selectedScaleId);

  const pendingCandidates = candidates.filter(
    (c) => c.status !== 'AddedToInstrument' && c.status !== 'Rejected'
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div
        id="ai-generator-modal-container"
        className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900">
                  AI Questionnaire Generator
                </h2>
                <span className="px-2 py-0.5 rounded text-xs font-semibold bg-indigo-100 text-indigo-800">
                  Phase 3
                </span>
                <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700">
                  Target: {instrument.code} ({instrument.name})
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Grounded psychometric generation: constructs &rarr; dimensions &rarr; indicators &rarr; candidate items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="px-6 py-2.5 bg-red-50 border-b border-red-200 flex items-center justify-between text-xs text-red-700 shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-800 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {successMessage && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between text-xs text-emerald-700 shrink-0">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
              <span>{successMessage}</span>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-500 hover:text-emerald-800 font-semibold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* 3-Column Structured Layout */}
        <div className="flex-1 grid grid-cols-12 overflow-hidden">
          {/* ======================================================== */}
          {/* COLUMN 1: RESEARCH STRUCTURE & GENERATION CONTROLS (3 cols) */}
          {/* ======================================================== */}
          <div className="col-span-12 lg:col-span-3 border-r border-slate-200 p-5 overflow-y-auto bg-slate-50/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Target className="w-3.5 h-3.5 text-indigo-600" />
                Measurement Context
              </h3>
            </div>

            {/* Variable Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Research Variable *
              </label>
              <select
                id="ai-select-variable"
                value={selectedVariableId}
                onChange={(e) => setSelectedVariableId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-1 focus:ring-indigo-500"
              >
                {variables.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.code} - {v.name} ({v.variableType})
                  </option>
                ))}
              </select>
              {currentVariable?.conceptualDefinition && (
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2 italic">
                  "{currentVariable.conceptualDefinition}"
                </p>
              )}
            </div>

            {/* Dimension Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dimension
              </label>
              {currentVariable && currentVariable.dimensions.length > 0 ? (
                <select
                  id="ai-select-dimension"
                  value={selectedDimensionId}
                  onChange={(e) => handleDimensionChange(e.target.value)}
                  className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  {currentVariable.dimensions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.code} - {d.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-slate-400 italic">No dimensions defined.</p>
              )}
            </div>

            {/* Indicator Selection (Grounding Core) */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Indicator to Operationalize *
              </label>
              {currentDimension && currentDimension.indicators.length > 0 ? (
                <select
                  id="ai-select-indicator"
                  value={selectedIndicatorId}
                  onChange={(e) => setSelectedIndicatorId(e.target.value)}
                  className="w-full text-xs border border-indigo-300 bg-white rounded-md p-2 font-medium text-indigo-900 focus:ring-1 focus:ring-indigo-500"
                >
                  {currentDimension.indicators.map((ind) => (
                    <option key={ind.id} value={ind.id}>
                      {ind.code} - {ind.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-200">
                  No indicators in this dimension. Add an indicator in the research model first.
                </p>
              )}

              {currentIndicator && (
                <div className="mt-1.5 p-2 bg-indigo-50/60 border border-indigo-100 rounded text-[11px] text-indigo-950">
                  <span className="font-semibold">Definition: </span>
                  {currentIndicator.definition || 'No explicit definition provided.'}
                </div>
              )}
            </div>

            {/* Response Scale Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Response Scale
              </label>
              <select
                id="ai-select-scale"
                value={selectedScaleId}
                onChange={(e) => setSelectedScaleId(e.target.value)}
                className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-1 focus:ring-indigo-500"
              >
                {scales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.scaleType}, {s.options.length}-point)
                  </option>
                ))}
              </select>
              {currentScale && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Options: {currentScale.options.map((o) => `${o.value}=${o.label}`).join(', ')}
                </p>
              )}
            </div>

            {/* Target Population */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Population
              </label>
              <input
                type="text"
                id="ai-input-population"
                value={targetPopulation}
                onChange={(e) => setTargetPopulation(e.target.value)}
                placeholder="e.g. University Undergraduate Students"
                className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Number of Items & Language */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                  <span>Count</span>
                  <span className="text-indigo-600 font-bold">{numberOfItems}</span>
                </label>
                <input
                  type="range"
                  id="ai-slider-count"
                  min={1}
                  max={8}
                  value={numberOfItems}
                  onChange={(e) => setNumberOfItems(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Language
                </label>
                <select
                  id="ai-select-language"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as 'English' | 'Indonesian')}
                  className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="English">English</option>
                  <option value="Indonesian">Indonesian (Bahasa)</option>
                </select>
              </div>
            </div>

            {/* Additional Researcher Instructions */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Researcher Prompt Directives (Optional)
              </label>
              <textarea
                id="ai-textarea-instructions"
                rows={2}
                value={additionalInstructions}
                onChange={(e) => setAdditionalInstructions(e.target.value)}
                placeholder="e.g. Emphasize digital smartphone use during study sessions..."
                className="w-full text-xs border border-slate-300 rounded-md p-2 bg-white focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            {/* Generate Action Button */}
            <button
              type="button"
              id="ai-generate-button"
              onClick={handleGenerate}
              disabled={isGenerating || !selectedIndicatorId}
              className="w-full py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing Items...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Candidate Items</span>
                </>
              )}
            </button>
          </div>

          {/* ======================================================== */}
          {/* COLUMN 2: GENERATED ITEMS STREAM & REVIEW (6 cols) */}
          {/* ======================================================== */}
          <div className="col-span-12 lg:col-span-6 border-r border-slate-200 flex flex-col overflow-hidden bg-white">
            {/* Stream Header */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Candidate Item Stream
                  </h3>
                  {activeGeneration && (
                    <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-200 text-slate-800">
                      v:{activeGeneration.promptVersion}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Review and approve candidates. Items are only draft until explicitly accepted.
                </p>
              </div>

              {activeGeneration && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded transition"
                    title="Generate another batch for this indicator without overwriting past candidates"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Regenerate
                  </button>
                </div>
              )}
            </div>

            {/* Batch Controls Bar (Visible when there are pending candidates) */}
            {pendingCandidates.length > 0 && (
              <div className="px-4 py-2 bg-indigo-50/50 border-b border-indigo-100 flex items-center justify-between text-xs shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={
                      selectedCandidateIds.length === pendingCandidates.length
                        ? handleDeselectAll
                        : handleSelectAll
                    }
                    className="text-indigo-700 hover:text-indigo-900 font-semibold"
                  >
                    {selectedCandidateIds.length === pendingCandidates.length
                      ? 'Deselect All'
                      : 'Select All Pending'}
                  </button>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    {selectedCandidateIds.length} of {pendingCandidates.length} selected
                  </span>
                </div>

                {selectedCandidateIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowBatchConfirm(true)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-600 text-white rounded text-xs font-semibold hover:bg-emerald-700 transition"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Accept Selected ({selectedCandidateIds.length})
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Candidate Cards Stream */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {isGenerating ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-500 space-y-3">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-800">
                      Grounded Item Synthesis in Progress
                    </p>
                    <p className="text-xs text-slate-500">
                      Querying psychometric engine for indicator: {currentIndicator?.name || 'Indicator'}
                    </p>
                  </div>
                </div>
              ) : candidates.length > 0 ? (
                candidates.map((candidate) => (
                  <CandidateItemCard
                    key={candidate.id}
                    candidate={candidate}
                    isSelected={selectedCandidateIds.includes(candidate.id)}
                    scaleLabel={currentScale?.name}
                    onSelectToggle={() => handleToggleSelect(candidate.id)}
                    onAccept={handleAccept}
                    onEdit={handleEdit}
                    onReject={handleReject}
                  />
                ))
              ) : (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-slate-200 rounded-lg">
                  <Sparkles className="w-10 h-10 text-slate-300 mb-2" />
                  <h4 className="text-sm font-semibold text-slate-700">No Candidates Generated Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mt-1">
                    Select a Variable and Indicator in the left panel and click "Generate Candidate
                    Items" to run the structured questionnaire generator.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ======================================================== */}
          {/* COLUMN 3: COVERAGE & GENERATION AUDIT (3 cols) */}
          {/* ======================================================== */}
          <div className="col-span-12 lg:col-span-3 p-5 overflow-y-auto bg-slate-50/50 space-y-5">
            {/* Indicator Coverage Progress */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Indicator Coverage
                </h3>
                {coverageData && (
                  <span className="text-xs font-bold text-slate-800">
                    {coverageData.coveragePercent}%
                  </span>
                )}
              </div>

              {coverageData ? (
                <div>
                  <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                      style={{ width: `${coverageData.coveragePercent}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-500 mb-3 flex justify-between">
                    <span>
                      {coverageData.coveredIndicators} of {coverageData.totalIndicators} Indicators Covered
                    </span>
                    <span>{instrument.items?.length || 0} Total Items</span>
                  </div>

                  {/* Indicator Coverage List */}
                  <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                    {coverageData.details.map((item) => {
                      const isSelected = item.indicatorId === selectedIndicatorId;
                      return (
                        <div
                          key={item.indicatorId}
                          onClick={() => {
                            setSelectedDimensionId(item.dimensionId);
                            setSelectedIndicatorId(item.indicatorId);
                          }}
                          className={`p-2 rounded border text-xs cursor-pointer transition flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-100/70 border-indigo-300'
                              : item.itemCount > 0
                              ? 'bg-white border-slate-200 hover:border-slate-300'
                              : 'bg-amber-50/70 border-amber-200 hover:border-amber-300'
                          }`}
                        >
                          <div className="truncate pr-2">
                            <span className="font-mono font-semibold text-slate-700">
                              {item.indicatorCode}:{' '}
                            </span>
                            <span className="text-slate-900">{item.indicatorName}</span>
                          </div>

                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              item.itemCount > 0
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {item.itemCount} items
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-400">Loading coverage...</p>
              )}
            </div>

            {/* Generation History List */}
            <div className="pt-4 border-t border-slate-200">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 mb-2">
                <History className="w-3.5 h-3.5 text-indigo-600" />
                Generation Audit History
              </h3>

              {generations.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {generations.map((gen, idx) => {
                    const isActive = activeGeneration?.id === gen.id;
                    const dateStr = new Date(gen.generatedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={gen.id}
                        onClick={() => {
                          setActiveGeneration(gen);
                          loadCandidatesForGeneration(gen.id);
                        }}
                        className={`p-2.5 rounded border text-xs cursor-pointer transition ${
                          isActive
                            ? 'bg-indigo-50 border-indigo-300 shadow-xs'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-semibold text-slate-900">
                            Batch #{generations.length - idx}
                          </span>
                          <span className="text-[10px] text-slate-400">{dateStr}</span>
                        </div>

                        <div className="text-[11px] text-slate-600 truncate">
                          {gen.model} &bull; {gen.generationParameters.language}
                        </div>

                        <div className="mt-1 flex items-center justify-between">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              gen.status === 'Accepted'
                                ? 'bg-emerald-100 text-emerald-800'
                                : gen.status === 'Partially Accepted'
                                ? 'bg-indigo-100 text-indigo-800'
                                : gen.status === 'Rejected'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {gen.status}
                          </span>

                          <span className="text-[10px] text-slate-400">
                            v:{gen.promptVersion}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No previous generations recorded.</p>
              )}
            </div>

            {/* Scientific Psychometric Disclaimer Notice */}
            <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg text-[11px] text-slate-600 space-y-1">
              <div className="font-semibold text-slate-800 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                Scientific Integrity Rule
              </div>
              <p>
                AI item generation provides candidate operationalizations only. Empirical psychometric
                validity (construct, discriminant, and reliability) is established exclusively through
                formal data collection and statistical validation in subsequent phases.
              </p>
            </div>
          </div>
        </div>

        {/* Batch Accept Confirmation Dialog */}
        {showBatchConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4">
            <div className="bg-white rounded-lg p-5 max-w-md w-full shadow-xl border border-slate-200 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCheck className="w-4 h-4 text-emerald-600" />
                Confirm Batch Acceptance
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                You are about to accept{' '}
                <span className="font-bold text-slate-900">{selectedCandidateIds.length}</span>{' '}
                AI-generated candidate items into instrument{' '}
                <span className="font-bold text-slate-900">{instrument.code}</span> as draft items.
                Full provenance and original AI text will be preserved in the audit log.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchConfirm(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleBatchAccept}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs"
                >
                  Confirm & Add to Instrument
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
