import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, Terminal, Code2, Database, ShieldCheck } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface AIReadinessModalProps {
  isOpen: boolean;
  onClose: () => void;
  contextPayload: any;
  instrumentName: string;
}

export const AIReadinessModal: React.FC<AIReadinessModalProps> = ({
  isOpen,
  onClose,
  contextPayload,
  instrumentName,
}) => {
  const { success } = useToast();
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const jsonStr = JSON.stringify(contextPayload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonStr);
    setCopied(true);
    success('Copied to Clipboard', 'Structured AI Questionnaire Context copied.');
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 text-purple-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">AI Generator Context Handshake</h2>
              <p className="text-xs text-slate-500">
                Phase 2 → Phase 3 Semantic Context for Transparent Questionnaire Generation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informational Box */}
        <div className="p-4 bg-purple-50/70 border-b border-purple-100 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-purple-900 leading-relaxed">
            <strong>Zero "Black-Box" Prompts Principle:</strong> In Phase 3, the AI Questionnaire Generator will never
            invent items from thin air. It consumes this deterministic schema containing project goals, target populations,
            operationalized variables, empirical dimensions, and verified response scales.
          </div>
        </div>

        {/* JSON Content */}
        <div className="p-6 overflow-y-auto flex-1 bg-slate-900 text-slate-200 font-mono text-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800 text-[11px] text-slate-400">
            <span>Payload: {contextPayload?.manifestType || 'AI_CONTEXT'}</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy JSON'}</span>
            </button>
          </div>
          <pre className="overflow-x-auto whitespace-pre-wrap">{jsonStr}</pre>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Exported for: <strong>{instrumentName}</strong>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
