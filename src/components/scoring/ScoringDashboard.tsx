import React, { useState, useEffect } from 'react';
import {
  Calculator,
  Play,
  FileSpreadsheet,
  BookOpen,
  History,
  Download,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  Sparkles,
  Plus,
  Trash2,
  Edit2,
  Search,
  Eye,
  ArrowRight,
  RefreshCw,
  HelpCircle,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import {
  ProcessedDataset,
  ProcessingRun,
  ScoredDataset,
  ScoredRecord,
  ScoringPrerequisites,
  ScoringPreviewRow,
  ScoringRule,
  ScoringRun,
  Variable,
} from '../../types';
import { processingService } from '../../services/processingService';
import { projectService } from '../../services/projectService';
import { scoringService } from '../../services/scoringService';
import { variableService } from '../../services/variableService';
import { RuleBuilderModal } from './RuleBuilderModal';
import { ScoreProvenanceModal } from './ScoreProvenanceModal';

interface ScoringDashboardProps {
  projectId: string;
  onNavigateToStage: (stage: 'setup' | 'variables' | 'instruments' | 'questionnaire' | 'collection' | 'processing' | 'scoring' | 'audit') => void;
}

export const ScoringDashboard: React.FC<ScoringDashboardProps> = ({
  projectId,
  onNavigateToStage,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'rules' | 'dataset' | 'codebook' | 'history'>('rules');

  // Processing Runs & Selection
  const [processingRuns, setProcessingRuns] = useState<ProcessingRun[]>([]);
  const [selectedProcessingRunId, setSelectedProcessingRunId] = useState<string>('');
  const [variables, setVariables] = useState<Variable[]>([]);

  // Scoring Rules
  const [rules, setRules] = useState<ScoringRule[]>([]);
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ScoringRule | null>(null);

  // Scoring Execution & Runs
  const [scoringRuns, setScoringRuns] = useState<ScoringRun[]>([]);
  const [activeScoringRun, setActiveScoringRun] = useState<ScoringRun | null>(null);
  const [activeScoredDataset, setActiveScoredDataset] = useState<ScoredDataset | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  // Prerequisites & Previews
  const [prerequisites, setPrerequisites] = useState<ScoringPrerequisites | null>(null);
  const [previewRows, setPreviewRows] = useState<ScoringPreviewRow[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Lineage / Provenance Inspector
  const [inspectedScoredRecord, setInspectedScoredRecord] = useState<ScoredRecord | null>(null);
  const [isProvenanceModalOpen, setIsProvenanceModalOpen] = useState(false);

  // Table filtering & search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'valid' | 'incomplete' | 'flagged'>('all');

  const loadData = () => {
    if (!currentUser) return;
    setLoading(true);

    // 1. Load project variables
    const vRes = variableService.getVariables(projectId, currentUser.id);
    if (vRes.success && vRes.data) {
      setVariables(vRes.data);
    }

    // 2. Load completed processing runs
    const pRunsRes = processingService.getRunsByProject(projectId, currentUser.id);
    const pRuns = pRunsRes.success && pRunsRes.data ? pRunsRes.data : [];
    setProcessingRuns(pRuns);

    let currentPRunId = selectedProcessingRunId;
    if (!currentPRunId && pRuns.length > 0) {
      const completedRun = pRuns.find(r => r.status === 'Completed') || pRuns[0];
      currentPRunId = completedRun.id;
      setSelectedProcessingRunId(currentPRunId);
    }

    // 3. Load scoring rules
    const rulesRes = scoringService.getRulesByProject(projectId, currentUser.id);
    const currentRules = rulesRes.success && rulesRes.data ? rulesRes.data : [];
    setRules(currentRules);

    // 4. Load past scoring runs & datasets
    const sRunsRes = scoringService.getRunsByProject(projectId, currentUser.id);
    const sRuns = sRunsRes.success && sRunsRes.data ? sRunsRes.data : [];
    setScoringRuns(sRuns);

    if (sRuns.length > 0) {
      const latestRun = sRuns[0];
      setActiveScoringRun(latestRun);
      const dsRes = scoringService.getDatasetByRunId(latestRun.id, currentUser.id);
      if (dsRes.success && dsRes.data) {
        setActiveScoredDataset(dsRes.data);
      }
    }

    // 5. Check prerequisites
    if (currentPRunId) {
      updatePrerequisitesAndPreview(currentPRunId, currentRules);
    }

    setLoading(false);
  };

  const updatePrerequisitesAndPreview = (pRunId: string, currentRules: ScoringRule[]) => {
    if (!currentUser) return;
    const prereqRes = scoringService.checkPrerequisites(projectId, pRunId, currentUser.id);
    if (prereqRes.success && prereqRes.data) {
      setPrerequisites(prereqRes.data);

      if (prereqRes.data.canScore && currentRules.length > 0) {
        setPreviewLoading(true);
        const prevRes = scoringService.generatePreview(projectId, pRunId, currentRules, 5, currentUser.id);
        if (prevRes.success && prevRes.data) {
          setPreviewRows(prevRes.data);
        }
        setPreviewLoading(false);
      } else {
        setPreviewRows([]);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, [projectId, currentUser?.id]);

  // When selected processing run changes
  const handleProcessingRunChange = (newPRunId: string) => {
    setSelectedProcessingRunId(newPRunId);
    updatePrerequisitesAndPreview(newPRunId, rules);
  };

  // Rule Save
  const handleSaveRule = (
    rulePayload: Omit<ScoringRule, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy'> & { id?: string }
  ) => {
    if (!currentUser) return;
    const res = scoringService.saveRule(rulePayload, currentUser.id, currentUser.name);
    if (res.success && res.data) {
      success('Scoring Rule Saved', `Rule "${res.data.targetName}" (${res.data.targetCode}) successfully saved.`);
      setIsRuleModalOpen(false);
      setEditingRule(null);

      // Reload rules
      const rRes = scoringService.getRulesByProject(projectId, currentUser.id);
      const updatedRules = rRes.success && rRes.data ? rRes.data : [];
      setRules(updatedRules);
      updatePrerequisitesAndPreview(selectedProcessingRunId, updatedRules);
    } else {
      error('Rule Save Failed', res.error || 'Failed to save scoring rule.');
    }
  };

  // Rule Delete
  const handleDeleteRule = (ruleId: string, ruleName: string) => {
    if (!currentUser) return;
    if (!window.confirm(`Are you sure you want to delete scoring rule "${ruleName}"?`)) {
      return;
    }

    const res = scoringService.deleteRule(ruleId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Rule Deleted', `Scoring rule "${ruleName}" has been removed.`);
      const updated = rules.filter(r => r.id !== ruleId);
      setRules(updated);
      updatePrerequisitesAndPreview(selectedProcessingRunId, updated);
    } else {
      error('Delete Failed', res.error || 'Failed to delete rule.');
    }
  };

  // Auto-Generate Standard Rules
  const handleAutoGenerateRules = () => {
    if (!currentUser || !selectedProcessingRunId) return;

    const res = scoringService.autoGenerateDefaultRules(
      projectId,
      selectedProcessingRunId,
      currentUser.id,
      currentUser.name
    );

    if (res.success && res.data) {
      const createdCount = res.data.length;
      if (createdCount > 0) {
        success(
          'Standard Rules Generated',
          `Created ${createdCount} standard aggregation rules based on project constructs and dimensions.`
        );
      } else {
        info('No New Rules Needed', 'All project constructs and dimensions already have scoring rules configured.');
      }

      // Reload rules
      const rRes = scoringService.getRulesByProject(projectId, currentUser.id);
      const updatedRules = rRes.success && rRes.data ? rRes.data : [];
      setRules(updatedRules);
      updatePrerequisitesAndPreview(selectedProcessingRunId, updatedRules);
    } else {
      error('Generation Failed', res.error || 'Failed to auto-generate rules.');
    }
  };

  // Execute Scoring Run
  const handleExecuteScoring = () => {
    if (!currentUser || !selectedProcessingRunId) return;

    if (!prerequisites?.canScore) {
      error('Cannot Execute Scoring', 'Please resolve prerequisite errors before executing scoring.');
      return;
    }

    setIsExecuting(true);

    try {
      const res = scoringService.runScoring({
        projectId,
        processingRunId: selectedProcessingRunId,
        rules,
        userId: currentUser.id,
        userName: currentUser.name,
        notes: `Stage 7 Scoring Run based on Processing Run #${selectedProcessingRunId.substring(selectedProcessingRunId.length - 6)}`,
      });

      if (res.success && res.data) {
        success(
          'Scoring Complete',
          `Successfully calculated scores for ${res.data.scoringRun.scoredRecordCount} participant records.`
        );
        setActiveScoringRun(res.data.scoringRun);
        setActiveScoredDataset(res.data.dataset);

        // Update runs history
        const sRunsRes = scoringService.getRunsByProject(projectId, currentUser.id);
        if (sRunsRes.success && sRunsRes.data) {
          setScoringRuns(sRunsRes.data);
        }

        // Switch to Scored Dataset view
        setActiveTab('dataset');
      } else {
        error('Scoring Execution Failed', res.error || 'Scoring engine encountered an error.');
      }
    } catch (err: any) {
      error('Execution Error', err?.message || 'An unexpected error occurred.');
    } finally {
      setIsExecuting(false);
    }
  };

  // Export Scored Dataset CSV
  const handleExportDatasetCsv = () => {
    if (!activeScoredDataset) {
      error('Export Error', 'No active scored dataset available for export.');
      return;
    }

    const csvContent = scoringService.generateScoredDatasetCsv(activeScoredDataset);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `scored_dataset_${projectId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('Export Successful', 'Scored dataset downloaded as CSV with full numeric precision.');
  };

  // Export Scoring Codebook CSV
  const handleExportCodebookCsv = () => {
    if (!activeScoringRun) {
      error('Export Error', 'No active scoring run rules snapshot available for export.');
      return;
    }

    const csvContent = scoringService.generateScoringCodebookCsv(activeScoringRun.rulesSnapshot);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `scoring_codebook_${projectId}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    success('Export Successful', 'Scoring codebook downloaded as CSV.');
  };

  // Filter scored records
  const filteredRecords = (activeScoredDataset?.records || []).filter(rec => {
    if (statusFilter !== 'all' && rec.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = rec.sourceSubmissionId.toLowerCase().includes(q);
      const matchPart = rec.participantIdentifier?.toLowerCase().includes(q);
      return matchId || matchPart;
    }
    return true;
  });

  const selectedRunObj = processingRuns.find(r => r.id === selectedProcessingRunId);

  return (
    <div className="space-y-6" id="stage-7-scoring-workspace">
      {/* 3-LAYER RESEARCH ARCHITECTURE BANNER */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="bg-slate-900 px-6 py-4 text-white flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                Quantitative Data Architecture
              </span>
              <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded">
                Stage 7: Scoring Engine
              </span>
            </div>
            <h2 className="text-lg font-bold text-white mt-1">
              Deterministic Aggregation &amp; Composite Construct Scoring
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Transform coded item values (Layer 2) into dimension and construct composite scores (Layer 3) with explicit missing value handling.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {activeScoredDataset && (
              <button
                type="button"
                onClick={handleExportDatasetCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" />
                <span>Export Scored CSV</span>
              </button>
            )}

            {activeScoringRun && (
              <button
                type="button"
                onClick={handleExportCodebookCsv}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition-colors shadow-2xs cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                <span>Export Codebook</span>
              </button>
            )}
          </div>
        </div>

        {/* 3-Layer Visual Indicator */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200 bg-slate-50/70 border-b border-slate-200">
          <div className="p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-900">Layer 1: Raw Responses</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                  IMMUTABLE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                SurveySubmissions stored untouched
              </p>
            </div>
          </div>

          <div className="p-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-900">Layer 2: Processed Data</span>
                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-100/70 px-1.5 py-0.2 rounded">
                  IMMUTABLE
                </span>
              </div>
              <p className="text-[11px] text-slate-500 truncate">
                Coded &amp; reverse-coded numeric items
              </p>
            </div>
          </div>

          <div className="p-3.5 flex items-center gap-3 bg-indigo-50/40">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 border border-indigo-300 flex items-center justify-center text-indigo-700 shrink-0">
              <Calculator className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-indigo-950">Layer 3: Scored Data</span>
                <span className="text-[9px] font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded">
                  ACTIVE STAGE
                </span>
              </div>
              <p className="text-[11px] text-indigo-900/70 truncate">
                Derived composite scores &amp; dimensions
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* TOP CONTROL BAR: Processing Run Selector & View Tabs */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Source Processing Run Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Source Processed Dataset (Layer 2)
            </label>
            {processingRuns.length === 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 font-medium">
                  No completed Processing Runs found.
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateToStage('processing')}
                  className="text-xs font-bold text-indigo-600 hover:underline"
                >
                  Run Stage 6 &rarr;
                </button>
              </div>
            ) : (
              <select
                value={selectedProcessingRunId}
                onChange={e => handleProcessingRunChange(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[260px]"
              >
                {processingRuns.map(pr => (
                  <option key={pr.id} value={pr.id}>
                    Run #{pr.id.substring(pr.id.length - 6)} ({pr.status}) - {pr.processedRecordCount} records - v{pr.rulesSnapshot.questionnaireVersionNumber}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selectedRunObj && (
            <div className="flex items-center gap-2 mt-4 sm:mt-4">
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                Items snapshot: <strong className="text-slate-900">{selectedRunObj.rulesSnapshot.items.length} items</strong>
              </span>
              <span className="text-[11px] bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-md border border-indigo-200 font-medium">
                Rules: <strong className="text-indigo-950">{rules.length} defined</strong>
              </span>
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'rules'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>1. Rules &amp; Execution</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dataset')}
            disabled={!activeScoredDataset}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              !activeScoredDataset
                ? 'text-slate-400 cursor-not-allowed opacity-60'
                : activeTab === 'dataset'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>2. Scored Dataset</span>
            {activeScoredDataset && (
              <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full font-bold">
                {activeScoredDataset.recordCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('codebook')}
            disabled={!activeScoringRun}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              !activeScoringRun
                ? 'text-slate-400 cursor-not-allowed opacity-60'
                : activeTab === 'codebook'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>3. Scoring Codebook</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'history'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Runs ({scoringRuns.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: RULES & EXECUTION WORKSPACE */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Prerequisites Checklist Card */}
          {prerequisites && (
            <div
              className={`p-4 rounded-xl border ${
                prerequisites.canScore
                  ? 'bg-emerald-50/50 border-emerald-200'
                  : 'bg-amber-50/50 border-amber-200'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {prerequisites.canScore ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    )}
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      {prerequisites.canScore
                        ? 'Scoring Engine Ready to Execute'
                        : 'Scoring Prerequisites Action Required'}
                    </h4>
                  </div>
                  <p className="text-xs text-slate-600">
                    {prerequisites.canScore
                      ? `All validation checks passed. ${prerequisites.processedRecordCount} processed records are ready for scoring with ${prerequisites.rulesConfiguredCount} defined rules.`
                      : prerequisites.errorMessages[0] || 'Please complete prerequisite setup before scoring.'}
                  </p>
                </div>

                {prerequisites.canScore && (
                  <button
                    type="button"
                    onClick={handleExecuteScoring}
                    disabled={isExecuting}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-all shadow-xs cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    <Play className="w-4 h-4 fill-white" />
                    <span>{isExecuting ? 'Scoring Records...' : 'Execute Scoring Run'}</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scoring Rule Management Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/70">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Configured Scoring Rules</h3>
                <p className="text-xs text-slate-500">
                  Explicit formulas for computing dimension averages and construct composite scores.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleAutoGenerateRules}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-2xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Auto-Generate Standard Rules</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(null);
                    setIsRuleModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Scoring Rule</span>
                </button>
              </div>
            </div>

            {/* Rules Table */}
            {rules.length === 0 ? (
              <div className="p-8 text-center">
                <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-bold text-slate-700">No Scoring Rules Defined Yet</p>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  Click &ldquo;Auto-Generate Standard Rules&rdquo; to quickly create MEAN aggregation rules for all dimensions and constructs, or add custom rules individually.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-3">Target Code</th>
                      <th className="px-4 py-3">Target Name</th>
                      <th className="px-4 py-3">Construct Level</th>
                      <th className="px-4 py-3">Method</th>
                      <th className="px-4 py-3">Sources</th>
                      <th className="px-4 py-3">Missing Policy</th>
                      <th className="px-4 py-3">Formula Summary</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rules.map(rule => (
                      <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                          {rule.targetCode}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {rule.targetName}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              rule.targetType === 'Dimension'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : 'bg-purple-50 text-purple-700 border border-purple-200'
                            }`}
                          >
                            {rule.targetType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                            {rule.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600 font-mono">
                          {rule.sourceType === 'dimensions'
                            ? rule.sourceDimensionCodes?.join(', ') || 'N/A'
                            : rule.sourceItemCodes?.join(', ') || 'N/A'}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-600">
                          <span className="capitalize">
                            {rule.missingValuePolicy.replace(/_/g, ' ')}
                          </span>
                          {rule.missingValuePolicy === 'minimum_required_items' && (
                            <span className="ml-1 font-bold text-slate-800">
                              (&ge;{rule.minimumRequiredItems})
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-slate-500 max-w-xs truncate" title={scoringService.generateRuleSummary(rule)}>
                          {scoringService.generateRuleSummary(rule)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingRule(rule);
                                setIsRuleModalOpen(true);
                              }}
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-slate-100 transition-colors"
                              title="Edit Rule"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRule(rule.id, rule.targetName)}
                              className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-slate-100 transition-colors"
                              title="Delete Rule"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live 5-Record Interactive Calculation Preview */}
          {previewRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                    Interactive Calculation Preview (First 5 Sample Records)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Live verification of calculated scores based on current rules before running the full dataset.
                  </p>
                </div>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                  Deterministic Live Preview
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                      <th className="px-4 py-2.5">Participant ID</th>
                      {rules.map(r => (
                        <th key={r.targetCode} className="px-4 py-2.5">
                          {r.targetCode}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {previewRows.map((row, idx) => (
                      <tr key={row.submissionId} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-mono text-slate-600 font-semibold">
                          {row.participantIdentifier || `Record #${idx + 1}`}
                        </td>
                        {rules.map(r => {
                          const res = row.calculatedScores[r.targetCode];
                          if (!res) return <td key={r.targetCode} className="px-4 py-2.5 text-slate-300">-</td>;
                          return (
                            <td key={r.targetCode} className="px-4 py-2.5">
                              {res.score !== null ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono font-bold text-indigo-700">
                                    {typeof res.score === 'number' ? res.score.toFixed(3) : res.score}
                                  </span>
                                  <span className="text-[10px] text-slate-400">
                                    ({res.validCount}/{res.totalCount})
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                  Missing
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCORED DATASET VIEWER */}
      {activeTab === 'dataset' && activeScoredDataset && (
        <div className="space-y-4">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Total Scored Records</span>
              <p className="text-xl font-bold text-slate-900 mt-1">{activeScoredDataset.recordCount}</p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-600">Complete Cases</span>
              <p className="text-xl font-bold text-emerald-700 mt-1">
                {activeScoredDataset.records.filter(r => r.status === 'valid').length}
              </p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600">Incomplete Cases</span>
              <p className="text-xl font-bold text-amber-700 mt-1">
                {activeScoredDataset.records.filter(r => r.status === 'incomplete').length}
              </p>
            </div>

            <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold tracking-wider text-red-600">Flagged Cases</span>
              <p className="text-xl font-bold text-red-700 mt-1">
                {activeScoredDataset.records.filter(r => r.status === 'flagged').length}
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search participant ID..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span className="text-xs font-bold text-slate-500">Filter:</span>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-xs text-slate-800 font-semibold"
              >
                <option value="all">All Records</option>
                <option value="valid">Valid (Complete)</option>
                <option value="incomplete">Incomplete</option>
                <option value="flagged">Flagged</option>
              </select>
            </div>
          </div>

          {/* Scored Dataset Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-3">Participant ID</th>
                    <th className="px-4 py-3">Submitted At</th>
                    <th className="px-4 py-3">Status</th>
                    {activeScoredDataset.columns.map(col => (
                      <th key={col.targetCode} className="px-4 py-3">
                        {col.targetCode}
                        <div className="text-[9px] font-normal text-slate-400 capitalize">{col.method}</div>
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right">Provenance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRecords.map(rec => (
                    <tr key={rec.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-slate-800">
                        {rec.participantIdentifier || rec.sourceSubmissionId.substring(0, 10)}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-[11px]">
                        {new Date(rec.submittedAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            rec.status === 'valid'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : rec.status === 'incomplete'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {rec.status}
                        </span>
                      </td>
                      {activeScoredDataset.columns.map(col => {
                        const val = rec.scores[col.targetCode];
                        return (
                          <td key={col.targetCode} className="px-4 py-3 font-mono">
                            {val !== null && val !== undefined ? (
                              <span className="font-bold text-slate-900">
                                {typeof val === 'number' ? val.toFixed(4) : val}
                              </span>
                            ) : (
                              <span className="text-[11px] text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                                null
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setInspectedScoredRecord(rec);
                            setIsProvenanceModalOpen(true);
                          }}
                          className="flex items-center gap-1 ml-auto px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Inspect Lineage</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SCORING CODEBOOK */}
      {activeTab === 'codebook' && activeScoringRun && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Scoring Codebook &amp; Mathematical Formulas</h3>
              <p className="text-xs text-slate-500">
                Formal measurement equations captured in immutable snapshot #{activeScoringRun.rulesSnapshot.snapshotId.substring(8)}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleExportCodebookCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 shadow-2xs"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              <span>Export Codebook CSV</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <th className="px-4 py-3">Target Code</th>
                  <th className="px-4 py-3">Target Name</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Method</th>
                  <th className="px-4 py-3">Source Identifiers</th>
                  <th className="px-4 py-3">Missing Policy</th>
                  <th className="px-4 py-3">Expected Range</th>
                  <th className="px-4 py-3">Formal Formula Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeScoringRun.rulesSnapshot.rules.map(rule => (
                  <tr key={rule.ruleId} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                      {rule.targetCode}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {rule.targetName}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                        {rule.targetType}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono font-bold text-slate-800">
                      {rule.method}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {rule.sourceType === 'dimensions'
                        ? rule.sourceDimensionCodes?.join(', ')
                        : rule.sourceItemCodes?.join(', ')}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-600 capitalize">
                      {rule.missingValuePolicy.replace(/_/g, ' ')}
                      {rule.missingValuePolicy === 'minimum_required_items' && ` (min: ${rule.minimumRequiredItems})`}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                      {rule.expectedRange ? `[${rule.expectedRange.min}, ${rule.expectedRange.max}]` : 'Free'}
                    </td>
                    <td className="px-4 py-3 text-[11px] text-slate-700">
                      {scoringService.generateRuleSummary(rule)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: SCORING RUNS HISTORY */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 bg-slate-50">
            <h3 className="text-sm font-bold text-slate-900">Historical Scoring Runs</h3>
            <p className="text-xs text-slate-500">
              Immutable historical runs preserved with their frozen rules snapshot and output records.
            </p>
          </div>

          {scoringRuns.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No historical scoring runs executed yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                    <th className="px-4 py-3">Run ID</th>
                    <th className="px-4 py-3">Executed At</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Source Processing Run</th>
                    <th className="px-4 py-3">Scored Records</th>
                    <th className="px-4 py-3">Rules Count</th>
                    <th className="px-4 py-3">Warnings / Errors</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scoringRuns.map(run => (
                    <tr key={run.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-indigo-700">
                        #{run.id.substring(run.id.length - 6)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 text-[11px]">
                        {new Date(run.createdAt).toLocaleString()}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            run.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : run.status === 'Running'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {run.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        #{run.processingRunId.substring(run.processingRunId.length - 6)}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">
                        {run.scoredRecordCount}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {run.rulesSnapshot.rules.length} rules
                      </td>
                      <td className="px-4 py-3 text-[11px]">
                        {run.warningCount > 0 && (
                          <span className="text-amber-700 mr-2 font-semibold">
                            {run.warningCount} warnings
                          </span>
                        )}
                        {run.errorCount > 0 ? (
                          <span className="text-red-700 font-semibold">
                            {run.errorCount} errors
                          </span>
                        ) : (
                          <span className="text-emerald-700 font-semibold">0 errors</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveScoringRun(run);
                            if (currentUser) {
                              const dsRes = scoringService.getDatasetByRunId(run.id, currentUser.id);
                              if (dsRes.success && dsRes.data) {
                                setActiveScoredDataset(dsRes.data);
                              }
                            }
                            setActiveTab('dataset');
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          View Scored Dataset
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rule Builder Modal */}
      <RuleBuilderModal
        isOpen={isRuleModalOpen}
        onClose={() => {
          setIsRuleModalOpen(false);
          setEditingRule(null);
        }}
        onSave={handleSaveRule}
        initialRule={editingRule}
        projectId={projectId}
        variables={variables}
        processingRun={selectedRunObj || null}
      />

      {/* Score Provenance & Multi-Layer Lineage Inspector Modal */}
      <ScoreProvenanceModal
        isOpen={isProvenanceModalOpen}
        onClose={() => {
          setIsProvenanceModalOpen(false);
          setInspectedScoredRecord(null);
        }}
        scoredRecord={inspectedScoredRecord}
        processedRecord={null}
        rules={rules}
      />
    </div>
  );
};
