import React, { useState, useEffect } from 'react';
import {
  Binary,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Eye,
  Info,
  Layers,
  ArrowRight,
  ShieldCheck,
  Search,
  ListFilter,
  History,
  FileCode,
  Sparkles,
  HelpCircle,
  Hash,
  Clock,
  BookOpen,
  Check,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { questionnaireService } from '../../services/questionnaireService';
import { submissionService } from '../../services/submissionService';
import { processingService } from '../../services/processingService';
import {
  Codebook,
  MissingValuePolicy,
  ProcessedDataset,
  ProcessedRecord,
  ProcessingPrerequisites,
  ProcessingPreviewRow,
  ProcessingRun,
  Questionnaire,
  QuestionnaireVersion,
  SurveySubmission,
} from '../../types';
import { Modal } from '../common/Modal';

interface DataProcessingDashboardProps {
  projectId: string;
  onNavigateToStage?: (stage: any) => void;
}

export const DataProcessingDashboard: React.FC<DataProcessingDashboardProps> = ({
  projectId,
  onNavigateToStage,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info, warning } = useToast();

  // Primary Data
  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);
  const [versions, setVersions] = useState<QuestionnaireVersion[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [processingRuns, setProcessingRuns] = useState<ProcessingRun[]>([]);
  const [activeRun, setActiveRun] = useState<ProcessingRun | null>(null);
  const [activeDataset, setActiveDataset] = useState<ProcessedDataset | null>(null);
  const [activeCodebook, setActiveCodebook] = useState<Codebook | null>(null);

  // Configuration & Preview
  const [missingPolicy, setMissingPolicy] = useState<MissingValuePolicy>('preserve_missing');
  const [userMissingCode, setUserMissingCode] = useState<string>('-99');
  const [runNotes, setRunNotes] = useState<string>('');
  const [prerequisites, setPrerequisites] = useState<ProcessingPrerequisites | null>(null);
  const [previewRows, setPreviewRows] = useState<ProcessingPreviewRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Active View Tab
  const [activeTab, setActiveTab] = useState<'run' | 'dataset' | 'codebook' | 'history'>('run');

  // Modals
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState<boolean>(false);
  const [inspectRecord, setInspectRecord] = useState<ProcessedRecord | null>(null);
  const [sourceRawSubmission, setSourceRawSubmission] = useState<SurveySubmission | null>(null);

  // Dataset Table Search & Filter
  const [datasetSearch, setDatasetSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Valid' | 'Flagged'>('All');

  // Load project questionnaires and runs
  const loadWorkspace = () => {
    if (!currentUser) return;
    setLoading(true);

    // 1. Get questionnaires for this project
    const qList = questionnaireService._getAllQuestionnaires().filter(q => q.projectId === projectId);
    setQuestionnaires(qList);

    // 2. Select initial questionnaire if available
    let currentQId = selectedQuestionnaireId;
    if (!currentQId && qList.length > 0) {
      currentQId = qList[0].id;
      setSelectedQuestionnaireId(currentQId);
    }

    // 3. Load all processing runs for this project
    const runsRes = processingService.getRunsByProject(projectId, currentUser.id);
    const runs = runsRes.success && runsRes.data ? runsRes.data : [];
    setProcessingRuns(runs);

    // If there's an existing latest completed run, load its dataset and codebook
    if (runs.length > 0) {
      const latestRun = runs[0];
      setActiveRun(latestRun);
      const dsRes = processingService.getDatasetByRunId(latestRun.id, projectId, currentUser.id);
      if (dsRes.success && dsRes.data) setActiveDataset(dsRes.data);
      const cbRes = processingService.getCodebookByRunId(latestRun.id, projectId, currentUser.id);
      if (cbRes.success && cbRes.data) setActiveCodebook(cbRes.data);
    }

    if (currentQId) {
      loadQuestionnaireDetails(currentQId);
    } else {
      setLoading(false);
    }
  };

  const loadQuestionnaireDetails = (qId: string) => {
    if (!currentUser) return;
    const allV = questionnaireService._getAllVersions().filter(v => v.questionnaireId === qId);
    setVersions(allV);

    const targetQ = questionnaires.find(q => q.id === qId);
    const activeVer = allV.find(v => v.versionNumber === targetQ?.currentVersion) || allV[0] || null;
    const verId = activeVer ? activeVer.id : null;
    setSelectedVersionId(verId);

    // Load raw submissions
    const subRes = submissionService.getByQuestionnaire(qId, projectId, currentUser.id);
    const rawSubs = subRes.success && subRes.data ? subRes.data : [];
    setSubmissions(rawSubs);

    // Check prerequisites
    const prereqRes = processingService.getProcessingPrerequisites(qId, projectId, currentUser.id);
    if (prereqRes.success && prereqRes.data) {
      setPrerequisites(prereqRes.data);
    }

    // Generate preview
    const prevRes = processingService.generateProcessingPreview(
      qId,
      projectId,
      currentUser.id,
      missingPolicy,
      missingPolicy === 'user_defined_code' ? userMissingCode : undefined
    );
    if (prevRes.success && prevRes.data) {
      setPreviewRows(prevRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadWorkspace();
  }, [projectId, currentUser?.id]);

  useEffect(() => {
    if (selectedQuestionnaireId && currentUser) {
      loadQuestionnaireDetails(selectedQuestionnaireId);
    }
  }, [selectedQuestionnaireId, missingPolicy, userMissingCode]);

  // Handle switching active processing run
  const handleSelectRun = (run: ProcessingRun) => {
    if (!currentUser) return;
    setActiveRun(run);
    const dsRes = processingService.getDatasetByRunId(run.id, projectId, currentUser.id);
    if (dsRes.success && dsRes.data) setActiveDataset(dsRes.data);
    const cbRes = processingService.getCodebookByRunId(run.id, projectId, currentUser.id);
    if (cbRes.success && cbRes.data) setActiveCodebook(cbRes.data);
    setActiveTab('dataset');
    info('Run Loaded', `Viewing dataset generated by ${run.id}.`);
  };

  // Execute Processing Run
  const handleExecuteProcessing = () => {
    if (!currentUser || !selectedQuestionnaireId || !selectedVersionId) return;
    setIsConfirmModalOpen(false);
    setIsProcessing(true);

    setTimeout(() => {
      const result = processingService.runProcessing({
        projectId,
        questionnaireId: selectedQuestionnaireId,
        questionnaireVersionId: selectedVersionId,
        missingValuePolicy: missingPolicy,
        userMissingCode: missingPolicy === 'user_defined_code' ? userMissingCode : undefined,
        notes: runNotes.trim() || undefined,
        userId: currentUser.id,
        userName: currentUser.name,
      });

      setIsProcessing(false);

      if (result.success && result.data) {
        success(
          'Processing Completed',
          `Successfully generated processed dataset with ${result.data.dataset.recordCount} records.`
        );
        setActiveRun(result.data.run);
        setActiveDataset(result.data.dataset);
        setActiveCodebook(result.data.codebook);
        setActiveTab('dataset');

        // Reload runs list
        const runsRes = processingService.getRunsByProject(projectId, currentUser.id);
        if (runsRes.success && runsRes.data) setProcessingRuns(runsRes.data);
      } else {
        error('Processing Failed', result.error || 'Deterministic transformation encountered an error.');
      }
    }, 400);
  };

  // Inspect Raw Source Lineage
  const handleInspectLineage = (record: ProcessedRecord) => {
    if (!currentUser) return;
    setInspectRecord(record);

    const subRes = submissionService.getById(record.submissionId, projectId, currentUser.id);
    if (subRes.success && subRes.data) {
      setSourceRawSubmission(subRes.data);
    } else {
      setSourceRawSubmission(null);
    }
  };

  // Export CSV
  const handleExportDatasetCsv = () => {
    if (!activeDataset) return;
    const { csvContent, filename } = processingService.exportDatasetCsv(activeDataset);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    success('Dataset Exported', `Downloaded ${filename}`);
  };

  // Export Codebook CSV
  const handleExportCodebookCsv = () => {
    if (!activeCodebook) return;
    const { csvContent, filename } = processingService.exportCodebookCsv(activeCodebook);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    success('Codebook Exported', `Downloaded ${filename}`);
  };

  const selectedQuestionnaire = questionnaires.find(q => q.id === selectedQuestionnaireId);

  // Filter processed dataset records
  const filteredRecords = (activeDataset?.records || []).filter(rec => {
    if (statusFilter === 'Valid' && rec.sourceValidationStatus !== 'Valid') return false;
    if (statusFilter === 'Flagged' && rec.sourceValidationStatus !== 'Flagged') return false;
    if (datasetSearch.trim()) {
      const term = datasetSearch.toLowerCase();
      const matchSubId = rec.submissionId.toLowerCase().includes(term);
      const matchPartId = rec.participantIdentifier?.toLowerCase().includes(term);
      return matchSubId || matchPartId;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="p-16 text-center text-xs text-slate-500">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading Stage 6 Data Processing Engine workspace...
      </div>
    );
  }

  return (
    <div className="space-y-6" id="data-processing-engine-workspace">
      {/* Workspace Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Stage 6: Data Processing Engine</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
              Phase 5 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic transformation of immutable raw participant responses into coded, reverse-coded, and auditable research datasets.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {onNavigateToStage && (
            <button
              type="button"
              onClick={() => onNavigateToStage('collection')}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Back to Data Collection</span>
            </button>
          )}

          {activeDataset && (
            <button
              type="button"
              onClick={handleExportDatasetCsv}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export Processed CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Layer Architecture Banner */}
      <div className="p-4 bg-slate-900 text-white rounded-xl shadow-xs">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Deterministic 3-Layer Data Architecture
            </span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Engine: Deterministic / Zero-LLM Pipeline
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
          <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700">
            <div className="flex items-center justify-between font-semibold text-emerald-400 mb-1">
              <span>Layer 1 — RAW DATA</span>
              <span className="text-[9px] bg-emerald-950 text-emerald-300 px-1.5 py-0.5 rounded border border-emerald-800">
                IMMUTABLE
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Original participant answers (e.g. "Agree", "5"). Never modified, coded in-place, or overwritten.
            </p>
          </div>

          <div className="bg-indigo-950/80 p-2.5 rounded-lg border border-indigo-700">
            <div className="flex items-center justify-between font-semibold text-indigo-300 mb-1">
              <span>Layer 2 — PROCESSED DATA</span>
              <span className="text-[9px] bg-indigo-900 text-indigo-200 px-1.5 py-0.5 rounded border border-indigo-600">
                ACTIVE STAGE
              </span>
            </div>
            <p className="text-[11px] text-indigo-200">
              Derived numeric codes, verified reverse coding (max+min-x), normalized missing values &amp; quality flags.
            </p>
          </div>

          <div className="bg-slate-800/40 p-2.5 rounded-lg border border-slate-700/60 opacity-75">
            <div className="flex items-center justify-between font-semibold text-slate-400 mb-1">
              <span>Layer 3 — ANALYSIS DATA</span>
              <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                STAGE 7+
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Composite scores, dimension aggregations, and statistical matrix for Cronbach alpha and regression.
            </p>
          </div>
        </div>
      </div>

      {/* Target Questionnaire Selector Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Target Questionnaire
            </label>
            <select
              value={selectedQuestionnaireId || ''}
              onChange={e => setSelectedQuestionnaireId(e.target.value)}
              className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 min-w-[220px]"
            >
              {questionnaires.map(q => (
                <option key={q.id} value={q.id}>
                  {q.title} (v{q.currentVersion})
                </option>
              ))}
            </select>
          </div>

          {selectedQuestionnaire && (
            <div className="flex items-center gap-2 mt-4 sm:mt-4">
              <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 font-medium">
                Version snapshot: <span className="font-bold">v{selectedQuestionnaire.currentVersion}</span>
              </span>
              <span className="text-[11px] bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-md border border-emerald-200 font-medium">
                Raw responses: <span className="font-bold">{submissions.length} submitted</span>
              </span>
            </div>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('run')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              activeTab === 'run'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            <span>1. Configuration &amp; Run</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dataset')}
            disabled={!activeDataset}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              !activeDataset
                ? 'text-slate-400 cursor-not-allowed opacity-60'
                : activeTab === 'dataset'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>2. Processed Dataset</span>
            {activeDataset && (
              <span className="ml-1 text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.2 rounded-full">
                {activeDataset.recordCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('codebook')}
            disabled={!activeCodebook}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
              !activeCodebook
                ? 'text-slate-400 cursor-not-allowed opacity-60'
                : activeTab === 'codebook'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>3. Codebook</span>
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
            <span>Runs ({processingRuns.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: RUN DATA PROCESSING */}
      {activeTab === 'run' && (
        <div className="space-y-6">
          {/* Prerequisites Checker Card */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    prerequisites?.canProcess
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {prerequisites?.canProcess ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <h3 className="text-sm font-bold text-slate-900">
                  {prerequisites?.canProcess
                    ? 'Processing Prerequisites Satisfied'
                    : 'Processing Prerequisites Pending'}
                </h3>
              </div>

              <div className="text-xs text-slate-500 font-medium">
                Targeted: {prerequisites?.submissionCount || 0} submissions, {prerequisites?.itemCount || 0} snapshot items
              </div>
            </div>

            {/* Error Messages */}
            {prerequisites?.errorMessages && prerequisites.errorMessages.length > 0 && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg space-y-1">
                <div className="text-xs font-bold text-rose-800">Blocking Issues Detected:</div>
                <ul className="list-disc list-inside text-xs text-rose-700 space-y-0.5">
                  {prerequisites.errorMessages.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warning Messages */}
            {prerequisites?.warningMessages && prerequisites.warningMessages.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-1">
                <div className="text-xs font-bold text-amber-800">Quality &amp; Configuration Notices:</div>
                <ul className="list-disc list-inside text-xs text-amber-700 space-y-0.5">
                  {prerequisites.warningMessages.map((msg, idx) => (
                    <li key={idx}>{msg}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Configuration Grid */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Binary className="w-4 h-4 text-indigo-600" />
              <span>Deterministic Processing Parameters</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
              {/* Missing Value Policy */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Missing Value Handling Policy
                </label>
                <p className="text-[11px] text-slate-500">
                  Statistical imputation (mean, median, regression) is strictly forbidden in this layer. Choose explicit missing representation.
                </p>

                <div className="space-y-2 pt-1">
                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="missing-policy"
                      value="preserve_missing"
                      checked={missingPolicy === 'preserve_missing'}
                      onChange={() => setMissingPolicy('preserve_missing')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">Preserve Missing (Standard / Null)</div>
                      <div className="text-[11px] text-slate-500">
                        Blank or unanswered values remain null in the derived dataset. Status flagged as Missing.
                      </div>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
                    <input
                      type="radio"
                      name="missing-policy"
                      value="user_defined_code"
                      checked={missingPolicy === 'user_defined_code'}
                      onChange={() => setMissingPolicy('user_defined_code')}
                      className="mt-0.5 text-indigo-600"
                    />
                    <div className="flex-1">
                      <div className="text-xs font-bold text-slate-900">User-Defined Missing Code</div>
                      <div className="text-[11px] text-slate-500">
                        Substitute missing entries with an explicit numerical code (e.g. -99 or -9 for SPSS/R compatibility).
                      </div>
                      {missingPolicy === 'user_defined_code' && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700">Missing Code:</span>
                          <input
                            type="text"
                            value={userMissingCode}
                            onChange={e => setUserMissingCode(e.target.value)}
                            className="w-24 bg-white border border-slate-300 rounded px-2 py-1 text-xs text-slate-900 font-mono"
                          />
                        </div>
                      )}
                    </div>
                  </label>
                </div>
              </div>

              {/* Run Notes */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Processing Run Audit Notes (Optional)
                </label>
                <p className="text-[11px] text-slate-500">
                  Specify research rationale or version milestone for this deterministic execution run.
                </p>
                <textarea
                  rows={4}
                  value={runNotes}
                  onChange={e => setRunNotes(e.target.value)}
                  placeholder="e.g. Baseline processing of pilot cohort; verified Likert 1-5 coding with reverse coding on Q4 & Q7."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Run Processing Trigger Bar */}
            <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>Raw participant submissions will remain 100% immutable and intact.</span>
              </div>

              <button
                type="button"
                id="btn-run-processing"
                disabled={!prerequisites?.canProcess || isProcessing}
                onClick={() => setIsConfirmModalOpen(true)}
                className={`px-5 py-2 text-xs font-bold rounded-lg transition-all shadow-xs flex items-center gap-2 ${
                  prerequisites?.canProcess && !isProcessing
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Executing Processing Pipeline...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Run Processing Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Live Transformation Preview Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Transformation Rules &amp; Sample Preview</h3>
                <p className="text-[11px] text-slate-500">
                  Shows how raw participant responses are mapped into numeric codes and reversed based on snapshot definitions.
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {previewRows.length} Items Configured
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Item Code</th>
                    <th className="py-2.5 px-3">Question Prompt</th>
                    <th className="py-2.5 px-3">Item Type</th>
                    <th className="py-2.5 px-3">Response Scale</th>
                    <th className="py-2.5 px-3">Reverse Coding</th>
                    <th className="py-2.5 px-3">Sample Raw</th>
                    <th className="py-2.5 px-3">Coded</th>
                    <th className="py-2.5 px-3">Reversed</th>
                    <th className="py-2.5 px-3">Processed</th>
                    <th className="py-2.5 px-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewRows.map((row, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-mono font-bold text-slate-900">{row.itemCode}</td>
                      <td className="py-2 px-3 max-w-[200px] truncate text-slate-700" title={row.questionText}>
                        {row.questionText}
                      </td>
                      <td className="py-2 px-3 text-slate-600">{row.itemType}</td>
                      <td className="py-2 px-3 max-w-[150px] truncate text-slate-600" title={row.scaleSummary}>
                        {row.scaleSummary}
                      </td>
                      <td className="py-2 px-3 text-slate-700 font-medium">
                        {row.reverseRuleSummary.startsWith('Yes') ? (
                          <span className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 font-mono text-[10px]">
                            {row.reverseRuleSummary}
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-slate-800 font-medium">{row.sampleRawValue}</td>
                      <td className="py-2 px-3 font-mono text-indigo-700 font-bold">
                        {row.resolvedCode !== null ? String(row.resolvedCode) : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono text-purple-700 font-bold">
                        {row.reverseCodedValue !== null ? String(row.reverseCodedValue) : '—'}
                      </td>
                      <td className="py-2 px-3 font-mono text-emerald-700 font-bold bg-emerald-50/30">
                        {row.finalProcessedValue !== null ? String(row.finalProcessedValue) : 'null'}
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                            row.status === 'Processed'
                              ? 'bg-emerald-100 text-emerald-800'
                              : row.status === 'Uncoded'
                              ? 'bg-slate-100 text-slate-700'
                              : row.status === 'Missing'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PROCESSED DATASET VIEWER */}
      {activeTab === 'dataset' && (
        <div className="space-y-4">
          {!activeDataset ? (
            <div className="bg-white p-12 text-center text-xs text-slate-500 rounded-xl border border-slate-200">
              No processed dataset selected. Run processing or select a run from the history tab.
            </div>
          ) : (
            <>
              {/* Processed Data Banner & Provenance Notice */}
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                      PROCESSED DATA — DERIVED FROM RAW DATA
                    </span>
                    <span className="text-[10px] bg-indigo-200 text-indigo-900 font-mono px-2 py-0.5 rounded font-bold">
                      Run: {activeRun?.id}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-800 mt-0.5">
                    {activeDataset.recordCount} records deterministically processed on{' '}
                    {new Date(activeDataset.createdAt).toLocaleString()}. Full lineage back to raw submissions is preserved.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportDatasetCsv}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Processed CSV</span>
                  </button>

                  {onNavigateToStage && (
                    <button
                      type="button"
                      onClick={() => onNavigateToStage('scoring')}
                      className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Proceed to Scoring &rarr;</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Table Controls */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search submission ID or participant..."
                      value={datasetSearch}
                      onChange={e => setDatasetSearch(e.target.value)}
                      className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-64"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500 font-medium">Quality Filter:</span>
                    {(['All', 'Valid', 'Flagged'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setStatusFilter(f)}
                        className={`px-2 py-1 rounded text-xs font-semibold transition-colors ${
                          statusFilter === f
                            ? 'bg-indigo-100 text-indigo-700 font-bold'
                            : 'text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <span className="text-xs text-slate-500 font-medium">
                  Showing {filteredRecords.length} of {activeDataset.recordCount} processed records
                </span>
              </div>

              {/* Processed Data Grid */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto max-h-[500px]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="sticky top-0 bg-slate-100 z-10 border-b border-slate-200 text-slate-700 font-bold">
                      <tr>
                        <th className="py-2.5 px-3 border-r border-slate-200">Action</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Submission ID</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Submitted At</th>
                        <th className="py-2.5 px-3 border-r border-slate-200">Raw Quality Status</th>
                        {activeDataset.columns.map(col => (
                          <th
                            key={col.columnName}
                            className="py-2.5 px-3 border-r border-slate-200 text-center min-w-[70px]"
                            title={`${col.columnName}: ${col.questionText} ${col.reverseCoded ? '(Reversed)' : ''}`}
                          >
                            <div>{col.columnName}</div>
                            {col.reverseCoded && (
                              <span className="text-[9px] text-purple-700 font-normal uppercase">
                                [rev]
                              </span>
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRecords.map((record, rIdx) => (
                        <tr key={record.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => handleInspectLineage(record)}
                              className="px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded transition-colors inline-flex items-center gap-1"
                              title="Inspect raw submission provenance"
                            >
                              <Eye className="w-3 h-3" />
                              <span>Inspect Source</span>
                            </button>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 font-mono text-[11px] text-slate-700 whitespace-nowrap">
                            {record.submissionId}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 text-slate-500 whitespace-nowrap">
                            {new Date(record.submittedAt).toLocaleTimeString()}
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                record.sourceValidationStatus === 'Valid'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {record.sourceValidationStatus}
                              {record.sourceValidationFlags.length > 0 && ` (${record.sourceValidationFlags.join(', ')})`}
                            </span>
                          </td>
                          {activeDataset.columns.map(col => {
                            const itemVal = record.items[col.columnName];
                            const isNull = itemVal?.processedValue === null || itemVal?.processedValue === undefined;

                            return (
                              <td
                                key={col.columnName}
                                className={`py-2 px-3 border-r border-slate-200 text-center font-mono ${
                                  isNull
                                    ? 'text-slate-300 italic'
                                    : col.reverseCoded
                                    ? 'text-purple-700 font-bold bg-purple-50/20'
                                    : 'text-slate-900 font-medium'
                                }`}
                              >
                                {isNull ? 'null' : String(itemVal.processedValue)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 3: CODEBOOK VIEWER */}
      {activeTab === 'codebook' && (
        <div className="space-y-4">
          {!activeCodebook ? (
            <div className="bg-white p-12 text-center text-xs text-slate-500 rounded-xl border border-slate-200">
              No codebook available. Run data processing to automatically generate a codebook.
            </div>
          ) : (
            <>
              <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <span>Automated Operationalization Codebook</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Reflects the exact deterministic mapping, scale definitions, reverse scoring formulas, and missing value policies applied.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportCodebookCsv}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Codebook CSV</span>
                </button>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                        <th className="py-2.5 px-3">Item Code</th>
                        <th className="py-2.5 px-3">Column Name</th>
                        <th className="py-2.5 px-3">Construct / Variable</th>
                        <th className="py-2.5 px-3">Question Prompt</th>
                        <th className="py-2.5 px-3">Measurement Scale</th>
                        <th className="py-2.5 px-3">Coding Map</th>
                        <th className="py-2.5 px-3">Reverse Coding</th>
                        <th className="py-2.5 px-3">Missing Policy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {activeCodebook.entries.map((entry, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{entry.itemCode}</td>
                          <td className="py-2 px-3 font-mono text-indigo-700 font-semibold">{entry.columnName}</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">
                            {entry.variableName}
                            {entry.indicatorName && (
                              <div className="text-[10px] text-slate-400 font-normal">
                                {entry.indicatorName}
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-3 max-w-[240px] text-slate-700">{entry.questionText}</td>
                          <td className="py-2 px-3 text-slate-600">{entry.measurementScale}</td>
                          <td className="py-2 px-3 text-slate-700 font-mono text-[11px] max-w-[220px]">
                            {entry.codingMap}
                          </td>
                          <td className="py-2 px-3">
                            {entry.reverseCoded ? (
                              <span className="text-purple-700 font-mono text-[11px] font-bold">
                                {entry.reverseCodingRule}
                              </span>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-medium">{entry.missingValuePolicy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* TAB 4: PROCESSING RUN HISTORY */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900">Processing Runs &amp; Reproducibility Audit Log</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Every execution creates a unique, immutable ProcessingRun. Historical runs are preserved and can be inspected or compared.
            </p>
          </div>

          {processingRuns.length === 0 ? (
            <div className="bg-white p-12 text-center text-xs text-slate-500 rounded-xl border border-slate-200">
              No processing runs recorded yet.
            </div>
          ) : (
            <div className="space-y-3">
              {processingRuns.map(run => {
                const isCurrent = activeRun?.id === run.id;

                return (
                  <div
                    key={run.id}
                    className={`p-4 rounded-xl border transition-all bg-white shadow-2xs ${
                      isCurrent ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-900">{run.id}</span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                              run.status === 'Completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : run.status === 'Running'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {run.status}
                          </span>
                          {isCurrent && (
                            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-semibold">
                              Active in Viewer
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
                          <span>Executed: {new Date(run.createdAt).toLocaleString()}</span>
                          <span>Source: {run.sourceSubmissionCount} submissions</span>
                          <span>Derived: {run.processedRecordCount} records</span>
                          {run.notes && <span className="text-slate-600 italic">"{run.notes}"</span>}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSelectRun(run)}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Load Dataset</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CONFIRMATION MODAL FOR EXECUTING RUN */}
      {isConfirmModalOpen && (
        <Modal
          isOpen={true}
          onClose={() => setIsConfirmModalOpen(false)}
          title="Confirm Data Processing Run"
          maxWidth="md"
        >
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="text-amber-900 leading-relaxed">
                <span className="font-bold">Non-Destructive Guarantee:</span> This operation creates a derived processed dataset from the selected raw responses. Raw participant responses and submissions will NOT be modified, overwritten, or deleted.
              </div>
            </div>

            <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Target Questionnaire:</span>
                <span className="text-slate-900 font-bold">{selectedQuestionnaire?.title}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Questionnaire Version:</span>
                <span className="text-slate-900 font-bold">v{selectedQuestionnaire?.currentVersion}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200">
                <span className="text-slate-500 font-medium">Eligible Submissions:</span>
                <span className="text-slate-900 font-bold">{submissions.length} raw submissions</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Missing Value Policy:</span>
                <span className="text-slate-900 font-bold">
                  {missingPolicy === 'preserve_missing'
                    ? 'Preserve Missing (null)'
                    : `User-defined code (${userMissingCode})`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsConfirmModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteProcessing}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
              >
                Confirm &amp; Run Processing
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* LINEAGE & RAW SOURCE INSPECTOR MODAL */}
      {inspectRecord && (
        <Modal
          isOpen={true}
          onClose={() => setInspectRecord(null)}
          title={`Data Provenance Inspector: ${inspectRecord.submissionId}`}
          maxWidth="lg"
        >
          <div className="space-y-4 text-xs">
            {/* Provenance Header */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Processed Record</span>
                <span className="font-mono text-slate-900 font-bold">{inspectRecord.id}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Source Raw Submission</span>
                <span className="font-mono text-indigo-700 font-bold">{inspectRecord.submissionId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Processing Run</span>
                <span className="font-mono text-slate-900">{inspectRecord.processingRunId}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Raw Quality Status</span>
                <span
                  className={`inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold ${
                    inspectRecord.sourceValidationStatus === 'Valid'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {inspectRecord.sourceValidationStatus}
                </span>
              </div>
            </div>

            {/* Side-by-Side Item Transformation Chain */}
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="bg-slate-100 p-2.5 font-bold text-slate-800 border-b border-slate-200">
                Item-by-Item Deterministic Transformation Lineage
              </div>
              <div className="max-h-[350px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Item Code</th>
                      <th className="py-2 px-3">Layer 1: Raw Participant Answer</th>
                      <th className="py-2 px-3">Coded</th>
                      <th className="py-2 px-3">Reverse Coded</th>
                      <th className="py-2 px-3">Layer 2: Processed Value</th>
                      <th className="py-2 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {Object.entries(inspectRecord.items).map(([colName, itemVal]) => {
                      const rawSource = sourceRawSubmission?.rawResponses[itemVal.originalItemCode];

                      return (
                        <tr key={colName} className="hover:bg-slate-50/50">
                          <td className="py-2 px-3 font-mono font-bold text-slate-900">{colName}</td>
                          <td className="py-2 px-3 text-slate-800 font-medium">
                            {rawSource !== undefined ? (
                              <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-900">
                                "{rawSource}"
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">No raw response</span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-mono text-indigo-700">
                            {itemVal.codedValue !== null ? String(itemVal.codedValue) : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono text-purple-700">
                            {itemVal.reverseCodedValue !== null ? String(itemVal.reverseCodedValue) : '—'}
                          </td>
                          <td className="py-2 px-3 font-mono font-bold text-emerald-700 bg-emerald-50/30">
                            {itemVal.processedValue !== null ? String(itemVal.processedValue) : 'null'}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                itemVal.status === 'Processed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : itemVal.status === 'Missing'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {itemVal.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setInspectRecord(null)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
