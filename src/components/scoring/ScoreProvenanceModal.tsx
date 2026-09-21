import React from 'react';
import { X, ShieldCheck, ArrowRight, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { ProcessedRecord, ScoredRecord, ScoringRule } from '../../types';

interface ScoreProvenanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  scoredRecord: ScoredRecord | null;
  processedRecord: ProcessedRecord | null;
  rules: ScoringRule[];
}

export const ScoreProvenanceModal: React.FC<ScoreProvenanceModalProps> = ({
  isOpen,
  onClose,
  scoredRecord,
  processedRecord,
  rules,
}) => {
  if (!isOpen || !scoredRecord) return null;

  const scoreKeys = Object.keys(scoredRecord.scores);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Score Provenance &amp; Multi-Layer Lineage</h3>
              <p className="text-xs text-slate-500">
                Participant Record: <span className="font-mono font-bold text-slate-700">{scoredRecord.participantIdentifier || scoredRecord.sourceSubmissionId.substring(0, 10)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Multi-Layer Pipeline Architecture Lineage */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Layer 1</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Immutable
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800">Raw Survey Submission</p>
              <p className="text-[11px] font-mono text-slate-500 truncate mt-1">
                ID: {scoredRecord.sourceSubmissionId}
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Layer 2</span>
                <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Immutable
                </span>
              </div>
              <p className="text-xs font-bold text-slate-800">Data Processing Run</p>
              <p className="text-[11px] font-mono text-slate-500 truncate mt-1">
                ID: {scoredRecord.processingRunId}
              </p>
            </div>

            <div className="p-3.5 bg-indigo-50/60 border border-indigo-200 rounded-xl">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-700">Layer 3 (Active)</span>
                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded">
                  Derived
                </span>
              </div>
              <p className="text-xs font-bold text-indigo-950">Scoring Engine Run</p>
              <p className="text-[11px] font-mono text-indigo-700 truncate mt-1">
                ID: {scoredRecord.scoringRunId}
              </p>
            </div>
          </div>

          {/* Detailed Score Breakdown by Target */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Construct &amp; Dimension Calculations ({scoreKeys.length} Targets)
            </h4>

            <div className="space-y-3">
              {scoreKeys.map(targetCode => {
                const meta = scoredRecord.scoreMetadata[targetCode];
                const rule = rules.find(r => r.targetCode === targetCode);
                const scoreVal = scoredRecord.scores[targetCode];

                return (
                  <div
                    key={targetCode}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-3"
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                          {targetCode}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {meta?.targetName || targetCode}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {meta?.targetType || 'Dimension'}
                        </span>
                        <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          Method: {meta?.method || 'MEAN'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500 font-medium">Final Score:</span>
                        {scoreVal !== null ? (
                          <span className="text-base font-bold font-mono text-indigo-700 px-3 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200">
                            {typeof scoreVal === 'number' ? scoreVal.toFixed(4) : scoreVal}
                          </span>
                        ) : (
                          <span className="text-xs font-bold text-amber-700 px-2.5 py-1 rounded bg-amber-50 border border-amber-200">
                            MISSING (null)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Rule Summary & Missing Policy */}
                    <div className="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                      <div>
                        <span className="font-semibold text-slate-700">Formula: </span>
                        <span>{meta?.formulaSummary || 'Deterministic aggregation'}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                        <span>
                          Valid inputs: <strong className="text-slate-800">{meta?.validItemCount}</strong> / {meta?.totalSourceItems}
                        </span>
                        <span>
                          Missing inputs: <strong className="text-slate-800">{meta?.missingItemCount}</strong>
                        </span>
                        <span>
                          Policy: <strong className="text-slate-800">{meta?.missingValuePolicy}</strong>
                        </span>
                        {meta?.flagReason && (
                          <span className="text-amber-700 font-medium">
                            Flag: {meta.flagReason}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Source Items Trace Table */}
                    {meta?.sourceValues && Object.keys(meta.sourceValues).length > 0 && (
                      <div>
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                          Source Input Tracing (Layer 2 Values)
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                          {Object.entries(meta.sourceValues).map(([code, val]) => {
                            const isMissing = val === null || val === undefined;
                            return (
                              <div
                                key={code}
                                className={`p-2 rounded-lg border text-center ${
                                  isMissing
                                    ? 'bg-amber-50/50 border-amber-200 text-amber-900'
                                    : 'bg-white border-slate-200 text-slate-800'
                                }`}
                              >
                                <div className="text-[10px] font-mono text-slate-500 font-semibold">{code}</div>
                                <div className={`text-xs font-mono font-bold mt-0.5 ${isMissing ? 'text-amber-700' : 'text-slate-900'}`}>
                                  {isMissing ? 'Missing' : String(val)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
