import React, { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  AlertCircle,
  Globe,
  Lock,
  Layers,
  Sparkles,
  Calendar,
  Hash,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { Instrument, InstrumentVersion, Questionnaire, ResponseMode } from '../../types';
import { instrumentService } from '../../services/instrumentService';
import { questionnaireService, generateBaseSlug } from '../../services/questionnaireService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Modal } from '../common/Modal';

interface QuestionnairePublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  preselectedInstrumentId?: string;
  existingQuestionnaire?: Questionnaire | null;
  onSuccess: (questionnaire: Questionnaire) => void;
}

export const QuestionnairePublishModal: React.FC<QuestionnairePublishModalProps> = ({
  isOpen,
  onClose,
  projectId,
  preselectedInstrumentId,
  existingQuestionnaire,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string>(
    preselectedInstrumentId || existingQuestionnaire?.instrumentId || ''
  );
  const [approvedVersions, setApprovedVersions] = useState<InstrumentVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [publicSlug, setPublicSlug] = useState('');
  const [customSlugEdited, setCustomSlugEdited] = useState(false);
  const [introduction, setIntroduction] = useState('');
  const [consentStatement, setConsentStatement] = useState('');
  const [closingMessage, setClosingMessage] = useState('');
  const [responseMode, setResponseMode] = useState<ResponseMode>('anonymous');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [maxResponses, setMaxResponses] = useState<string>('');
  const [approvalNotes, setApprovalNotes] = useState('');

  const [activeStep, setActiveStep] = useState<'settings' | 'review_items'>('settings');
  const [submitting, setSubmitting] = useState(false);

  // Load project instruments
  useEffect(() => {
    if (!currentUser || !isOpen) return;

    const instRes = instrumentService.getInstruments(projectId, currentUser.id);
    if (instRes.success && instRes.data) {
      setInstruments(instRes.data);
      if (!selectedInstrumentId && instRes.data.length > 0) {
        // Prefer first Approved instrument
        const firstApproved = instRes.data.find(i => i.status === 'Approved');
        setSelectedInstrumentId(firstApproved ? firstApproved.id : instRes.data[0].id);
      }
    }
  }, [projectId, currentUser?.id, isOpen]);

  // Load versions whenever instrument changes
  useEffect(() => {
    if (!currentUser || !selectedInstrumentId) {
      setApprovedVersions([]);
      return;
    }

    setLoadingVersions(true);
    const verRes = instrumentService.getInstrumentVersions(
      selectedInstrumentId,
      projectId,
      currentUser.id
    );
    if (verRes.success && verRes.data) {
      setApprovedVersions(verRes.data.filter(v => v.status === 'Approved'));
    } else {
      setApprovedVersions([]);
    }
    setLoadingVersions(false);
  }, [selectedInstrumentId, projectId, currentUser?.id]);

  // Initialize fields
  useEffect(() => {
    if (existingQuestionnaire) {
      setTitle(existingQuestionnaire.title);
      setPublicSlug(existingQuestionnaire.publicSlug);
      setCustomSlugEdited(true);
      setIntroduction(existingQuestionnaire.introduction);
      setConsentStatement(existingQuestionnaire.consentStatement);
      setClosingMessage(existingQuestionnaire.closingMessage);
      setResponseMode(existingQuestionnaire.responseMode);
      setStartDate(existingQuestionnaire.startDate || '');
      setEndDate(existingQuestionnaire.endDate || '');
      setMaxResponses(
        existingQuestionnaire.maxResponses ? String(existingQuestionnaire.maxResponses) : ''
      );
      setSelectedInstrumentId(existingQuestionnaire.instrumentId);
    } else if (selectedInstrumentId) {
      const inst = instruments.find(i => i.id === selectedInstrumentId);
      if (inst) {
        const defaultTitle = `${inst.name} Survey`;
        setTitle(defaultTitle);
        setPublicSlug(generateBaseSlug(defaultTitle));
        setCustomSlugEdited(false);
        setIntroduction(
          inst.purpose
            ? `Welcome to this empirical research study. ${inst.purpose}`
            : 'Welcome to this empirical research study. Please take a few moments to complete this questionnaire.'
        );
        setConsentStatement(
          'Informed Consent: I confirm that I have read the study information, understand that my participation is voluntary, and consent to my responses being used for academic research analysis.'
        );
        setClosingMessage(
          'Thank you for your valuable participation in this research study. Your responses have been recorded.'
        );
        setResponseMode('anonymous');
      }
    }
  }, [existingQuestionnaire, selectedInstrumentId, instruments]);

  const handleTitleChange = (val: string) => {
    setTitle(val);
    if (!customSlugEdited) {
      setPublicSlug(generateBaseSlug(val));
    }
  };

  const selectedInstrument = instruments.find(i => i.id === selectedInstrumentId);
  const isSelectedApproved = selectedInstrument?.status === 'Approved';
  const latestApprovedVersion = approvedVersions[0];
  const itemsToSnapshot = latestApprovedVersion?.snapshot?.items || [];
  const scalesSnapshot = latestApprovedVersion?.snapshot?.scalesSnapshot || [];
  const scalesMap = new Map(scalesSnapshot.map(s => [s.id, s]));

  const handleSubmitAndPublish = async () => {
    if (!currentUser) return;

    if (!selectedInstrument) {
      error('Selection Required', 'Please select an instrument.');
      return;
    }

    if (!isSelectedApproved) {
      error(
        'Instrument Not Approved',
        `Instrument "${selectedInstrument.name}" is currently in ${selectedInstrument.status} status. Only Approved instruments can create questionnaires.`
      );
      return;
    }

    if (!latestApprovedVersion) {
      error('Snapshot Missing', 'No approved snapshot was found for this instrument.');
      return;
    }

    if (!title.trim()) {
      error('Title Required', 'Please enter a questionnaire title.');
      return;
    }

    setSubmitting(true);

    try {
      let questionnaireId = existingQuestionnaire?.id;

      // 1. Create or update settings
      if (!questionnaireId) {
        const createRes = questionnaireService.createFromApprovedInstrument(
          projectId,
          selectedInstrument.id,
          currentUser.id,
          currentUser.name,
          {
            title: title.trim(),
            publicSlug: publicSlug.trim() || undefined,
            introduction: introduction.trim(),
            consentStatement: consentStatement.trim(),
            closingMessage: closingMessage.trim(),
            responseMode,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            maxResponses: maxResponses ? parseInt(maxResponses, 10) : undefined,
          }
        );

        if (!createRes.success || !createRes.data) {
          error('Creation Failed', createRes.error || 'Failed to create questionnaire.');
          setSubmitting(false);
          return;
        }

        questionnaireId = createRes.data.id;
      } else {
        const updateRes = questionnaireService.updateSettings(
          questionnaireId,
          projectId,
          currentUser.id,
          currentUser.name,
          {
            title: title.trim(),
            publicSlug: publicSlug.trim() || undefined,
            introduction: introduction.trim(),
            consentStatement: consentStatement.trim(),
            closingMessage: closingMessage.trim(),
            responseMode,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            maxResponses: maxResponses ? parseInt(maxResponses, 10) : undefined,
          }
        );

        if (!updateRes.success) {
          error('Update Failed', updateRes.error || 'Failed to update settings.');
          setSubmitting(false);
          return;
        }
      }

      // 2. Publish and create immutable QuestionnaireVersion
      const pubRes = questionnaireService.publish(
        questionnaireId,
        projectId,
        currentUser.id,
        currentUser.name,
        approvalNotes.trim() || undefined
      );

      if (pubRes.success && pubRes.data) {
        success(
          'Questionnaire Published',
          `Published as v${pubRes.data.version.versionNumber} with ${pubRes.data.version.itemsSnapshot.length} snapshotted items.`
        );
        onSuccess(pubRes.data.questionnaire);
        onClose();
      } else {
        error('Publication Failed', pubRes.error || 'Failed to publish questionnaire version.');
      }
    } catch (err: any) {
      error('System Error', err.message || 'An unexpected error occurred.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="questionnaire-publish-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={existingQuestionnaire ? 'Publish New Questionnaire Version' : 'Create & Publish Questionnaire'}
      subtitle="Release an approved instrument into an immutable, version-controlled participant questionnaire"
      maxWidth="3xl"
    >
      <div className="space-y-6">
        {/* Step Navigation Bar */}
        <div className="flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveStep('settings')}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 text-center transition-colors flex items-center justify-center gap-1.5 ${
              activeStep === 'settings'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>1. Survey Settings &amp; Ethics</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveStep('review_items')}
            className={`flex-1 py-2.5 text-xs font-bold border-b-2 text-center transition-colors flex items-center justify-center gap-1.5 ${
              activeStep === 'review_items'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>2. Immutable Item Snapshot ({itemsToSnapshot.length})</span>
          </button>
        </div>

        {/* STEP 1: Survey Settings */}
        {activeStep === 'settings' && (
          <div className="space-y-4">
            {/* Instrument Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Source Approved Instrument <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedInstrumentId}
                disabled={Boolean(existingQuestionnaire)}
                onChange={e => setSelectedInstrumentId(e.target.value)}
                className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                {instruments.map(inst => (
                  <option key={inst.id} value={inst.id}>
                    [{inst.status}] {inst.name} ({inst.code} v{inst.version})
                  </option>
                ))}
              </select>

              {/* Status Verification Badge */}
              <div className="mt-2">
                {isSelectedApproved ? (
                  <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold">Instrument Approved:</span> Meets all empirical
                      audit gates. Approved version snapshot v{latestApprovedVersion?.versionNumber || '1.0'} is available.
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <div>
                      <span className="font-bold">Instrument Not Approved:</span> Status is{' '}
                      <span className="font-bold underline">{selectedInstrument?.status || 'Unknown'}</span>. A questionnaire may ONLY be created from an APPROVED instrument. Return to the Instrument Workspace to approve it first.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Questionnaire Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Public Survey Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={e => handleTitleChange(e.target.value)}
                placeholder="e.g. Doomscrolling & Academic Burnout Survey 2026"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Public Slug */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Public Access Slug <span className="text-rose-500">*</span>
              </label>
              <div className="flex items-center rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500">
                <span className="text-xs text-slate-400 font-mono">/survey/</span>
                <input
                  type="text"
                  value={publicSlug}
                  onChange={e => {
                    setPublicSlug(generateBaseSlug(e.target.value));
                    setCustomSlugEdited(true);
                  }}
                  placeholder="doomscrolling-study-2026"
                  className="w-full text-xs bg-transparent border-none text-slate-800 font-mono focus:outline-hidden"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Human-readable, unique URL slug for participant link distribution.
              </p>
            </div>

            {/* Response Mode */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Participant Response Mode
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    responseMode === 'anonymous'
                      ? 'bg-indigo-50/60 border-indigo-300 text-indigo-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="responseMode"
                    value="anonymous"
                    checked={responseMode === 'anonymous'}
                    onChange={() => setResponseMode('anonymous')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold block">Anonymous Submission</span>
                    <span className="text-[11px] text-slate-500">
                      Zero personally identifiable information recorded. Best for sensitive psychological or behavioral items.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                    responseMode === 'identified'
                      ? 'bg-indigo-50/60 border-indigo-300 text-indigo-900'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="responseMode"
                    value="identified"
                    checked={responseMode === 'identified'}
                    onChange={() => setResponseMode('identified')}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold block">Identified / Coded Cohort</span>
                    <span className="text-[11px] text-slate-500">
                      Requires participant student ID, email token, or subject code to link longitudinal waves.
                    </span>
                  </div>
                </label>
              </div>
            </div>

            {/* Introduction Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Participant Introduction &amp; Briefing
              </label>
              <textarea
                rows={3}
                value={introduction}
                onChange={e => setIntroduction(e.target.value)}
                placeholder="Describe study purpose, institution, estimated duration, and instructions..."
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Ethics Consent Statement */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Institutional / IRB Informed Consent Statement
                </label>
                <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-medium">
                  Researcher Ethics Responsibility
                </span>
              </div>
              <textarea
                rows={3}
                value={consentStatement}
                onChange={e => setConsentStatement(e.target.value)}
                placeholder="Institutional review board approved consent statement..."
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Participants must explicitly accept this statement before accessing measurement items.
              </p>
            </div>

            {/* Closing Message */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Debriefing &amp; Closing Message
              </label>
              <input
                type="text"
                value={closingMessage}
                onChange={e => setClosingMessage(e.target.value)}
                placeholder="Thank you message displayed after successful submission."
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Optional Constraints (Start, End, Max Responses) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  End Date (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Response Cap
                </label>
                <input
                  type="number"
                  min={1}
                  value={maxResponses}
                  onChange={e => setMaxResponses(e.target.value)}
                  placeholder="e.g. 250"
                  className="w-full text-xs rounded-lg border border-slate-300 px-3 py-1.5 text-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Review Immutable Snapshot */}
        {activeStep === 'review_items' && (
          <div className="space-y-4">
            <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-lg text-xs text-indigo-950 flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Immutable Measurement Snapshot Principle:</span>
                Publishing copies all measurement items and response scale options from approved version{' '}
                <span className="font-bold">v{latestApprovedVersion?.versionNumber || '1.0'}</span> into a standalone, permanently locked snapshot. Subsequent edits to the draft instrument will never alter this version.
              </div>
            </div>

            {/* Item List Preview */}
            <div className="border border-slate-200 rounded-lg overflow-hidden divide-y divide-slate-100 max-h-72 overflow-y-auto">
              {itemsToSnapshot.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No items in approved snapshot.
                </div>
              ) : (
                itemsToSnapshot.map((item, idx) => {
                  const scale = item.responseScaleId ? scalesMap.get(item.responseScaleId) : undefined;

                  return (
                    <div key={item.id} className="p-3 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                            #{idx + 1} • {item.itemCode}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {item.itemType}
                          </span>
                          {item.reverseCoded && (
                            <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Reverse Coded
                            </span>
                          )}
                          {item.required && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded">
                              Required
                            </span>
                          )}
                        </div>

                        <span className="text-[11px] text-slate-500 truncate max-w-xs">
                          {scale ? `${scale.name} (${scale.options.length} options)` : 'No scale'}
                        </span>
                      </div>

                      <p className="text-xs text-slate-900 font-medium">{item.questionText}</p>

                      {scale && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {scale.options.map(opt => (
                            <span
                              key={opt.value}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200"
                            >
                              {opt.value}: {opt.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Optional Release Notes */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Version Release Notes (Audit Provenance)
              </label>
              <input
                type="text"
                value={approvalNotes}
                onChange={e => setApprovalNotes(e.target.value)}
                placeholder="e.g. Official Phase 3 launch release for semester survey"
                className="w-full text-xs rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {activeStep === 'settings' ? (
              <button
                type="button"
                onClick={() => setActiveStep('review_items')}
                disabled={!isSelectedApproved}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs"
              >
                <span>Inspect Snapshot Items</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setActiveStep('settings')}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Back to Settings
                </button>
                <button
                  type="button"
                  id="btn-confirm-publish-questionnaire"
                  onClick={handleSubmitAndPublish}
                  disabled={submitting || !isSelectedApproved || itemsToSnapshot.length === 0}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-2xs"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{submitting ? 'Publishing Version...' : 'Publish & Lock Version'}</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
