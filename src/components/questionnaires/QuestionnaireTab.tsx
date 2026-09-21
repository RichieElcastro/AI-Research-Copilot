import React, { useState, useEffect } from 'react';
import {
  FileQuestion,
  Plus,
  Globe,
  Lock,
  History,
  ShieldCheck,
  Pause,
  Play,
  XCircle,
  Archive,
  Copy,
  Check,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertCircle,
  Eye,
  Sliders,
  Layers,
  Sparkles,
} from 'lucide-react';
import {
  Instrument,
  Questionnaire,
  QuestionnaireStatus,
  QuestionnaireVersion,
  ResponseMode,
} from '../../types';
import { questionnaireService } from '../../services/questionnaireService';
import { instrumentService } from '../../services/instrumentService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { QuestionnairePublishModal } from './QuestionnairePublishModal';

interface QuestionnaireTabProps {
  projectId: string;
  onNavigateToInstruments?: () => void;
}

export const QuestionnaireTab: React.FC<QuestionnaireTabProps> = ({
  projectId,
  onNavigateToInstruments,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [questionnaires, setQuestionnaires] = useState<Questionnaire[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Active Selections
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [editingQuestionnaire, setEditingQuestionnaire] = useState<Questionnaire | null>(null);
  const [expandedVersionsQId, setExpandedVersionsQId] = useState<string | null>(null);
  const [expandedSnapshotQId, setExpandedSnapshotQId] = useState<string | null>(null);
  const [versionsMap, setVersionsMap] = useState<Record<string, QuestionnaireVersion[]>>({});
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const loadData = () => {
    if (!currentUser) return;
    setLoading(true);

    const qRes = questionnaireService.getByProject(projectId, currentUser.id);
    if (qRes.success && qRes.data) {
      setQuestionnaires(qRes.data);

      // Load versions for all questionnaires
      const newVersionsMap: Record<string, QuestionnaireVersion[]> = {};
      for (const q of qRes.data) {
        const vRes = questionnaireService.getVersions(q.id, projectId, currentUser.id);
        if (vRes.success && vRes.data) {
          newVersionsMap[q.id] = vRes.data;
        }
      }
      setVersionsMap(newVersionsMap);
    }

    const instRes = instrumentService.getInstruments(projectId, currentUser.id);
    if (instRes.success && instRes.data) {
      setInstruments(instRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [projectId, currentUser?.id]);

  const instrumentsMap = new Map(instruments.map(i => [i.id, i]));

  // Metrics
  const totalCount = questionnaires.length;
  const publishedCount = questionnaires.filter(q => q.status === 'Published').length;
  const pausedCount = questionnaires.filter(q => q.status === 'Paused').length;
  const approvedInstruments = instruments.filter(i => i.status === 'Approved');

  // Lifecycle handlers
  const handlePause = (q: Questionnaire) => {
    if (!currentUser) return;
    const res = questionnaireService.pause(
      q.id,
      projectId,
      currentUser.id,
      currentUser.name,
      'Paused by researcher'
    );
    if (res.success) {
      success('Survey Paused', `"${q.title}" is now paused. Participants cannot submit responses.`);
      loadData();
    } else {
      error('Pause Failed', res.error);
    }
  };

  const handleResume = (q: Questionnaire) => {
    if (!currentUser) return;
    const res = questionnaireService.resume(q.id, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Survey Resumed', `"${q.title}" is now active and accepting submissions.`);
      loadData();
    } else {
      error('Resume Failed', res.error);
    }
  };

  const handleClose = (q: Questionnaire) => {
    if (!currentUser) return;
    const res = questionnaireService.close(
      q.id,
      projectId,
      currentUser.id,
      currentUser.name,
      'Closed by researcher'
    );
    if (res.success) {
      success('Survey Closed', `"${q.title}" has been permanently closed.`);
      loadData();
    } else {
      error('Close Failed', res.error);
    }
  };

  const handleArchive = (q: Questionnaire) => {
    if (!currentUser) return;
    const res = questionnaireService.archive(q.id, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Questionnaire Archived', `"${q.title}" has been moved to archive.`);
      loadData();
    } else {
      error('Archive Failed', res.error);
    }
  };

  const handleCopySlug = (slug: string) => {
    const fullUrl = `${window.location.origin}/?survey=${slug}`;
    navigator.clipboard.writeText(fullUrl);
    setCopiedSlug(slug);
    success('Public Survey Link Copied', fullUrl);
    setTimeout(() => setCopiedSlug(null), 2500);
  };

  const handleOpenSurvey = (slug: string) => {
    window.open(`${window.location.origin}/?survey=${slug}`, '_blank');
  };

  if (loading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500">
        Loading questionnaires and immutable version snapshots...
      </div>
    );
  }

  return (
    <div className="space-y-6" id="questionnaire-stage-workspace">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Stage 4: Questionnaire Publishing &amp; Versioning</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 uppercase tracking-wider">
              Phase 3 Active
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Create and manage immutable questionnaire release candidates derived from approved instruments. Every published version is permanently locked to guarantee empirical reproducibility.
          </p>
        </div>

        {/* Action Button */}
        <button
          type="button"
          id="btn-create-questionnaire-top"
          onClick={() => {
            setEditingQuestionnaire(null);
            setIsPublishModalOpen(true);
          }}
          disabled={approvedInstruments.length === 0}
          className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5 shrink-0"
          title={
            approvedInstruments.length === 0
              ? 'At least one Approved instrument is required to publish a questionnaire'
              : 'Create a new questionnaire from an approved instrument'
          }
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Create &amp; Publish Questionnaire</span>
        </button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Total Questionnaires</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</div>
          <div className="text-[11px] text-slate-500 mt-0.5">Configured survey releases</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Published &amp; Active</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{publishedCount}</div>
          <div className="text-[11px] text-emerald-700 font-medium mt-0.5">Accepting live participants</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Approved Instruments</div>
          <div className="text-2xl font-bold text-indigo-600 mt-1">{approvedInstruments.length}</div>
          <div className="text-[11px] text-indigo-700 font-medium mt-0.5">
            {instruments.length} total instruments in project
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-slate-500 text-xs font-medium">Audit Integrity Gate</div>
          <div className="flex items-center gap-1.5 text-emerald-700 font-bold text-sm mt-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Immutable Snapshots</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-0.5">Zero mutable dependencies</div>
        </div>
      </div>

      {/* Notice if no instruments are approved yet */}
      {approvedInstruments.length === 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-bold">No Approved Instruments Available</p>
            <p className="text-amber-800">
              A questionnaire may <strong>only</strong> be created from an <strong>Approved</strong> instrument that has passed all psychometric validation rules. You currently have {instruments.length} instruments in Draft or Review status.
            </p>
            {onNavigateToInstruments && (
              <button
                type="button"
                onClick={onNavigateToInstruments}
                className="mt-2 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-md border border-amber-300 transition-colors inline-flex items-center gap-1"
              >
                <span>Go to Instruments Workspace to Approve</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main List of Questionnaires */}
      {questionnaires.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900">No Questionnaires Published Yet</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Once an instrument is approved, you can release it as a questionnaire with public access slug, institutional informed consent statement, and an immutable snapshot of all measurement items.
          </p>
          {approvedInstruments.length > 0 && (
            <button
              type="button"
              id="btn-create-questionnaire-empty"
              onClick={() => {
                setEditingQuestionnaire(null);
                setIsPublishModalOpen(true);
              }}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Publish First Questionnaire</span>
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {questionnaires.map(q => {
            const inst = instrumentsMap.get(q.instrumentId);
            const qVersions = versionsMap[q.id] || [];
            const currentVer = qVersions.find(v => v.versionNumber === q.currentVersion);
            const isExpandedVersions = expandedVersionsQId === q.id;
            const isExpandedSnapshot = expandedSnapshotQId === q.id;

            return (
              <div
                key={q.id}
                id={`questionnaire-card-${q.id}`}
                className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all"
              >
                {/* Card Top */}
                <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="text-base font-bold text-slate-900">{q.title}</h3>
                      <StatusBadge status={q.status} />
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        v{q.currentVersion > 0 ? q.currentVersion : 'Draft'}
                      </span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                        {q.responseMode}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                        <span className="font-mono text-slate-700 font-medium">/survey/{q.publicSlug}</span>
                      </span>
                      <span>•</span>
                      <span>
                        Instrument:{' '}
                        <strong className="text-slate-700">{inst ? `${inst.name} (${inst.code})` : q.instrumentId}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Snapshotted Items:{' '}
                        <strong className="text-slate-700">{currentVer?.itemsSnapshot?.length || 0}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Lifecycle Controls */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Copy URL */}
                    <button
                      type="button"
                      onClick={() => handleCopySlug(q.publicSlug)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors inline-flex items-center gap-1"
                      title="Copy public survey link"
                    >
                      {copiedSlug === q.publicSlug ? (
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

                    {/* Open Survey in New Tab */}
                    <button
                      type="button"
                      onClick={() => handleOpenSurvey(q.publicSlug)}
                      className="px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1"
                      title="Open participant survey page in new tab"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Survey</span>
                    </button>

                    {/* Publish New Version */}
                    {inst?.status === 'Approved' && q.status !== 'Archived' && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingQuestionnaire(q);
                          setIsPublishModalOpen(true);
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors inline-flex items-center gap-1"
                        title="Publish updated release version from approved instrument"
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Publish Version</span>
                      </button>
                    )}

                    {/* Pause / Resume */}
                    {q.status === 'Published' && (
                      <button
                        type="button"
                        onClick={() => handlePause(q)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Pause className="w-3.5 h-3.5" />
                        <span>Pause</span>
                      </button>
                    )}

                    {q.status === 'Paused' && (
                      <button
                        type="button"
                        onClick={() => handleResume(q)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Resume</span>
                      </button>
                    )}

                    {/* Close */}
                    {(q.status === 'Published' || q.status === 'Paused') && (
                      <button
                        type="button"
                        onClick={() => handleClose(q)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Close</span>
                      </button>
                    )}

                    {/* Archive */}
                    {q.status === 'Closed' && (
                      <button
                        type="button"
                        onClick={() => handleArchive(q)}
                        className="px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>Archive</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub-panels toggle bar */}
                <div className="bg-slate-50/60 px-5 py-2.5 border-b border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSnapshotQId(isExpandedSnapshot ? null : q.id)
                      }
                      className="font-semibold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1"
                    >
                      {isExpandedSnapshot ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>Inspect Immutable Items Snapshot ({currentVer?.itemsSnapshot?.length || 0})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedVersionsQId(isExpandedVersions ? null : q.id)
                      }
                      className="font-semibold text-slate-600 hover:text-slate-900 inline-flex items-center gap-1"
                    >
                      {isExpandedVersions ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                      <span>Version History ({qVersions.length})</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-500">
                    Updated: {new Date(q.updatedAt).toLocaleDateString()}
                  </div>
                </div>

                {/* EXPANDED PANEL: Snapshot Items */}
                {isExpandedSnapshot && (
                  <div className="p-5 bg-slate-50/40 border-b border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-slate-900">
                          Active Snapshot: Version v{currentVer?.versionNumber || q.currentVersion}
                        </span>
                        <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                          Permanently Locked
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        Published at: {currentVer ? new Date(currentVer.publishedAt).toLocaleString() : 'N/A'}
                      </span>
                    </div>

                    {!currentVer || currentVer.itemsSnapshot.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                        No snapshot generated yet. Click "Publish Version" to lock items into an immutable release.
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100 max-h-80 overflow-y-auto">
                        {currentVer.itemsSnapshot.map((item, idx) => (
                          <div key={item.id} className="p-3 hover:bg-slate-50 transition-colors">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                                  #{idx + 1} • {item.itemCode}
                                </span>
                                <span className="text-[10px] font-bold uppercase text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  {item.itemType}
                                </span>
                                {item.reverseCoded && (
                                  <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                    Reverse Coded
                                  </span>
                                )}
                                {item.required && (
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                                    Required
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-500">
                                {item.responseScaleName || 'Default'}
                              </span>
                            </div>

                            <p className="text-xs text-slate-900 font-medium">{item.questionText}</p>

                            {item.scaleOptions && item.scaleOptions.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {item.scaleOptions.map(opt => (
                                  <span
                                    key={opt.value}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-medium"
                                  >
                                    {opt.value}: {opt.label}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* EXPANDED PANEL: Version History */}
                {isExpandedVersions && (
                  <div className="p-5 bg-slate-50/40 border-b border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <History className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Immutable Release Candidates History</span>
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {qVersions.length} {qVersions.length === 1 ? 'version snapshot' : 'version snapshots'}
                      </span>
                    </div>

                    {qVersions.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-500 bg-white rounded-lg border border-slate-200">
                        No historical versions recorded.
                      </div>
                    ) : (
                      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden divide-y divide-slate-100">
                        {qVersions.map(ver => (
                          <div
                            key={ver.id}
                            className={`p-3 flex items-center justify-between gap-4 ${
                              ver.versionNumber === q.currentVersion ? 'bg-indigo-50/30' : ''
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-slate-900">
                                  Release Version {ver.versionNumber}
                                </span>
                                {ver.versionNumber === q.currentVersion && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-indigo-600 text-white">
                                    Current Active
                                  </span>
                                )}
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 inline-flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Locked
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500">
                                Published: {new Date(ver.publishedAt).toLocaleString()} • {ver.itemsSnapshot.length} measurement items snapshotted
                              </p>
                              {ver.notes && (
                                <p className="text-[11px] text-slate-700 italic mt-0.5">"{ver.notes}"</p>
                              )}
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-mono text-[11px] text-slate-400">{ver.id}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Publish Modal */}
      <QuestionnairePublishModal
        isOpen={isPublishModalOpen}
        onClose={() => {
          setIsPublishModalOpen(false);
          setEditingQuestionnaire(null);
        }}
        projectId={projectId}
        existingQuestionnaire={editingQuestionnaire}
        onSuccess={() => {
          loadData();
        }}
      />
    </div>
  );
};

const StatusBadge: React.FC<{ status: QuestionnaireStatus }> = ({ status }) => {
  switch (status) {
    case 'Published':
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
          Published
        </span>
      );
    case 'Paused':
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          Paused
        </span>
      );
    case 'Closed':
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800 border border-slate-200">
          Closed
        </span>
      );
    case 'Archived':
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 border border-rose-200">
          Archived
        </span>
      );
    case 'Ready':
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
          Ready
        </span>
      );
    case 'Draft':
    default:
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
          Draft
        </span>
      );
  }
};
