import React, { useState, useEffect } from 'react';
import { MeasurementScale, Variable, VariableRole } from '../../types';
import { VALID_ROLES, VALID_SCALES } from '../../services/variableService';
import { Modal } from '../common/Modal';

interface VariableFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    code: string;
    variableType: string;
    role: VariableRole;
    measurementScale: MeasurementScale;
    conceptualDefinition: string;
    operationalDefinition: string;
    description: string;
  }) => void;
  initialVariable?: Variable | null;
  existingCodes?: string[];
}

export const VariableFormModal: React.FC<VariableFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialVariable,
  existingCodes = [],
}) => {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [variableType, setVariableType] = useState('Latent Construct');
  const [role, setRole] = useState<VariableRole>('Independent Variable');
  const [measurementScale, setMeasurementScale] = useState<MeasurementScale>('Interval');
  const [conceptualDefinition, setConceptualDefinition] = useState('');
  const [operationalDefinition, setOperationalDefinition] = useState('');
  const [description, setDescription] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (initialVariable) {
      setName(initialVariable.name);
      setCode(initialVariable.code);
      setVariableType(initialVariable.variableType || 'Latent Construct');
      setRole(initialVariable.role);
      setMeasurementScale(initialVariable.measurementScale);
      setConceptualDefinition(initialVariable.conceptualDefinition || '');
      setOperationalDefinition(initialVariable.operationalDefinition || '');
      setDescription(initialVariable.description || '');
    } else {
      setName('');
      setCode('');
      setVariableType('Latent Construct');
      setRole('Independent Variable');
      setMeasurementScale('Interval');
      setConceptualDefinition('');
      setOperationalDefinition('');
      setDescription('');
    }
    setValidationError(null);
  }, [initialVariable, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    const trimmedName = name.trim();
    const trimmedCode = code.trim().toUpperCase();

    if (!trimmedName) {
      setValidationError('Variable name is required.');
      return;
    }
    if (!trimmedCode) {
      setValidationError('Variable code is required (e.g. X1, Y1, C1).');
      return;
    }

    // Check code duplication if changed or new
    const isNewOrChangedCode = !initialVariable || initialVariable.code.toUpperCase() !== trimmedCode;
    if (isNewOrChangedCode && existingCodes.map(c => c.toUpperCase()).includes(trimmedCode)) {
      setValidationError(`Variable code "${trimmedCode}" is already in use within this project.`);
      return;
    }

    onSubmit({
      name: trimmedName,
      code: trimmedCode,
      variableType: variableType.trim(),
      role,
      measurementScale,
      conceptualDefinition: conceptualDefinition.trim(),
      operationalDefinition: operationalDefinition.trim(),
      description: description.trim(),
    });
    onClose();
  };

  return (
    <Modal
      id="variable-form-modal"
      isOpen={isOpen}
      onClose={onClose}
      title={initialVariable ? `Edit Variable: ${initialVariable.code}` : 'Define New Variable'}
      subtitle="Operationalize a research construct with measurement scale and definitions"
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {validationError && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 font-medium">
            {validationError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label htmlFor="var-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Variable / Construct Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="var-name"
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Doomscrolling Behavior"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>

          <div>
            <label htmlFor="var-code" className="block text-xs font-semibold text-slate-700 mb-1">
              Variable Code <span className="text-rose-500">*</span>
            </label>
            <input
              id="var-code"
              type="text"
              required
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="e.g. X1, Y1, C1"
              className="w-full px-3 py-2 text-xs font-mono font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label htmlFor="var-role" className="block text-xs font-semibold text-slate-700 mb-1">
              Variable Role <span className="text-rose-500">*</span>
            </label>
            <select
              id="var-role"
              value={role}
              onChange={e => setRole(e.target.value as VariableRole)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            >
              {VALID_ROLES.map(r => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="var-scale" className="block text-xs font-semibold text-slate-700 mb-1">
              Measurement Scale <span className="text-rose-500">*</span>
            </label>
            <select
              id="var-scale"
              value={measurementScale}
              onChange={e => setMeasurementScale(e.target.value as MeasurementScale)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            >
              {VALID_SCALES.map(s => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="var-type" className="block text-xs font-semibold text-slate-700 mb-1">
              Construct Classification
            </label>
            <input
              id="var-type"
              type="text"
              value={variableType}
              onChange={e => setVariableType(e.target.value)}
              placeholder="e.g. Latent Construct, Observed"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>
        </div>

        {/* Conceptual vs Operational Definitions */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="var-conceptual-def" className="block text-xs font-semibold text-slate-700">
                Conceptual Definition
              </label>
              <span className="text-[10px] text-slate-700 font-medium">Theoretical meaning from literature</span>
            </div>
            <textarea
              id="var-conceptual-def"
              rows={2}
              value={conceptualDefinition}
              onChange={e => setConceptualDefinition(e.target.value)}
              placeholder="Explain the theoretical concept as defined by academic literature..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900 resize-y"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="var-operational-def" className="block text-xs font-semibold text-slate-700">
                Operational Definition
              </label>
              <span className="text-[10px] text-slate-700 font-medium">How it is quantified & scored empirically</span>
            </div>
            <textarea
              id="var-operational-def"
              rows={2}
              value={operationalDefinition}
              onChange={e => setOperationalDefinition(e.target.value)}
              placeholder="Describe the measurement process, indicators, or scoring procedure..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900 resize-y"
            />
          </div>

          <div>
            <label htmlFor="var-notes" className="block text-xs font-semibold text-slate-700 mb-1">
              Research Notes & Citations (Optional)
            </label>
            <input
              id="var-notes"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Adapted from Sharma et al. (2022)"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden bg-white text-slate-900"
            />
          </div>
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
            id="btn-save-variable-submit"
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
          >
            {initialVariable ? 'Save Variable' : 'Create Variable'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
