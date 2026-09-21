import React, { useState, useEffect } from 'react';
import {
  Database,
  Download,
  ShieldCheck,
  AlertTriangle,
  FileSpreadsheet,
  CheckCircle2,
  XCircle,
  Clock,
  Filter,
  Eye,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Search,
  Pause,
  Play,
  Layers,
  ArrowUpDown,
  ArrowRight,
} from 'lucide-react';
import {
  Questionnaire,
  QuestionnaireItemSnapshot,
  QuestionnaireVersion,
  SubmissionValidationStatus,
  SurveySubmission,
} from '../../types';
import { questionnaireService } from '../../services/questionnaireService';
import { submissionService } from '../../services/submissionService';
import { SubmissionRepository } from '../../repositories/index';
import { apiClient } from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';

interface DataCollectionDashboardProps {
  projectId: string;
  onNavigateToStage?: (stage: 'setup' | 'variables' | 'instruments' | 'questionnaire' | 'collection' | 'processing') => void;
}

export const DataCollectionDashboard: React.FC<DataCollectionDashboardProps> = ({
  projectId,
  onNavigateToStage,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [selectedQuestionnaireId, setSelectedQuestionnaireId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<SurveySubmission[]>([]);
  const [versions, setVersions] = useState<QuestionnaireVersion[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail / Decision Modal
  const [inspectSubmission, setInspectSubmission] = useState<SurveySubmission | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');
  const [decisionStatus, setDecisionStatus] = useState<SubmissionValidationStatus>('Valid');

  // Filters & Search
  const [statusFilter, setStatusFilter] = useState<'All' | 'Valid' | 'Flagged' | 'Excluded'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  // Summary Metrics
  const [metrics, setMetrics] = useState({
    total: 0,
    valid: 0,
    flagged: 0,
    excluded: 0,
    averageDurationSeconds: 0,
    latestSubmittedAt: null as string | null,
  });

  const loadData = async () => {
    if (!currentUser) return;
    setLoading(true);

    // Ensure session token is active
    await apiClient.ensureSession(currentUser.id);

    const qRes = questionnaireService.getByProject(projectId, currentUser.id);
    if (qRes.success && qRes.data) {
      setQuestionnaires(qRes.data);

      const targetQId =
        selectedQuestionnaireId && qRes.data.some(q => q.id === selectedQuestionnaireId)
          ? selectedQuestionnaireId
          : qRes.data[0]?.id || null;

      setSelectedQuestionnaireId(targetQId);

      if (targetQId) {
        // Load versions
        const vRes = questionnaireService.getVersions(targetQId, projectId, currentUser.id);
        if (vRes.success && vRes.data) {
          setVersions(vRes.data);
        }

        // 1. Initial load from local service
        const localSubRes = submissionService.getByQuestionnaire(targetQId, projectId, currentUser.id);
        let currentList = localSubRes.success && localSubRes.data ? localSubRes.data : [];

        // 2. Fetch authoritative submissions from central backend server (multi-device)
        try {
          const remoteSubs = await SubmissionRepository.getByProject(projectId, targetQId);
          if (remoteSubs && remoteSubs.length > 0) {
            // Merge remote into current list
            const subMap = new Map<string, SurveySubmission>();
            currentList.forEach(s => subMap.set(s.id, s));
            remoteSubs.forEach(s => subMap.set(s.id, s));
            currentList = Array.from(subMap.values());

            // Synchronize with local storage
            const allSaved = submissionService._getAllSubmissions();
            const allMap = new Map<string, SurveySubmission>();
            allSaved.forEach(s => allMap.set(s.id, s));
            remoteSubs.forEach(s => allMap.set(s.id, s));
            submissionService._saveSubmissions(Array.from(allMap.values()));
          }
        } catch (err) {
          console.warn('Could not sync remote submissions:', err);
        }

        setSubmissions(currentList);

        // Calculate and set metrics
        const total = currentList.length;
        const valid = currentList.filter(s => s.validationStatus === 'Valid').length;
        const flagged = currentList.filter(s => s.validationStatus === 'Flagged').length;
        const excluded = currentList.filter(s => s.validationStatus === 'Excluded').length;
        const totalDuration = currentList.reduce((acc, s) => acc + (s.durationSeconds || 0), 0);
        const averageDurationSeconds = total > 0 ? Math.round(totalDuration / total) : 0;
        let latestSubmittedAt: string | null = null;
        if (total > 0) {
          const sorted = [...currentList].sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
          );
          latestSubmittedAt = sorted[0].submittedAt;
        }

        setMetrics({
          total,
          valid,
          flagged,
          excluded,
          averageDurationSeconds,
          latestSubmittedAt,
        });
      } else {
        setSubmissions([]);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [projectId, currentUser?.id, selectedQuestionnaireId]);

  const activeQuestionnaire = questionnaires.find(q => q.id === selectedQuestionnaireId);
  const latestVersion = versions.find(v => v.versionNumber === activeQuestionnaire?.currentVersion);
  const itemsSnapshot: QuestionnaireItemSnapshot[] = latestVersion?.itemsSnapshot || [];

  // Lifecycle action triggers
  const handleTogglePause = () => {
    if (!currentUser || !activeQuestionnaire) return;
    if (activeQuestionnaire.status === 'Published') {
      const res = questionnaireService.pause(
        activeQuestionnaire.id,
        projectId,
        currentUser.id,
        currentUser.name,
        'Paused from Data Collection Dashboard'
      );
      if (res.success) {
        success('Survey Paused', `"${activeQuestionnaire.title}" is no longer accepting new submissions.`);
        loadData();
      } else {
        error('Pause Failed', res.error);
      }
    } else if (activeQuestionnaire.status === 'Paused') {
      const res = questionnaireService.resume(
        activeQuestionnaire.id,
        projectId,
        currentUser.id,
        currentUser.name
      );
      if (res.success) {
        success('Survey Resumed', `"${activeQuestionnaire.title}" is now accepting live responses.`);
        loadData();
      } else {
        error('Resume Failed', res.error);
      }
    }
  };

  const handleCopyLink = (slug: string) => {
    const fullUrl = `${window.location.origin}/?survey=${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    success('Public Survey Link Copied', fullUrl);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleOpenSurveyInNewTab = (slug: string) => {
    const url = `${window.location.origin}/?survey=${slug}`;
    window.open(url, '_blank');
  };

  // CSV Export Trigger
  const handleExportCsv = () => {
    if (!currentUser || !activeQuestionnaire) return;
    const res = submissionService.exportRawData(activeQuestionnaire.id, projectId, currentUser.id);
    if (!res.success || !res.data) {
      error('Export Failed', res.error);
      return;
    }

    const { csvContent, filename, totalRows } = res.data;
    if (totalRows === 0) {
      info('No Submissions', 'There are no raw participant submissions to export yet.');
      return;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    success('Raw Data Export Complete', `Exported ${totalRows} raw submissions as "${filename}".`);
  };

  // Researcher Decision Update
  const handleSaveDecision = () => {
    if (!currentUser || !inspectSubmission) return;

    const res = submissionService.updateValidationDecision(
      inspectSubmission.id,
      projectId,
      currentUser.id,
      {
        validationStatus: decisionStatus,
        notes: decisionNotes,
      }
    );

    if (res.success) {
      success('Validation Decision Saved', `Submission ${inspectSubmission.id} marked as ${decisionStatus}.`);
      setInspectSubmission(null);
      loadData();
    } else {
      error('Save Failed', res.error);
    }
  };

  // Filter submissions
  const filteredSubmissions = submissions.filter(s => {
    if (statusFilter !== 'All' && s.validationStatus !== statusFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchId = s.id.toLowerCase().includes(term);
      const matchSess = s.sessionId.toLowerCase().includes(term);
      const matchIdent = s.participantIdentifier?.toLowerCase().includes(term);
      return matchId || matchSess || matchIdent;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Loading data collection workspace and raw response records...
      </div>
    );
  }

  return (
    <div className="space-y-6" id="data-collection-workspace">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Stage 5: Data Collection &amp; Raw Responses</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase tracking-wider">
              Phase 4 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Monitor real participant submissions, review non-destructive quality heuristics, inspect immutable raw responses, and export un-coded raw datasets.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            className="p-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-2xs"
            title="Refresh submissions"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {activeQuestionnaire && (
            <button
              type="button"
              id="btn-export-raw-csv"
              onClick={handleExportCsv}
              disabled={submissions.length === 0}
              className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-300 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
              title="Download raw CSV with exact participant responses"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>Export Raw CSV</span>
            </button>
          )}

          {onNavigateToStage && (
            <button
              type="button"
              id="btn-proceed-to-processing"
              onClick={() => onNavigateToStage('processing')}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 border border-indigo-600 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
              title="Navigate to Stage 6: Data Processing Engine"
            >
              <span>Proceed to Data Processing</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Notice of LocalStorage Architecture & Non-Destructive Raw Data Principle */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs text-indigo-950 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Raw Data Integrity Principle (Strictly Preserved)</p>
            <p className="text-indigo-900 leading-relaxed">
              Participant responses are preserved exactly as entered. The platform does <strong>not</strong> replace raw answers with statistical codes, execute reverse scoring, or alter responses. Coding and scoring occur in later workflow stages.
            </p>
          </div>
        </div>

        <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-950 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">Environment Storage Notice (Browser-Local Architecture)</p>
            <p className="text-amber-900 leading-relaxed">
              In this prototype environment, submissions are stored in namespaced browser storage (<code className="font-mono text-amber-800">qrp_v1_survey_submissions</code>). Submissions made in this browser are instantly reflected in this dashboard.
            </p>
          </div>
        </div>
      </div>

      {/* Questionnaire Selector when multiple exist */}
      {questionnaires.length > 1 && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-700">Select Questionnaire:</span>
          <select
            value={selectedQuestionnaireId || ''}
            onChange={e => setSelectedQuestionnaireId(e.target.value)}
            className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:ring-2 focus:ring-indigo-500 font-medium"
          >
            {questionnaires.map(q => (
              <option key={q.id} value={q.id}>
                {q.title} ({q.status} • v{q.currentVersion})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* If no questionnaires published yet */}
      {questionnaires.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <Database className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Questionnaires Published Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            You must publish an approved instrument in Stage 4 before participants can submit responses.
          </p>
          {onNavigateToStage && (
            <button
              type="button"
              onClick={() => onNavigateToStage('questionnaire')}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <span>Go to Stage 4: Questionnaire Publishing</span>
            </button>
          )}
        </div>
      ) : activeQuestionnaire ? (
        <div className="space-y-6">
          {/* Active Survey Control Panel */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-bold text-slate-900">{activeQuestionnaire.title}</h3>
                  <span
                    className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                      activeQuestionnaire.status === 'Published'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : activeQuestionnaire.status === 'Paused'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-slate-100 text-slate-700 border-slate-300'
                    }`}
                  >
                    {activeQuestionnaire.status}
                  </span>
                  <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                    v{activeQuestionnaire.currentVersion}
                  </span>
                  <span className="text-[10px] uppercase font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                    {activeQuestionnaire.responseMode}
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap pt-1">
                  <span>Public Survey Link:</span>
                  <code className="font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                    /?survey={activeQuestionnaire.publicSlug}
                  </code>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => handleCopyLink(activeQuestionnaire.publicSlug)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  title="Copy direct survey link"
                >
                  {copiedSlug === activeQuestionnaire.publicSlug ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenSurveyInNewTab(activeQuestionnaire.publicSlug)}
                  className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1.5"
                  title="Open live participant survey page in new tab"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Survey Page</span>
                </button>

                {/* Pause / Resume */}
                {(activeQuestionnaire.status === 'Published' || activeQuestionnaire.status === 'Paused') && (
                  <button
                    type="button"
                    onClick={handleTogglePause}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 border ${
                      activeQuestionnaire.status === 'Published'
                        ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-200'
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200'
                    }`}
                  >
                    {activeQuestionnaire.status === 'Published' ? (
                      <>
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause Submissions</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume Submissions</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-medium">Total Submissions</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{metrics.total}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-emerald-700 text-[11px] font-medium">Valid Responses</div>
              <div className="text-2xl font-bold text-emerald-600 mt-1">{metrics.valid}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-amber-700 text-[11px] font-medium">Quality Flagged</div>
              <div className="text-2xl font-bold text-amber-600 mt-1">{metrics.flagged}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-rose-700 text-[11px] font-medium">Excluded</div>
              <div className="text-2xl font-bold text-rose-600 mt-1">{metrics.excluded}</div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-medium">Avg Duration</div>
              <div className="text-xl font-bold text-indigo-700 mt-1">
                {metrics.averageDurationSeconds}s
              </div>
            </div>

            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs">
              <div className="text-slate-500 text-[11px] font-medium">Latest Response</div>
              <div className="text-xs font-semibold text-slate-800 mt-2 truncate">
                {metrics.latestSubmittedAt
                  ? new Date(metrics.latestSubmittedAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : 'None yet'}
              </div>
            </div>
          </div>

          {/* Raw Response Table Container */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
            {/* Table Action Bar */}
            <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  RAW DATA — NOT CODED
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  ({filteredSubmissions.length} of {submissions.length} shown)
                </span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Search ID or session..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 w-44"
                  />
                </div>

                {/* Filter Status */}
                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5 text-xs">
                  {(['All', 'Valid', 'Flagged', 'Excluded'] as const).map(tab => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setStatusFilter(tab)}
                      className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                        statusFilter === tab
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Table */}
            {filteredSubmissions.length === 0 ? (
              <div className="p-12 text-center text-xs text-slate-500 space-y-2">
                <Database className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">No Raw Submissions Match Filter</p>
                <p className="text-slate-400">
                  Use the public survey link to submit a real response or adjust your search filter.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3 whitespace-nowrap">Submission ID</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Session ID</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Version</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Submitted At</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Duration</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Status</th>
                      <th className="py-2.5 px-3 whitespace-nowrap">Quality Flags</th>
                      {/* Dynamic columns for each questionnaire item */}
                      {itemsSnapshot.map(item => (
                        <th
                          key={item.itemCode}
                          className="py-2.5 px-3 whitespace-nowrap bg-indigo-50/50 text-indigo-900 border-l border-slate-200"
                          title={`${item.itemCode}: ${item.questionText}`}
                        >
                          <div className="font-mono text-[11px] font-bold">{item.itemCode}</div>
                          <div className="text-[9px] font-normal text-slate-500 truncate max-w-[120px]">
                            {item.questionText}
                          </div>
                        </th>
                      ))}
                      <th className="py-2.5 px-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSubmissions.map(sub => (
                      <tr key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-800 whitespace-nowrap">
                          {sub.id}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                          {sub.sessionId.substring(0, 16)}...
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 whitespace-nowrap">
                          v{sub.questionnaireVersion}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                          {new Date(sub.submittedAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap font-mono">
                          {sub.durationSeconds}s
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              sub.validationStatus === 'Valid'
                                ? 'bg-emerald-100 text-emerald-800'
                                : sub.validationStatus === 'Flagged'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {sub.validationStatus}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 whitespace-nowrap">
                          {sub.validationFlags.length > 0 ? (
                            <div className="flex items-center gap-1">
                              {sub.validationFlags.map(f => (
                                <span
                                  key={f}
                                  className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 rounded"
                                >
                                  {f}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px]">—</span>
                          )}
                        </td>

                        {/* Raw Responses for each item */}
                        {itemsSnapshot.map(item => {
                          const rawVal = sub.rawResponses[item.itemCode];
                          return (
                            <td
                              key={item.itemCode}
                              className="py-2.5 px-3 border-l border-slate-100 text-slate-900 font-medium whitespace-nowrap bg-slate-50/20"
                            >
                              {rawVal ? (
                                <span className="bg-white border border-slate-200 px-2 py-0.5 rounded text-[11px]">
                                  {rawVal}
                                </span>
                              ) : (
                                <span className="text-slate-300 italic text-[11px]">empty</span>
                              )}
                            </td>
                          );
                        })}

                        {/* Action buttons */}
                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setInspectSubmission(sub);
                              setDecisionStatus(sub.validationStatus);
                              setDecisionNotes(sub.researcherDecisionNotes || '');
                            }}
                            className="px-2 py-1 text-[11px] font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3 text-slate-500" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Submission Inspector & Validation Decision Modal */}
      {inspectSubmission && (
        <Modal
          isOpen={true}
          onClose={() => setInspectSubmission(null)}
          title={`Raw Submission Inspector: ${inspectSubmission.id}`}
          maxWidth="lg"
        >
          <div className="space-y-5 text-xs">
            {/* Metadata Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Session ID</span>
                <span className="font-mono text-slate-800 truncate block">
                  {inspectSubmission.sessionId}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Version</span>
                <span className="font-mono font-bold text-indigo-700 block">
                  v{inspectSubmission.questionnaireVersion}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-medium text-slate-800 block">
                  {inspectSubmission.durationSeconds} seconds
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Submitted</span>
                <span className="text-slate-800 block">
                  {new Date(inspectSubmission.submittedAt).toLocaleTimeString()}
                </span>
              </div>
            </div>

            {/* Quality Flags Notice */}
            {inspectSubmission.validationFlags.length > 0 && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="font-bold">Automated Heuristic Flags Detected</p>
                  <p className="text-[11px] text-amber-800">
                    Flags: {inspectSubmission.validationFlags.join(', ')}. Note: Heuristic flags are advisory and do NOT alter or delete raw data.
                  </p>
                </div>
              </div>
            )}

            {/* Raw Responses List */}
            <div className="space-y-2">
              <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px]">
                Preserved Raw Responses (Item-by-Item)
              </h4>
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-left w-20">Code</th>
                      <th className="py-2 px-3 text-left">Item Question Prompt</th>
                      <th className="py-2 px-3 text-left w-36">Raw Answer</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {itemsSnapshot.map(item => {
                      const rawVal = inspectSubmission.rawResponses[item.itemCode];
                      return (
                        <tr key={item.itemCode}>
                          <td className="py-2 px-3 font-mono font-bold text-slate-700">
                            {item.itemCode}
                          </td>
                          <td className="py-2 px-3 text-slate-700">{item.questionText}</td>
                          <td className="py-2 px-3">
                            {rawVal ? (
                              <span className="font-semibold text-indigo-900 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                {rawVal}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">none</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Researcher Validation Decision Form */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="font-bold text-slate-800">Researcher Validation Status Decision</h4>
              <p className="text-slate-500 text-[11px]">
                You may override or confirm the submission status based on your review. Raw data remains immutable regardless of status.
              </p>

              <div className="flex items-center gap-3">
                {(['Valid', 'Flagged', 'Excluded'] as const).map(stat => (
                  <label key={stat} className="flex items-center gap-1.5 cursor-pointer font-medium">
                    <input
                      type="radio"
                      name="decision-status"
                      checked={decisionStatus === stat}
                      onChange={() => setDecisionStatus(stat)}
                      className="text-indigo-600"
                    />
                    <span>{stat}</span>
                  </label>
                ))}
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Researcher Notes / Reason
                </label>
                <input
                  type="text"
                  value={decisionNotes}
                  onChange={e => setDecisionNotes(e.target.value)}
                  placeholder="e.g. Verified legitimate response despite fast completion"
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setInspectSubmission(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={handleSaveDecision}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
              >
                Save Decision
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
