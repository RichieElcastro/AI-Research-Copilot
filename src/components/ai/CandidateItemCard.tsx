import React, { useState } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Edit3,
  AlertTriangle,
  RotateCcw,
  Check,
  Info,
  Copy,
} from 'lucide-react';
import { AIGeneratedItem } from '../../types';

interface CandidateItemCardProps {
  candidate: AIGeneratedItem;
  isSelected: boolean;
  scaleLabel?: string;
  onSelectToggle: () => void;
  onAccept: (candidateId: string) => void;
  onEdit: (candidateId: string, newText: string, reverseCoded: boolean) => void;
  onReject: (candidateId: string) => void;
}

export const CandidateItemCard: React.FC<CandidateItemCardProps> = ({
  candidate,
  isSelected,
  scaleLabel,
  onSelectToggle,
  onAccept,
  onEdit,
  onReject,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedText, setEditedText] = useState(candidate.finalText || candidate.questionText);
  const [editedReverse, setEditedReverse] = useState(candidate.reverseCoded);

  const isAccepted = candidate.status === 'AddedToInstrument';
  const isRejected = candidate.status === 'Rejected';
  const isModified = candidate.modifiedByResearcher;

  const handleSaveEdit = () => {
    if (!editedText.trim()) return;
    onEdit(candidate.id, editedText.trim(), editedReverse);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditedText(candidate.finalText || candidate.questionText);
    setEditedReverse(candidate.reverseCoded);
    setIsEditing(false);
  };

  return (
    <div
      id={`ai-candidate-card-${candidate.id}`}
      className={`border rounded-lg p-4 transition-all ${
        isAccepted
          ? 'bg-emerald-50/60 border-emerald-300'
          : isRejected
          ? 'bg-slate-50/80 border-slate-200 opacity-60'
          : isSelected
          ? 'bg-indigo-50/40 border-indigo-400 shadow-xs'
          : 'bg-white border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {!isAccepted && !isRejected && (
            <input
              type="checkbox"
              id={`candidate-select-${candidate.id}`}
              checked={isSelected}
              onChange={onSelectToggle}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
          )}

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">
            <Sparkles className="w-3 h-3" />
            AI Candidate
          </span>

          {isModified && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
              <Edit3 className="w-2.5 h-2.5" />
              Edited by Researcher
            </span>
          )}

          {candidate.reverseCoded ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
              Reverse-Coded (Inverted)
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700">
              Direct
            </span>
          )}

          {candidate.generationMetadata?.isDemo && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200">
              Demo Generator
            </span>
          )}
        </div>

        {/* Status indicator */}
        <div>
          {isAccepted && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Added to Instrument
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-200 text-slate-700">
              <XCircle className="w-3.5 h-3.5" />
              Rejected
            </span>
          )}
        </div>
      </div>

      {/* Main Question Text Area / Edit mode */}
      {isEditing ? (
        <div className="space-y-3 my-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Researcher Revisions
            </label>
            <textarea
              id={`candidate-textarea-${candidate.id}`}
              value={editedText}
              onChange={(e) => setEditedText(e.target.value)}
              rows={2}
              className="w-full text-sm border border-indigo-300 rounded-md p-2 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 bg-white"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                checked={editedReverse}
                onChange={(e) => setEditedReverse(e.target.checked)}
                className="h-3.5 w-3.5 text-indigo-600 rounded border-slate-300"
              />
              Mark as Reverse-Coded (Negatively Keyed)
            </label>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
              >
                Save Edits
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="my-2">
          <p className="text-sm font-medium text-slate-900 leading-relaxed">
            "{candidate.finalText || candidate.questionText}"
          </p>

          {/* Original prompt comparison if edited */}
          {candidate.modifiedByResearcher && candidate.originalText !== candidate.finalText && (
            <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded text-xs text-slate-600">
              <span className="font-medium text-slate-500">Original AI text: </span>
              <span className="italic">"{candidate.originalText}"</span>
            </div>
          )}
        </div>
      )}

      {/* Duplicate warning alert if detected */}
      {candidate.duplicateWarning && (
        <div className="mt-2 flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <Copy className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600" />
          <span>{candidate.duplicateWarning}</span>
        </div>
      )}

      {/* Quality notes & Potential issues */}
      {(candidate.potentialIssues.length > 0 || candidate.qualityFlags.length > 0) && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1 text-xs">
          {candidate.potentialIssues.map((issue, i) => (
            <div key={i} className="flex items-start gap-1.5 text-amber-700">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
              <span>{issue}</span>
            </div>
          ))}

          {candidate.qualityFlags.slice(0, 1).map((flag, i) => (
            <div key={i} className="flex items-start gap-1.5 text-slate-500">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" />
              <span>{flag}</span>
            </div>
          ))}
        </div>
      )}

      {/* Action Footer */}
      {!isAccepted && !isRejected && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div className="text-[11px] text-slate-500">
            {scaleLabel ? `Target Scale: ${scaleLabel}` : 'Scale: Likert'}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id={`reject-btn-${candidate.id}`}
              onClick={() => onReject(candidate.id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-600 hover:text-red-700 hover:bg-red-50 rounded border border-transparent transition"
              title="Reject and archive candidate"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </button>

            <button
              type="button"
              id={`edit-btn-${candidate.id}`}
              onClick={() => setIsEditing(!isEditing)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100 rounded border border-slate-200 transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>

            <button
              type="button"
              id={`accept-btn-${candidate.id}`}
              onClick={() => onAccept(candidate.id)}
              className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs transition"
            >
              <Check className="w-3.5 h-3.5" />
              Accept as Draft Item
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
