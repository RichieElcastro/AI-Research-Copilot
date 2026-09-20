import React, { useState, useEffect } from 'react';
import { Indicator } from '../../types';
import { Modal } from '../common/Modal';

interface IndicatorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; definition: string; description: string }) => void;
  initialIndicator?: Indicator | null;
  dimensionName: string;
}

export const IndicatorFormModal: React.FC<IndicatorFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialIndicator,
  dimensionName,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [definition, setDefinition] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialIndicator) {
      setName(initialIndicator.name);
      setCode(initialIndicator.code);
      setDefinition(initialIndicator.definition || '');
      setDescription(initialIndicator.description || '');
    } else {
      setName('');
      setCode('');
      setDefinition('');
      setDescription('');
    }
    setValidationError(null);
  }, [initialIndicator, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedName) {
      setValidationError('Indicator name is required.');
      return;
    }
    if (!trimmedCode) {
      setValidationError('Indicator code is required (e.g. IND-1.1).');
      return;
    }

    onSubmit({
      name: trimmedName,
      code: trimmedCode,
      definition: definition.trim(),
      description: description.trim(),
    });
    onClose();
  };

  return (
    <Modal
      id="indicator-form-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={initialIndicator ? `Edit Indicator: ${initialIndicator.code}` : 'Add Empirical Indicator'}
      subtitle={`Observable measure for dimension: ${dimensionName}`}
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {validationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
            {validationError}
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label htmlFor="ind-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Indicator Name / Statement <span className="text-rose-500">*</span>
            </label>
            <input
              id="ind-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Automatic checking of crisis threads"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="ind-code" className="block text-xs font-semibold text-slate-700 mb-1">
              Code <span className="text-rose-500">*</span>
            </label>
            <input
              id="ind-code"
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. IND-1.1"
              className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>
        </div>

        <div>
          <label htmlFor="ind-def" className="block text-xs font-semibold text-slate-700 mb-1">
            Empirical Manifestation / Definition
          </label>
          <textarea
            id="ind-def"
            rows={2}
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            placeholder="How this indicator manifests as an observable behavior or measurable symptom..."
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900 resize-y"
          />
        </div>

        <div>
          <label htmlFor="ind-desc" className="block text-xs font-semibold text-slate-700 mb-1">
            Notes / Item Blueprint Reference
          </label>
          <input
            id="ind-desc"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Base for Likert question in Phase 2"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            id="btn-save-indicator-submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
          >
            {initialIndicator ? 'Save Indicator' : 'Add Indicator'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
