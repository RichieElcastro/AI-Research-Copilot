import React, { useState, useEffect } from 'react';
import { X, Sliders, CheckSquare, Square, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { Instrument, InstrumentSourceType, Variable } from '../../types';
import { variableService } from '../../services/variableService';
import { useAuth } from '../../context/AuthContext';

interface InstrumentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    code: string;
    description: string;
    purpose: string;
    sourceType: InstrumentSourceType;
    sourceReference: string;
    variableIds: string[];
  }) => void;
  initialInstrument?: Instrument | null;
  projectId: string;
}

export const InstrumentFormModal: React.FC<InstrumentFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialInstrument,
  projectId,
}) => {
  const { currentUser } = useAuth();

  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [purpose, setPurpose] = useState('');
  const [sourceType, setSourceType] = useState<InstrumentSourceType>('Researcher Developed');
  const [sourceReference, setSourceReference] = useState('');
  const [variableIds, setVariableIds] = useState<string[]>([]);
  const [availableVariables, setAvailableVariables] = useState<Variable[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    if (currentUser && isOpen) {
      variableService.getVariables(projectId, currentUser.id).then(vRes => {
        if (isMounted && vRes.success && vRes.data) {
          setAvailableVariables(vRes.data);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [currentUser, isOpen, projectId]);

  useEffect(() => {
    if (initialInstrument) {
      setName(initialInstrument.name);
      setCode(initialInstrument.code);
      setDescription(initialInstrument.description || '');
      setPurpose(initialInstrument.purpose || '');
      setSourceType(initialInstrument.sourceType);
      setSourceReference(initialInstrument.sourceReference || '');
      setVariableIds(initialInstrument.variableIds || []);
    } else {
      setName('');
      setCode('');
      setDescription('');
      setPurpose('');
      setSourceType('Researcher Developed');
      setSourceReference('');
      setVariableIds([]);
    }
    setErrorMsg(null);
  }, [initialInstrument, isOpen]);

  if (!isOpen) return null;

  const toggleVariable = (vid: string) => {
    if (variableIds.includes(vid)) {
      setVariableIds(variableIds.filter(id => id !== vid));
    } else {
      setVariableIds([...variableIds, vid]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Please enter an instrument title/name.');
      return;
    }
    if (!code.trim()) {
      setErrorMsg('Please enter a unique instrument code (e.g. DS01, AMS01).');
      return;
    }
    if (variableIds.length === 0) {
      setErrorMsg('Please map at least one research variable to this measurement instrument.');
      return;
    }

    onSubmit({
      name: name.trim(),
      code: code.trim().toUpperCase(),
      description: description.trim(),
      purpose: purpose.trim(),
      sourceType,
      sourceReference: sourceReference.trim(),
      variableIds,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {initialInstrument ? 'Edit Instrument Specifications' : 'New Measurement Instrument'}
              </h2>
              <p className="text-xs text-slate-500">
                Define the empirical measurement mechanism and its target construct relationships
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instrument Title / Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Academic Motivation Scale (AMS-28)"
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Code <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. AMS01"
                required
                className="w-full px-3 py-2 text-xs font-mono font-bold uppercase border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-700 mt-0.5 block">Unique within project</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Instrument Source Type <span className="text-rose-500">*</span>
              </label>
              <select
                value={sourceType}
                onChange={e => setSourceType(e.target.value as InstrumentSourceType)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              >
                <option value="Researcher Developed">Researcher Developed</option>
                <option value="Adapted Instrument">Adapted Instrument</option>
                <option value="Standardized Instrument">Standardized Instrument</option>
                <option value="Existing Scale">Existing Scale</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Literature Source Reference
              </label>
              <input
                type="text"
                value={sourceReference}
                onChange={e => setSourceReference(e.target.value)}
                placeholder="e.g. Vallerand et al. (1992); Educational and Psychological Measurement"
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Purpose &amp; Operational Rationale
            </label>
            <input
              type="text"
              value={purpose}
              onChange={e => setPurpose(e.target.value)}
              placeholder="e.g. Operationalize dependent construct Y1 across intrinsic, extrinsic, and amotivational dimensions."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Methodological Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Provide psychometric background, translation notes, or instructions for field administration..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Mapped Variables Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Constructs Measured by this Instrument <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-700 mb-2">
              Select which variable(s) this instrument operationalizes. An instrument can measure one or more variables.
            </p>

            {availableVariables.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                No variables found in this project. Please define variables in Stage 2 before creating an instrument.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                {availableVariables.map(v => {
                  const isSelected = variableIds.includes(v.id);
                  return (
                    <div
                      key={v.id}
                      onClick={() => toggleVariable(v.id)}
                      className={`p-2.5 rounded-lg border cursor-pointer transition-all flex items-start gap-2.5 select-none ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="mt-0.5 text-indigo-600">
                        {isSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4 text-slate-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-1.5 py-0.2 rounded">
                            {v.code}
                          </span>
                          <span className="font-semibold text-xs truncate">{v.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-700 mt-0.5 line-clamp-1">
                          {v.role} • {v.dimensions.length} Dimensions
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
              {initialInstrument ? 'Save Changes' : 'Create Instrument'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
