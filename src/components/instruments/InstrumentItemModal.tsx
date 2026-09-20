import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  AlertCircle,
  HelpCircle,
  Sliders,
  Check,
  RotateCw,
  PlusCircle,
  ArrowRight,
  Eye,
  FileQuestion,
} from 'lucide-react';
import {
  Dimension,
  Indicator,
  Instrument,
  InstrumentItem,
  ItemType,
  ResponseScale,
  Variable,
} from '../../types';
import { scaleService } from '../../services/scaleService';
import { variableService } from '../../services/variableService';
import { useAuth } from '../../context/AuthContext';

interface InstrumentItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    questionText: string;
    itemCode: string;
    itemType: ItemType;
    variableId: string;
    dimensionId?: string;
    indicatorId?: string;
    responseScaleId?: string;
    required?: boolean;
    reverseCoded?: boolean;
    source?: InstrumentItem['source'];
    notes?: string;
  }) => void;
  initialItem?: InstrumentItem | null;
  instrument: Instrument;
  projectId: string;
  onOpenScaleManager?: () => void;
}

export const InstrumentItemModal: React.FC<InstrumentItemModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialItem,
  instrument,
  projectId,
  onOpenScaleManager,
}) => {
  const { currentUser } = useAuth();

  const [questionText, setQuestionText] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [itemType, setItemType] = useState<ItemType>('Likert');
  const [variableId, setVariableId] = useState('');
  const [dimensionId, setDimensionId] = useState<string>('');
  const [indicatorId, setIndicatorId] = useState<string>('');
  const [responseScaleId, setResponseScaleId] = useState<string>('');
  const [required, setRequired] = useState(true);
  const [reverseCoded, setReverseCoded] = useState(false);
  const [source, setSource] = useState<InstrumentItem['source']>('Researcher Created');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [projectVariables, setProjectVariables] = useState<Variable[]>([]);
  const [scales, setScales] = useState<ResponseScale[]>([]);

  // Load project variables and scales
  useEffect(() => {
    if (currentUser && isOpen) {
      const vRes = variableService.getVariables(projectId, currentUser.id);
      if (vRes.success && vRes.data) {
        setProjectVariables(vRes.data);
      }

      const sRes = scaleService.getScales(projectId, currentUser.id);
      if (sRes.success && sRes.data) {
        const activeScales = sRes.data.filter(s => !s.isArchived);
        setScales(activeScales);
        if (!responseScaleId && activeScales.length > 0) {
          setResponseScaleId(activeScales[0].id);
        }
      }
    }
  }, [currentUser, isOpen, projectId]);

  // Filter variables mapped to this instrument
  const mappedVariables = useMemo(() => {
    return projectVariables.filter(v => instrument.variableIds.includes(v.id));
  }, [projectVariables, instrument.variableIds]);

  // Selected variable
  const selectedVariable = useMemo(() => {
    return projectVariables.find(v => v.id === variableId);
  }, [projectVariables, variableId]);

  // Dimensions of selected variable
  const availableDimensions = useMemo(() => {
    return selectedVariable?.dimensions || [];
  }, [selectedVariable]);

  // Selected dimension
  const selectedDimension = useMemo(() => {
    return availableDimensions.find(d => d.id === dimensionId);
  }, [availableDimensions, dimensionId]);

  // Indicators of selected dimension
  const availableIndicators = useMemo(() => {
    return selectedDimension?.indicators || [];
  }, [selectedDimension]);

  // Selected response scale object
  const selectedScale = useMemo(() => {
    return scales.find(s => s.id === responseScaleId);
  }, [scales, responseScaleId]);

  // Auto-generate a proposed code when creating a new item
  useEffect(() => {
    if (initialItem) {
      setQuestionText(initialItem.questionText);
      setItemCode(initialItem.itemCode);
      setItemType(initialItem.itemType);
      setVariableId(initialItem.variableId);
      setDimensionId(initialItem.dimensionId || '');
      setIndicatorId(initialItem.indicatorId || '');
      setResponseScaleId(initialItem.responseScaleId || '');
      setRequired(initialItem.required !== undefined ? initialItem.required : true);
      setReverseCoded(Boolean(initialItem.reverseCoded));
      setSource(initialItem.source || 'Researcher Created');
      setNotes(initialItem.notes || '');
    } else {
      setQuestionText('');
      const defaultVar = mappedVariables[0];
      const nextNum = (instrument.items?.length || 0) + 1;
      const prefix = defaultVar ? defaultVar.code : 'ITEM';
      setItemCode(`${prefix}.${String(nextNum).padStart(2, '0')}`);
      setItemType('Likert');
      setVariableId(defaultVar?.id || '');
      setDimensionId('');
      setIndicatorId('');
      setRequired(true);
      setReverseCoded(false);
      setSource('Researcher Created');
      setNotes('');
    }
    setErrorMsg(null);
  }, [initialItem, isOpen, instrument, mappedVariables]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!questionText.trim() || questionText.trim().length < 3) {
      setErrorMsg('Question prompt text must be at least 3 characters long.');
      return;
    }
    if (!itemCode.trim()) {
      setErrorMsg('Item code is required (e.g. X1.01).');
      return;
    }
    if (!variableId) {
      setErrorMsg('Please select a research construct (variable) for this item.');
      return;
    }
    if (['Likert', 'Multiple Choice', 'Single Choice', 'Yes/No'].includes(itemType) && !responseScaleId) {
      setErrorMsg('A response scale must be assigned for Likert/choice items.');
      return;
    }

    onSubmit({
      questionText: questionText.trim(),
      itemCode: itemCode.trim().toUpperCase(),
      itemType,
      variableId,
      dimensionId: dimensionId || undefined,
      indicatorId: indicatorId || undefined,
      responseScaleId: responseScaleId || undefined,
      required,
      reverseCoded,
      source,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FileQuestion className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {initialItem ? `Edit Item (${initialItem.itemCode})` : 'Add Measurement Item'}
              </h2>
              <p className="text-xs text-slate-500">
                Operationalize construct indicators into empirical survey questionnaire items
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Question Text Prompt */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Question Prompt / Item Statement <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={2}
              value={questionText}
              onChange={e => setQuestionText(e.target.value)}
              placeholder="e.g. I spend more than two hours per day reading alarming social media headlines..."
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
            <span className="text-[10px] text-slate-400">
              Clear, unambiguous empirical prompt presented to respondents.
            </span>
          </div>

          {/* Code, Type, Origin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Item Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={itemCode}
                onChange={e => setItemCode(e.target.value.toUpperCase())}
                placeholder="e.g. X1.01"
                required
                className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">Unique inside instrument</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Format</label>
              <select
                value={itemType}
                onChange={e => setItemType(e.target.value as ItemType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Likert">Likert Scale</option>
                <option value="Multiple Choice">Multiple Choice</option>
                <option value="Single Choice">Single Choice (Radio)</option>
                <option value="Yes/No">Dichotomous (Yes/No)</option>
                <option value="Numeric">Numeric Slider / Value</option>
                <option value="Open Ended">Open Ended (Text)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Item Origin / Source</label>
              <select
                value={source}
                onChange={e => setSource(e.target.value as InstrumentItem['source'])}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Researcher Created">Researcher Created</option>
                <option value="Adapted">Adapted from Scale</option>
                <option value="Existing Instrument">Existing Instrument</option>
                <option value="AI Generated">AI Generated</option>
              </select>
            </div>
          </div>

          {/* Construct Hierarchy Mapping (Variable -> Dimension -> Indicator) */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Construct Operationalization Mapping
              </span>
              <span className="text-[10px] text-slate-500">Variable → Dimension → Indicator</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Target Variable <span className="text-rose-500">*</span>
                </label>
                <select
                  value={variableId}
                  onChange={e => {
                    setVariableId(e.target.value);
                    setDimensionId('');
                    setIndicatorId('');
                  }}
                  required
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Construct --</option>
                  {mappedVariables.map(v => (
                    <option key={v.id} value={v.id}>
                      [{v.code}] {v.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Dimension (Optional)
                </label>
                <select
                  value={dimensionId}
                  onChange={e => {
                    setDimensionId(e.target.value);
                    setIndicatorId('');
                  }}
                  disabled={availableDimensions.length === 0}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- None / General --</option>
                  {availableDimensions.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.code}] {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Indicator (Optional)
                </label>
                <select
                  value={indicatorId}
                  onChange={e => setIndicatorId(e.target.value)}
                  disabled={availableIndicators.length === 0}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- None / General --</option>
                  {availableIndicators.map(ind => (
                    <option key={ind.id} value={ind.id}>
                      [{ind.code}] {ind.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Response Scale & Scoring Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Response Scale</label>
                {onOpenScaleManager && (
                  <button
                    type="button"
                    onClick={onOpenScaleManager}
                    className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    + Manage Scales
                  </button>
                )}
              </div>
              <select
                value={responseScaleId}
                onChange={e => setResponseScaleId(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Select Response Scale --</option>
                {scales.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.options.length} pts: {s.minValue}–{s.maxValue})
                  </option>
                ))}
              </select>
            </div>

            {/* Toggles: Required & Reverse-Coded */}
            <div className="pt-4 flex flex-col gap-2.5">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={required}
                  onChange={e => setRequired(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-700">Required Response</span>
                <span className="text-[10px] text-slate-400">(Mandatory for participant submission)</span>
              </label>

              <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={reverseCoded}
                  onChange={e => setReverseCoded(e.target.checked)}
                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-amber-800 flex items-center gap-1">
                  <RotateCw className="w-3.5 h-3.5" />
                  Reverse-Coded Item (Inverted Scoring)
                </span>
              </label>
            </div>
          </div>

          {/* Reverse-coding explanation preview */}
          {reverseCoded && selectedScale && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1 mb-1">
                <RotateCw className="w-3.5 h-3.5 text-amber-600" />
                Deterministic Reverse-Coding Rule:
              </div>
              <p className="text-[11px] mb-1.5 text-amber-800">
                In statistical processing, scores will be automatically inverted via:
                <code className="mx-1 px-1.5 py-0.5 bg-white border border-amber-200 rounded font-mono font-bold">
                  Recoded = ({selectedScale.maxValue} + {selectedScale.minValue}) - RawValue
                </code>
              </p>
              <div className="flex flex-wrap gap-2 text-[11px] font-mono">
                {selectedScale.options.map(opt => {
                  const recoded = selectedScale.maxValue + selectedScale.minValue - opt.value;
                  return (
                    <span key={opt.value} className="px-2 py-0.5 bg-white border border-amber-200 rounded">
                      {opt.value} ({opt.code || opt.label}) → <span className="font-bold text-amber-700">{recoded}</span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* LIVE PARTICIPANT PREVIEW SIMULATION CARD */}
          <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
                Live Participant Layout Preview:
              </span>
              <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                {itemCode || 'ITEM_CODE'}
              </span>
            </div>

            <div className="p-3 bg-white rounded-lg border border-indigo-100 shadow-2xs">
              <p className="text-xs font-semibold text-slate-800 mb-3">
                {questionText.trim() || 'Question prompt text will appear here...'}
                {required && <span className="text-rose-500 ml-1">*</span>}
              </p>

              {selectedScale ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedScale.options.map(opt => (
                    <div
                      key={opt.value}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-[11px] font-medium text-slate-700 flex items-center gap-1.5 hover:border-indigo-300"
                    >
                      <div className="w-3.5 h-3.5 rounded-full border border-slate-300" />
                      <span>{opt.label}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-slate-400 italic">No response scale selected.</div>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Methodological Notes &amp; Rationale
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Translation adapted for collegiate context; cross-loads onto factor 1"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
            >
              {initialItem ? 'Update Item' : 'Save Item to Instrument'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
