import React, { useState, useEffect } from 'react';
import { Dimension } from '../../types';
import { Modal } from '../common/Modal';

interface DimensionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; code: string; definition: string; description: string }) => void;
  initialDimension?: Dimension | null;
  variableName: string;
}

export const DimensionFormModal: React.FC<DimensionFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialDimension,
  variableName,
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [definition, setDefinition] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialDimension) {
      setName(initialDimension.name);
      setCode(initialDimension.code);
      setDefinition(initialDimension.definition || '');
      setDescription(initialDimension.description || '');
    } else {
      setName('');
      setCode('');
      setDefinition('');
      setDescription('');
    }
    setValidationError(null);
  }, [initialDimension, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedName) {
      setValidationError('Dimension name is required.');
      return;
    }
    if (!trimmedCode) {
      setValidationError('Dimension code is required (e.g. DIM-1, DIM-2).');
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
      id="dimension-form-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={initialDimension ? `Edit Dimension: ${initialDimension.code}` : 'Add Variable Dimension'}
      subtitle={`Sub-component for construct: ${variableName}`}
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
            <label htmlFor="dim-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Dimension Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="dim-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Compulsive Consumption"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="dim-code" className="block text-xs font-semibold text-slate-700 mb-1">
              Code <span className="text-rose-500">*</span>
            </label>
            <input
              id="dim-code"
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. DIM-1"
              className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>
        </div>

        <div>
          <label htmlFor="dim-def" className="block text-xs font-semibold text-slate-700 mb-1">
            Dimension Definition
          </label>
          <textarea
            id="dim-def"
            rows={2}
            value={definition}
            onChange={e => setDefinition(e.target.value)}
            placeholder="What aspect or behavioral facet of the construct does this dimension capture?"
            className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900 resize-y"
          />
        </div>

        <div>
          <label htmlFor="dim-desc" className="block text-xs font-semibold text-slate-700 mb-1">
            Measurement Notes (Optional)
          </label>
          <input
            id="dim-desc"
            type="text"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. Captures habitual automaticity"
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
            id="btn-save-dimension-submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
          >
            {initialDimension ? 'Save Dimension' : 'Add Dimension'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
