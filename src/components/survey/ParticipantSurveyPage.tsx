import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  Send,
  FileQuestion,
  Info,
  HelpCircle,
} from 'lucide-react';
import {
  PublicQuestionnaireDTO,
  QuestionnaireItemSnapshot,
  SurveySubmission,
} from '../../types';
import { submissionService, StartSurveySessionResult } from '../../services/submissionService';

interface ParticipantSurveyPageProps {
  publicSlug: string;
  onExit?: () => void;
}

type Step = 'intro' | 'consent' | 'questions' | 'review' | 'confirmed';

export const ParticipantSurveyPage: React.FC<ParticipantSurveyPageProps> = ({
  publicSlug,
  onExit,
}) => {
  const [step, setStep] = useState<Step>('intro');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Session state
  const [sessionData, setSessionData] = useState<StartSurveySessionResult | null>(null);
  const [consentChecked, setConsentChecked] = useState(false);
  const [participantIdentifier, setParticipantIdentifier] = useState('');

  // Raw participant responses: itemCode -> raw answer string
  const [rawResponses, setRawResponses] = useState<Record<string, string>>({});
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});

  // Submitting state & result
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<SurveySubmission | null>(null);

  // Initialize session
  useEffect(() => {
    setLoading(true);
    setLoadError(null);

    const res = submissionService.startSession(publicSlug);
    if (!res.success || !res.data) {
      setLoadError(res.error || 'Failed to initialize survey session.');
      setLoading(false);
      return;
    }

    setSessionData(res.data);
    setLoading(false);
  }, [publicSlug]);

  const questionnaire: PublicQuestionnaireDTO | undefined = sessionData?.questionnaire;
  const items: QuestionnaireItemSnapshot[] = questionnaire?.items || [];

  // Handle single question raw answer
  const handleResponseChange = (itemCode: string, rawVal: string) => {
    setRawResponses(prev => ({
      ...prev,
      [itemCode]: rawVal,
    }));

    // Clear error for this question if it was flagged
    if (clientErrors[itemCode]) {
      setClientErrors(prev => {
        const copy = { ...prev };
        delete copy[itemCode];
        return copy;
      });
    }
  };

  // Validate responses client-side before proceeding to review or submission
  const validateQuestions = (): boolean => {
    const errors: Record<string, string> = {};

    if (questionnaire?.responseMode === 'identified' && !participantIdentifier.trim()) {
      errors['participantIdentifier'] = 'Please provide your participant identifier.';
    }

    for (const item of items) {
      const val = rawResponses[item.itemCode];
      const isProvided = val !== undefined && val !== null && val.trim() !== '';

      if (item.required && !isProvided) {
        errors[item.itemCode] = 'This question is required.';
        continue;
      }

      if (isProvided && item.itemType === 'Numeric') {
        const n = Number(val.trim());
        if (isNaN(n)) {
          errors[item.itemCode] = 'Please enter a valid numeric value.';
        }
      }
    }

    setClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProceedToQuestions = () => {
    if (!consentChecked) return;
    setStep('questions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToReview = () => {
    if (!validateQuestions()) {
      // Scroll to the first error
      window.scrollTo({ top: 150, behavior: 'smooth' });
      return;
    }
    setStep('review');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = () => {
    if (!sessionData || !questionnaire) return;
    if (!validateQuestions()) {
      setStep('questions');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    const submitRes = submissionService.submit({
      questionnaireId: questionnaire.id,
      questionnaireVersionId: sessionData.questionnaireVersionId,
      sessionId: sessionData.sessionId,
      startedAt: sessionData.startedAt,
      consentGiven: true,
      participantIdentifier:
        questionnaire.responseMode === 'identified' ? participantIdentifier.trim() : undefined,
      rawResponses,
    });

    if (!submitRes.success || !submitRes.data) {
      setSubmitError(submitRes.error || 'Submission was rejected by validation engine.');
      setIsSubmitting(false);
      return;
    }

    setSubmittedResult(submitRes.data);
    setIsSubmitting(false);
    setStep('confirmed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto animate-pulse">
            <FileQuestion className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Loading Survey</h2>
          <p className="text-xs text-slate-500">
            Resolving questionnaire version snapshot and initializing participant session...
          </p>
        </div>
      </div>
    );
  }

  // 2. Error / Unavailable State
  if (loadError || !questionnaire) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 max-w-md w-full text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Survey Unavailable</h2>
          <p className="text-xs text-slate-600 leading-relaxed">{loadError}</p>
          {onExit && (
            <button
              type="button"
              onClick={onExit}
              className="mt-4 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Return to Platform
            </button>
          )}
        </div>
      </div>
    );
  }

  // Calculate progress
  const answeredCount = items.filter(
    item => rawResponses[item.itemCode] !== undefined && rawResponses[item.itemCode].trim() !== ''
  ).length;
  const progressPercent = items.length > 0 ? Math.round((answeredCount / items.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans antialiased selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Banner with Clean Academic Identity (No internal IDs, no researcher ownership) */}
      <header className="bg-white border-b border-slate-200 py-3.5 px-4 sm:px-8 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-sm">
              <FileQuestion className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                {questionnaire.title}
              </h1>
              <span className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <span>Quantitative Empirical Research Survey</span>
                <span>•</span>
                <span className="capitalize">{questionnaire.responseMode} Response</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {step === 'questions' && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>
                  {answeredCount} of {items.length} answered
                </span>
                <div className="w-20 bg-slate-200 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
            {onExit && (
              <button
                type="button"
                onClick={onExit}
                className="text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                Exit Survey
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* STEP 1: INTRODUCTION */}
        {step === 'intro' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                Participant Briefing
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">{questionnaire.title}</h2>
              <p className="text-xs text-slate-500 mt-1">
                Please take a few moments to review this study before proceeding.
              </p>
            </div>

            <div className="prose prose-sm text-xs text-slate-700 leading-relaxed space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Study Introduction
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 whitespace-pre-line text-slate-700">
                {questionnaire.introduction ||
                  'Thank you for your interest in participating in this empirical research study.'}
              </div>
            </div>

            <div className="bg-indigo-50/70 border border-indigo-100 rounded-xl p-4 flex items-start gap-3 text-xs text-indigo-950">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Participation Details</p>
                <ul className="list-disc list-inside space-y-0.5 text-indigo-900">
                  <li>Total questions: <strong>{items.length} items</strong></li>
                  <li>
                    Response mode:{' '}
                    <strong>
                      {questionnaire.responseMode === 'anonymous'
                        ? 'Completely Anonymous (no identifying personal info collected)'
                        : 'Identified (assigned participant identifier requested)'}
                    </strong>
                  </li>
                  <li>Estimated completion time: ~3–5 minutes</li>
                </ul>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                id="btn-intro-continue"
                onClick={() => setStep('consent')}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-2"
              >
                <span>Proceed to Informed Consent</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: INFORMED CONSENT */}
        {step === 'consent' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                  Ethical Review
                </span>
                <h2 className="text-xl font-bold text-slate-900 mt-2">Informed Consent Statement</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Voluntary participation statement and participant rights.
                </p>
              </div>
              <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 max-h-72 overflow-y-auto space-y-3 text-xs text-slate-700 leading-relaxed">
              <p className="font-bold text-slate-900">Consent &amp; Voluntary Participation Terms</p>
              <div className="whitespace-pre-line text-slate-700">
                {questionnaire.consentStatement ||
                  'Your participation in this research study is entirely voluntary. You may withdraw at any point prior to submitting your responses without any penalty. All submitted data will be strictly preserved as submitted for empirical analysis.'}
              </div>
            </div>

            {/* Response Mode: Identifier Input if identified */}
            {questionnaire.responseMode === 'identified' && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 text-xs">
                <label
                  htmlFor="participant-id-field"
                  className="font-bold text-amber-950 block"
                >
                  Participant Identifier <span className="text-rose-600">*</span>
                </label>
                <p className="text-amber-800">
                  This study is configured in <strong>Identified Mode</strong>. Please enter your designated participant code or student number.
                </p>
                <input
                  type="text"
                  id="participant-id-field"
                  value={participantIdentifier}
                  onChange={e => setParticipantIdentifier(e.target.value)}
                  placeholder="e.g. PARTICIPANT-042 or STUDENT-ID"
                  className="w-full bg-white border border-amber-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {clientErrors['participantIdentifier'] && (
                  <p className="text-rose-600 font-semibold text-[11px]">
                    {clientErrors['participantIdentifier']}
                  </p>
                )}
              </div>
            )}

            {/* Explicit Consent Checkbox */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <label
                htmlFor="chk-participant-consent"
                className="flex items-start gap-3 cursor-pointer select-none"
              >
                <input
                  type="checkbox"
                  id="chk-participant-consent"
                  checked={consentChecked}
                  onChange={e => setConsentChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-xs text-slate-800 leading-normal font-medium">
                  I have read and understood the information above. I confirm that I meet the criteria for this study, understand my responses will be recorded as raw data, and voluntarily agree to participate.
                </span>
              </label>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('intro')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to Briefing</span>
              </button>

              <button
                type="button"
                id="btn-consent-agree"
                disabled={
                  !consentChecked ||
                  (questionnaire.responseMode === 'identified' && !participantIdentifier.trim())
                }
                onClick={handleProceedToQuestions}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition-colors shadow-2xs inline-flex items-center gap-2"
              >
                <span>I Agree — Begin Survey</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: SURVEY QUESTIONS (Rendered exclusively from QuestionnaireVersion snapshot) */}
        {step === 'questions' && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-800">Survey Items:</span>
                <span className="text-slate-500">
                  Please respond to each item honestly based on your experience.
                </span>
              </div>
              <span className="text-slate-400 font-mono text-[11px]">
                {answeredCount} / {items.length} Completed
              </span>
            </div>

            {/* List of Questions */}
            <div className="space-y-5">
              {items.map(item => {
                const currentVal = rawResponses[item.itemCode] ?? '';
                const hasError = !!clientErrors[item.itemCode];

                return (
                  <div
                    key={item.id}
                    id={`survey-item-${item.itemCode}`}
                    className={`bg-white rounded-2xl border p-5 sm:p-6 shadow-2xs transition-all ${
                      hasError
                        ? 'border-rose-300 ring-1 ring-rose-200'
                        : currentVal
                        ? 'border-indigo-100'
                        : 'border-slate-200'
                    }`}
                  >
                    {/* Header with question number (NOTE: No construct, variable, dimension, or reverse-coding labels!) */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {item.itemNumber}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900 leading-snug">
                            {item.questionText}
                            {item.required && (
                              <span className="text-rose-500 ml-1 font-bold" title="Required">*</span>
                            )}
                          </h3>
                        </div>
                      </div>
                    </div>

                    {/* Response Inputs according to itemType */}
                    <div className="pl-10">
                      {/* 1. Likert & Multiple Choice Scale Options */}
                      {(item.itemType === 'Likert' || item.itemType === 'Multiple Choice') && (
                        <div className="space-y-2">
                          {item.scaleOptions && item.scaleOptions.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                              {item.scaleOptions.map(opt => {
                                const isSelected = currentVal === opt.label;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => handleResponseChange(item.itemCode, opt.label)}
                                    className={`text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all flex items-center gap-2.5 ${
                                      isSelected
                                        ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs'
                                        : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                                    }`}
                                  >
                                    <span
                                      className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                        isSelected
                                          ? 'border-indigo-600 bg-indigo-600'
                                          : 'border-slate-300 bg-white'
                                      }`}
                                    >
                                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                                    </span>
                                    <span>{opt.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="text-xs text-slate-400 italic">No options defined</div>
                          )}
                        </div>
                      )}

                      {/* 2. Yes/No Binary Choice */}
                      {item.itemType === 'Yes/No' && (
                        <div className="flex items-center gap-3">
                          {['Yes', 'No'].map(choice => {
                            const isSelected = currentVal.toLowerCase() === choice.toLowerCase();
                            return (
                              <button
                                key={choice}
                                type="button"
                                onClick={() => handleResponseChange(item.itemCode, choice)}
                                className={`px-6 py-2 rounded-xl border text-xs font-semibold transition-all ${
                                  isSelected
                                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                                    : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-700'
                                }`}
                              >
                                {choice}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* 3. Numeric Input */}
                      {item.itemType === 'Numeric' && (
                        <div className="max-w-xs">
                          <input
                            type="number"
                            value={currentVal}
                            onChange={e => handleResponseChange(item.itemCode, e.target.value)}
                            placeholder="Enter numeric response"
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}

                      {/* 4. Short Text Input */}
                      {item.itemType === 'Short Text' && (
                        <div className="w-full">
                          <textarea
                            rows={2}
                            value={currentVal}
                            onChange={e => handleResponseChange(item.itemCode, e.target.value)}
                            placeholder="Enter your response..."
                            className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                          />
                        </div>
                      )}

                      {/* Error Message */}
                      {hasError && (
                        <p className="mt-2 text-[11px] font-semibold text-rose-600 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>{clientErrors[item.itemCode]}</span>
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Actions */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs flex items-center justify-between">
              <button
                type="button"
                onClick={() => setStep('consent')}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="button"
                id="btn-questions-review"
                onClick={handleProceedToReview}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-2"
              >
                <span>Review Responses</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: REVIEW & SUBMIT */}
        {step === 'review' && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-6 sm:p-8 space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded">
                Final Review
              </span>
              <h2 className="text-xl font-bold text-slate-900 mt-2">Review Your Responses</h2>
              <p className="text-xs text-slate-500 mt-1">
                Please verify your responses before final submission. Once submitted, raw data cannot be changed.
              </p>
            </div>

            {/* Submission Error Banner */}
            {submitError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">Submission Rejected by Server Verification</p>
                  <p className="text-rose-800">{submitError}</p>
                </div>
              </div>
            )}

            {/* Responses Summary Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 text-left font-semibold w-12">#</th>
                    <th className="py-2.5 px-3 text-left font-semibold">Question</th>
                    <th className="py-2.5 px-3 text-left font-semibold w-40">Your Answer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map(item => {
                    const rawVal = rawResponses[item.itemCode];
                    return (
                      <tr key={item.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-3 font-mono font-medium text-slate-500">
                          {item.itemNumber}
                        </td>
                        <td className="py-2.5 px-3 text-slate-800">{item.questionText}</td>
                        <td className="py-2.5 px-3">
                          {rawVal ? (
                            <span className="font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded inline-block">
                              {rawVal}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Unanswered</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Protection Notice */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-3 text-xs text-slate-600">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>
                Your responses will be recorded as an immutable raw participant submission. Duplicate submission protection is active for this session.
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setStep('questions')}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Modify Answers</span>
              </button>

              <button
                type="button"
                id="btn-final-submit"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-2"
              >
                {isSubmitting ? (
                  <span>Recording Raw Submission...</span>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    <span>Confirm &amp; Submit Responses</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: CONFIRMATION */}
        {step === 'confirmed' && submittedResult && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs p-8 text-center space-y-6">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                Submission Recorded
              </span>
              <h2 className="text-2xl font-bold text-slate-900">Thank You for Participating!</h2>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                {questionnaire.closingMessage ||
                  'Your responses have been successfully recorded as immutable raw data in the research database.'}
              </p>
            </div>

            {/* Receipt Box */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-w-md mx-auto text-left space-y-2 text-xs">
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500">Submission ID:</span>
                <span className="font-mono text-slate-800 font-semibold">{submittedResult.id}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500">Questionnaire Version:</span>
                <span className="font-mono text-indigo-700 font-semibold">
                  v{submittedResult.questionnaireVersion}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-1.5">
                <span className="text-slate-500">Recorded At:</span>
                <span className="text-slate-800 font-medium">
                  {new Date(submittedResult.submittedAt).toLocaleTimeString()} (
                  {new Date(submittedResult.submittedAt).toLocaleDateString()})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Completion Duration:</span>
                <span className="text-slate-800 font-medium">
                  {submittedResult.durationSeconds} seconds
                </span>
              </div>
            </div>

            {/* Academic Rigor Notice */}
            <p className="text-[11px] text-slate-600 max-w-sm mx-auto">
              Raw response data is preserved exactly as entered. Statistical coding, scoring, and analysis will occur in subsequent research workflow stages.
            </p>

            {onExit && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onExit}
                  className="px-5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors inline-flex items-center gap-1.5"
                >
                  <span>Close Window / Return</span>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Participant Footer */}
      <footer className="border-t border-slate-200 bg-white py-3.5 px-4 text-center text-[11px] text-slate-600 mt-auto">
        <div className="max-w-3xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Quantitative Empirical Research Platform • Raw Participant Data Capture</span>
          <span className="flex items-center gap-1 text-slate-600">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>Deterministic Session Lineage</span>
          </span>
        </div>
      </footer>
    </div>
  );
};
