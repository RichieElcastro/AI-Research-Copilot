import React, { useState } from 'react';
import {
  X,
  Eye,
  Sliders,
  RotateCw,
  CheckCircle2,
  Info,
  Layers,
  Sparkles,
  HelpCircle,
  Tag,
} from 'lucide-react';
import { Instrument, InstrumentItem, ResponseScale, Variable } from '../../types';

interface QuestionnairePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  instrument: Instrument;
  variables: Variable[];
  scales: ResponseScale[];
}

export const QuestionnairePreviewModal: React.FC<QuestionnairePreviewModalProps> = ({
  isOpen,
  onClose,
  instrument,
  variables,
  scales,
}) => {
  const [showInspector, setShowInspector] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});

  if (!isOpen) return null;

  const items = instrument.items || [];
  const scalesMap = new Map(scales.map(s => [s.id, s]));
  const varsMap = new Map(variables.map(v => [v.id, v]));

  const handleSelectAnswer = (itemId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [itemId]: value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">{instrument.name}</h2>
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                  {instrument.code} v{instrument.version}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Participant Survey Simulation • Clean Form View
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Inspector Toggle */}
            <button
              type="button"
              onClick={() => setShowInspector(!showInspector)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors border ${
                showInspector
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Inspector {showInspector ? 'ON' : 'OFF'}</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Informational Banner */}
        <div className="px-6 py-2.5 bg-amber-50 border-b border-amber-100 text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 flex-shrink-0" />
            <span>
              <strong>Researcher Preview Simulation:</strong> Test item readability, ordering, and response scales.
              Participant data is not recorded or transmitted.
            </span>
          </div>
          <span className="text-[11px] font-semibold text-amber-700">
            {items.length} {items.length === 1 ? 'Item' : 'Items'}
          </span>
        </div>

        {/* Questionnaire Form Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/40">
          {/* Instrument Intro Card */}
          <div className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
            <h3 className="text-base font-bold text-slate-900">{instrument.name}</h3>
            {instrument.purpose && (
              <p className="text-xs text-slate-600 italic">
                {instrument.purpose}
              </p>
            )}
            {instrument.description && (
              <p className="text-xs text-slate-500 leading-relaxed">
                {instrument.description}
              </p>
            )}
            <div className="pt-2 border-t border-slate-100 text-[11px] text-slate-400">
              Please read each statement carefully and select the response option that best describes your experience.
            </div>
          </div>

          {/* Items List */}
          {items.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <FileQuestionIcon className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No items in this instrument yet.</p>
              <p className="text-xs text-slate-400 mt-1">Add items using the Instrument Builder to see them in this preview.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, idx) => {
                const scale = item.responseScaleId ? scalesMap.get(item.responseScaleId) : undefined;
                const mappedVar = varsMap.get(item.variableId);
                const mappedDim = mappedVar?.dimensions.find(d => d.id === item.dimensionId);
                const mappedInd = mappedDim?.indicators.find(i => i.id === item.indicatorId);
                const selectedVal = answers[item.id];

                return (
                  <div
                    key={item.id}
                    className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs hover:border-indigo-200 transition-all space-y-3"
                  >
                    {/* Item Question Statement */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {idx + 1}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                            {item.questionText}
                            {item.required && <span className="text-rose-500 ml-1 font-bold">*</span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {item.itemCode}
                        </span>
                      </div>
                    </div>

                    {/* Inspector Details (if toggled) */}
                    {showInspector && (
                      <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                          <Tag className="w-3 h-3" />
                          Construct: {mappedVar?.name || 'Unassigned'} ({mappedVar?.code})
                        </span>

                        {mappedDim && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Dim: {mappedDim.name}
                          </span>
                        )}

                        {mappedInd && (
                          <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                            Ind: {mappedInd.name}
                          </span>
                        )}

                        {item.reverseCoded && (
                          <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <RotateCw className="w-3 h-3" />
                            Reverse Coded
                          </span>
                        )}

                        {scale && (
                          <span className="text-slate-500">
                            Scale: {scale.name} ({scale.minValue}–{scale.maxValue})
                          </span>
                        )}
                      </div>
                    )}

                    {/* Scale Response Options */}
                    {scale ? (
                      <div className="pt-1 flex flex-wrap gap-2">
                        {scale.options.map(opt => {
                          const isSelected = selectedVal === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => handleSelectAnswer(item.id, opt.value)}
                              className={`px-3.5 py-2 rounded-lg text-xs font-medium border flex items-center gap-2 transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-indigo-300'
                              }`}
                            >
                              <div
                                className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${
                                  isSelected ? 'border-white bg-white' : 'border-slate-300'
                                }`}
                              >
                                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-indigo-600" />}
                              </div>
                              <span>{opt.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="pt-2 text-xs text-slate-400 italic">
                        [No response scale attached to this item]
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Previewing: <strong>{instrument.name}</strong> • Status: {instrument.status}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Close Preview
          </button>
        </div>
      </div>
    </div>
  );
};

const FileQuestionIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
