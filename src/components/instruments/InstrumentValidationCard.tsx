import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  RotateCw,
  Sparkles,
  ArrowRight,
  Info,
} from 'lucide-react';
import { Instrument, InstrumentValidationReport } from '../../types';

interface InstrumentValidationCardProps {
  instrument: Instrument;
  report: InstrumentValidationReport | null;
  onApprove: (notes?: string) => void;
  onBranchVersion: () => void;
  isApproving?: boolean;
}

export const InstrumentValidationCard: React.FC<InstrumentValidationCardProps> = ({
  instrument,
  report,
  onApprove,
  onBranchVersion,
  isApproving,
}) => {
  const [approvalNotes, setApprovalNotes] = useState('');
  const [showNotesInput, setShowNotesInput] = useState(false);

  if (!report) return null;

  const isApproved = instrument.status === 'Approved';
  const isArchived = instrument.status === 'Archived';
  const { summary, errors, warnings, isValidForApproval } = report;

  const handleApproveClick = () => {
    if (!showNotesInput) {
      setShowNotesInput(true);
    } else {
      onApprove(approvalNotes.trim() || undefined);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isApproved
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : isValidForApproval
                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                : 'bg-rose-50 text-rose-700 border border-rose-200'
            }`}
          >
            {isApproved ? (
              <ShieldCheck className="w-5 h-5" />
            ) : isValidForApproval ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <XCircle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-900">Measurement Model Integrity Audit</h4>
            <p className="text-xs text-slate-500">
              {isApproved
                ? 'Instrument is officially approved and locked for empirical reproducibility.'
                : isValidForApproval
                ? 'All validation checks passed. Instrument is eligible for formal approval.'
                : 'Validation errors detected. Fix issues before approving the instrument.'}
            </p>
          </div>
        </div>

        <div>
          {isApproved ? (
            <button
              type="button"
              onClick={onBranchVersion}
              className="px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Branch New Version (v{(parseFloat(instrument.version) + 1.0).toFixed(1)})
            </button>
          ) : (
            <div className="flex items-center gap-2">
              {isValidForApproval && (
                <button
                  type="button"
                  onClick={handleApproveClick}
                  disabled={isApproving}
                  className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {showNotesInput ? 'Confirm & Lock Approval' : 'Approve Instrument'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Approval Notes Input (if triggered) */}
      {showNotesInput && !isApproved && (
        <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 space-y-2">
          <label className="block text-xs font-bold text-emerald-900">
            Approval Sign-off Notes (Optional):
          </label>
          <input
            type="text"
            value={approvalNotes}
            onChange={e => setApprovalNotes(e.target.value)}
            placeholder="e.g. Peer reviewed by methodology committee; psychometric pilot approved."
            className="w-full px-3 py-1.5 text-xs border border-emerald-300 rounded-lg bg-white"
          />
          <span className="text-[11px] text-emerald-700 block">
            Approving locks this version snapshot (v{instrument.version}) into the immutable audit record.
          </span>
        </div>
      )}

      {/* Summary Checklist */}
      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 border-b border-slate-100 bg-slate-50/30 text-xs">
        <ChecklistBadge label="Metadata" passed={summary.hasMetadata} />
        <ChecklistBadge label="Variables Mapped" passed={summary.hasVariables} />
        <ChecklistBadge label={`Items (${summary.itemCount})`} passed={summary.itemCount > 0} />
        <ChecklistBadge label="Scales Configured" passed={summary.scalesConfigured} />
        <ChecklistBadge label="Coding Valid" passed={summary.codingValid} />
        <ChecklistBadge
          label="Indicator Coverage"
          passed={summary.indicatorsMapped}
          isWarning={!summary.indicatorsMapped}
        />
      </div>

      {/* Error & Warning Lists */}
      <div className="p-4 space-y-3">
        {errors.length > 0 && (
          <div className="space-y-1.5">
            <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
              <XCircle className="w-3.5 h-3.5 text-rose-600" />
              Blocking Errors ({errors.length})
            </h5>
            <div className="space-y-1">
              {errors.map((err, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2"
                >
                  <span className="font-bold">•</span>
                  <span>{err.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-1.5">
            <h5 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              Methodological Advisory ({warnings.length})
            </h5>
            <div className="space-y-1">
              {warnings.map((warn, i) => (
                <div
                  key={i}
                  className="p-2 rounded-lg bg-amber-50/70 border border-amber-200 text-xs text-amber-800 flex items-start gap-2"
                >
                  <span className="font-bold">•</span>
                  <span>{warn.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {errors.length === 0 && warnings.length === 0 && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              Zero validation warnings or errors detected. This instrument meets all rigorous quantitative research criteria.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const ChecklistBadge = ({
  label,
  passed,
  isWarning,
}: {
  label: string;
  passed: boolean;
  isWarning?: boolean;
}) => {
  return (
    <div
      className={`p-2 rounded-lg border text-center flex flex-col items-center justify-center gap-1 ${
        passed
          ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
          : isWarning
          ? 'bg-amber-50/60 border-amber-200 text-amber-900'
          : 'bg-rose-50/60 border-rose-200 text-rose-900'
      }`}
    >
      <div className="flex items-center gap-1">
        {passed ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
        ) : isWarning ? (
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <XCircle className="w-3.5 h-3.5 text-rose-600" />
        )}
        <span className="font-semibold text-[11px] truncate">{label}</span>
      </div>
    </div>
  );
};
