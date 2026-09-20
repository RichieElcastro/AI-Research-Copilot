import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Trash2,
  Archive,
  CheckCircle2,
  AlertCircle,
  Sliders,
  Scale,
  Sparkles,
} from 'lucide-react';
import { ResponseScale, ResponseScaleOption, ResponseScaleType } from '../../types';
import { scaleService } from '../../services/scaleService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface ScaleManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onScaleChanged?: () => void;
}

export const ScaleManagerModal: React.FC<ScaleManagerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onScaleChanged,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [scales, setScales] = useState<ResponseScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');

  // New Scale Form State
  const [name, setName] = useState('');
  const [scaleType, setScaleType] = useState<ResponseScaleType>('Likert');
  const [options, setOptions] = useState<ResponseScaleOption[]>([
    { value: 1, label: 'Strongly Disagree', code: 'SD' },
    { value: 2, label: 'Disagree', code: 'D' },
    { value: 3, label: 'Neutral', code: 'N' },
    { value: 4, label: 'Agree', code: 'A' },
    { value: 5, label: 'Strongly Agree', code: 'SA' },
  ]);
  const [formError, setFormError] = useState<string | null>(null);

  const loadScales = () => {
    if (!currentUser) return;
    setLoading(true);
    const res = scaleService.getScales(projectId, currentUser.id);
    if (res.success && res.data) {
      setScales(res.data);
    } else {
      error('Failed to load scales', res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadScales();
      setActiveTab('list');
      setFormError(null);
    }
  }, [isOpen, projectId]);

  if (!isOpen) return null;

  const handleOptionChange = (index: number, field: keyof ResponseScaleOption, val: any) => {
    const updated = [...options];
    updated[index] = { ...updated[index], [field]: val };
    setOptions(updated);
  };

  const handleAddOption = () => {
    const nextVal = options.length > 0 ? Math.max(...options.map(o => o.value)) + 1 : 1;
    setOptions([...options, { value: nextVal, label: `Option ${options.length + 1}`, code: `${nextVal}` }]);
  };

  const handleRemoveOption = (index: number) => {
    if (options.length <= 2) {
      setFormError('A response scale must contain at least 2 response options.');
      return;
    }
    setOptions(options.filter((_, i) => i !== index));
    setFormError(null);
  };

  const handleCreateScale = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!name.trim()) {
      setFormError('Please enter a scale name.');
      return;
    }

    const minVal = Math.min(...options.map(o => o.value));
    const maxVal = Math.max(...options.map(o => o.value));

    const res = scaleService.createScale(projectId, currentUser.id, currentUser.name, {
      name: name.trim(),
      scaleType,
      minValue: minVal,
      maxValue: maxVal,
      options,
    });

    if (res.success) {
      success('Scale Created', `Response scale "${name}" saved to measurement model.`);
      loadScales();
      setActiveTab('list');
      setName('');
      onScaleChanged?.();
    } else {
      setFormError(res.error || 'Failed to create scale.');
    }
  };

  const handleArchiveScale = (scaleId: string) => {
    if (!currentUser) return;
    const res = scaleService.archiveScale(scaleId, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      info('Scale Archived', 'Response scale marked as archived. Existing items retain definitions.');
      loadScales();
      onScaleChanged?.();
    } else {
      error('Archive Failed', res.error);
    }
  };

  const handleDeleteScale = (scaleId: string) => {
    if (!currentUser) return;
    const res = scaleService.deleteScale(scaleId, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Scale Deleted', 'Custom response scale deleted.');
      loadScales();
      onScaleChanged?.();
    } else {
      error('Delete Blocked', res.error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Response Scale Library</h2>
              <p className="text-xs text-slate-500">
                Standardized and custom psychometric scales with deterministic numeric coding
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

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex space-x-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab('list');
                setFormError(null);
              }}
              className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'list'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Active Scales ({scales.length})
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('create');
                setFormError(null);
              }}
              className={`py-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              + Create Custom Scale
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'list' ? (
            <div className="space-y-4">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading response scales...</div>
              ) : scales.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">No response scales found.</div>
              ) : (
                <div className="space-y-3">
                  {scales.map(scale => {
                    const isReferenced = scaleService.isScaleReferenced(scale.id, projectId);
                    return (
                      <div
                        key={scale.id}
                        className={`p-4 rounded-xl border transition-all ${
                          scale.isArchived
                            ? 'bg-slate-50 border-slate-200 opacity-60'
                            : 'bg-white border-slate-200 hover:border-indigo-200 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{scale.name}</span>
                              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                                {scale.scaleType} ({scale.minValue}–{scale.maxValue})
                              </span>
                              {scale.isSystemPreset && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                                  Standard
                                </span>
                              )}
                              {scale.isArchived && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                  Archived
                                </span>
                              )}
                              {isReferenced && (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  In Use
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {!scale.isArchived && (
                              <button
                                type="button"
                                onClick={() => handleArchiveScale(scale.id)}
                                title="Archive scale (protects past data)"
                                className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors text-xs inline-flex items-center gap-1"
                              >
                                <Archive className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {!scale.isSystemPreset && !isReferenced && (
                              <button
                                type="button"
                                onClick={() => handleDeleteScale(scale.id)}
                                title="Delete scale"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Visual Option Points */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          {scale.options.map(opt => (
                            <span
                              key={opt.value}
                              className="inline-flex items-center gap-1 text-[11px] px-2 py-1 bg-slate-100 rounded-md text-slate-700 font-medium"
                            >
                              <span className="w-4 h-4 rounded-full bg-slate-200 text-slate-800 text-[9px] font-bold flex items-center justify-center">
                                {opt.value}
                              </span>
                              <span>{opt.label}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <form onSubmit={handleCreateScale} className="space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Scale Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Likert 6-point Quality Rating"
                    required
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scale Type</label>
                  <select
                    value={scaleType}
                    onChange={e => setScaleType(e.target.value as ResponseScaleType)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Likert">Likert Scale</option>
                    <option value="Semantic Differential">Semantic Differential</option>
                    <option value="Numeric Rating">Numeric Rating</option>
                    <option value="Binary">Binary (Yes/No)</option>
                    <option value="Custom Categorical">Custom Categorical</option>
                  </select>
                </div>
              </div>

              {/* Options Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-slate-700">
                    Response Points &amp; Numeric Coding Values
                  </label>
                  <button
                    type="button"
                    onClick={handleAddOption}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Option
                  </button>
                </div>

                <div className="space-y-2 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {options.map((opt, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <div className="w-16">
                        <input
                          type="number"
                          value={opt.value}
                          onChange={e => handleOptionChange(idx, 'value', parseInt(e.target.value, 10))}
                          className="w-full px-2.5 py-1.5 text-xs text-center font-bold border border-slate-300 rounded-lg bg-white"
                          title="Numeric Coding Value"
                          placeholder="Code"
                        />
                      </div>
                      <div className="flex-1">
                        <input
                          type="text"
                          value={opt.label}
                          onChange={e => handleOptionChange(idx, 'label', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white"
                          placeholder={`Option ${idx + 1} Label`}
                          required
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        disabled={options.length <= 2}
                        className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-md"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live Scale Preview */}
              <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                <span className="text-[11px] font-bold text-indigo-900 block mb-1.5 uppercase tracking-wider">
                  Participant Preview Simulation:
                </span>
                <div className="flex flex-wrap gap-2">
                  {options.map(opt => (
                    <div
                      key={opt.value}
                      className="px-3 py-1.5 rounded-lg border border-indigo-200 bg-white text-indigo-950 text-xs font-medium flex items-center gap-1.5 shadow-2xs"
                    >
                      <span className="w-3.5 h-3.5 rounded-full border border-indigo-400 flex items-center justify-center text-[9px] text-indigo-600">
                        {opt.value}
                      </span>
                      <span>{opt.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('list')}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
                >
                  Save Response Scale
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
