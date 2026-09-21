import React, { useState, useEffect } from 'react';
import { X, Calculator, Plus, Trash2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import {
  ProcessedItemValue,
  ProcessingRun,
  ScoringMethod,
  ScoringMissingPolicy,
  ScoringRule,
  ScoringSourceType,
  ScoringTargetType,
  Variable,
} from '../../types';
import { scoringService } from '../../services/scoringService';

interface RuleBuilderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (rule: Omit<ScoringRule, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'createdBy'> & { id?: string }) => void;
  initialRule?: ScoringRule | null;
  projectId: string;
  variables: Variable[];
  processingRun: ProcessingRun | null;
}

export const RuleBuilderModal: React.FC<RuleBuilderModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialRule,
  projectId,
  variables,
  processingRun,
}) => {
  const [targetType, setTargetType] = useState<ScoringTargetType>('Dimension');
  const [targetId, setTargetId] = useState('');
  const [targetCode, setTargetCode] = useState('');
  const [targetName, setTargetName] = useState('');
  const [method, setMethod] = useState<ScoringMethod>('MEAN');
  const [sourceType, setSourceType] = useState<ScoringSourceType>('items');
  const [selectedItemCodes, setSelectedItemCodes] = useState<string[]>([]);
  const [selectedDimensionCodes, setSelectedDimensionCodes] = useState<string[]>([]);
  const [missingValuePolicy, setMissingValuePolicy] = useState<ScoringMissingPolicy>('available_case');
  const [minimumRequiredItems, setMinimumRequiredItems] = useState<number>(1);
  const [expectedMin, setExpectedMin] = useState<string>('');
  const [expectedMax, setExpectedMax] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Available items from processing run snapshot
  const availableItems = processingRun?.rulesSnapshot.items || [];

  // Available dimensions from variables
  const allDimensions = variables.flatMap(v =>
    v.dimensions.map(d => ({
      ...d,
      variableName: v.name,
      variableCode: v.code,
    }))
  );

  useEffect(() => {
    if (initialRule) {
      setTargetType(initialRule.targetType);
      setTargetId(initialRule.targetId);
      setTargetCode(initialRule.targetCode);
      setTargetName(initialRule.targetName);
      setMethod(initialRule.method);
      setSourceType(initialRule.sourceType);
      setSelectedItemCodes(initialRule.sourceItemCodes || []);
      setSelectedDimensionCodes(initialRule.sourceDimensionCodes || []);
      setMissingValuePolicy(initialRule.missingValuePolicy);
      setMinimumRequiredItems(initialRule.minimumRequiredItems || 1);
      setExpectedMin(initialRule.expectedRange ? String(initialRule.expectedRange.min) : '');
      setExpectedMax(initialRule.expectedRange ? String(initialRule.expectedRange.max) : '');
      setNotes(initialRule.notes || '');
    } else {
      // Default to first dimension if available
      if (allDimensions.length > 0) {
        const firstDim = allDimensions[0];
        setTargetType('Dimension');
        setTargetId(firstDim.id);
        setTargetCode(`DIM_${firstDim.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
        setTargetName(firstDim.name);
        setSourceType('items');

        // Preselect items belonging to this dimension
        const matchingItems = availableItems.filter(i => i.dimensionId === firstDim.id);
        setSelectedItemCodes(matchingItems.map(i => i.itemCode));
        setMinimumRequiredItems(Math.max(1, Math.ceil(matchingItems.length / 2)));
      } else if (variables.length > 0) {
        const firstVar = variables[0];
        setTargetType('Variable');
        setTargetId(firstVar.id);
        setTargetCode(`VAR_${firstVar.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
        setTargetName(firstVar.name);
        setSourceType('items');
        const matchingItems = availableItems.filter(i => i.variableId === firstVar.id);
        setSelectedItemCodes(matchingItems.map(i => i.itemCode));
        setMinimumRequiredItems(Math.max(1, Math.ceil(matchingItems.length / 2)));
      }
      setMethod('MEAN');
      setMissingValuePolicy('available_case');
      setExpectedMin('');
      setExpectedMax('');
      setNotes('');
    }
    setFormError(null);
  }, [initialRule, isOpen]);

  if (!isOpen) return null;

  // Handle changing target selection
  const handleTargetChange = (id: string) => {
    setTargetId(id);
    if (targetType === 'Dimension') {
      const dim = allDimensions.find(d => d.id === id);
      if (dim) {
        setTargetCode(`DIM_${dim.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
        setTargetName(dim.name);
        const matchingItems = availableItems.filter(i => i.dimensionId === dim.id);
        setSelectedItemCodes(matchingItems.map(i => i.itemCode));
        setMinimumRequiredItems(Math.max(1, Math.ceil(matchingItems.length / 2)));
      }
    } else {
      const v = variables.find(v => v.id === id);
      if (v) {
        setTargetCode(`VAR_${v.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
        setTargetName(v.name);
        if (sourceType === 'dimensions') {
          const dimCodes = v.dimensions.map(d => `DIM_${d.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
          setSelectedDimensionCodes(dimCodes);
          setMinimumRequiredItems(Math.max(1, Math.ceil(dimCodes.length / 2)));
        } else {
          const matchingItems = availableItems.filter(i => i.variableId === v.id);
          setSelectedItemCodes(matchingItems.map(i => i.itemCode));
          setMinimumRequiredItems(Math.max(1, Math.ceil(matchingItems.length / 2)));
        }
      }
    }
  };

  const handleTargetTypeChange = (newType: ScoringTargetType) => {
    setTargetType(newType);
    if (newType === 'Dimension') {
      setSourceType('items');
      if (allDimensions.length > 0) {
        handleTargetChange(allDimensions[0].id);
      }
    } else {
      if (variables.length > 0) {
        handleTargetChange(variables[0].id);
      }
    }
  };

  const handleToggleItem = (code: string) => {
    if (selectedItemCodes.includes(code)) {
      setSelectedItemCodes(selectedItemCodes.filter(c => c !== code));
    } else {
      setSelectedItemCodes([...selectedItemCodes, code]);
    }
  };

  const handleToggleDimension = (code: string) => {
    if (selectedDimensionCodes.includes(code)) {
      setSelectedDimensionCodes(selectedDimensionCodes.filter(c => c !== code));
    } else {
      setSelectedDimensionCodes([...selectedDimensionCodes, code]);
    }
  };

  const handleSelectAllSources = () => {
    if (sourceType === 'dimensions') {
      const allDimCodes = allDimensions.map(d => `DIM_${d.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
      setSelectedDimensionCodes(Array.from(new Set(allDimCodes)));
    } else {
      setSelectedItemCodes(availableItems.map(i => i.itemCode));
    }
  };

  const handleDeselectAllSources = () => {
    if (sourceType === 'dimensions') {
      setSelectedDimensionCodes([]);
    } else {
      setSelectedItemCodes([]);
    }
  };

  // Human-readable summary for live preview
  const liveSummary = scoringService.generateRuleSummary({
    targetName: targetName || 'Target',
    targetCode: targetCode || 'TARGET_CODE',
    method,
    sourceType,
    sourceItemCodes: selectedItemCodes,
    sourceDimensionCodes: selectedDimensionCodes,
    missingValuePolicy,
    minimumRequiredItems,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!targetCode.trim() || !targetName.trim()) {
      setFormError('Target code and target name are required.');
      return;
    }

    if (sourceType === 'dimensions') {
      if (selectedDimensionCodes.length === 0) {
        setFormError('Please select at least one source dimension.');
        return;
      }
      if (missingValuePolicy === 'minimum_required_items') {
        if (minimumRequiredItems < 1 || minimumRequiredItems > selectedDimensionCodes.length) {
          setFormError(`Minimum required inputs must be between 1 and ${selectedDimensionCodes.length}.`);
          return;
        }
      }
    } else {
      if (selectedItemCodes.length === 0) {
        setFormError('Please select at least one source item.');
        return;
      }
      if (missingValuePolicy === 'minimum_required_items') {
        if (minimumRequiredItems < 1 || minimumRequiredItems > selectedItemCodes.length) {
          setFormError(`Minimum required inputs must be between 1 and ${selectedItemCodes.length}.`);
          return;
        }
      }
    }

    let expectedRange: { min: number; max: number } | undefined;
    if (expectedMin !== '' && expectedMax !== '') {
      const minVal = parseFloat(expectedMin);
      const maxVal = parseFloat(expectedMax);
      if (!isNaN(minVal) && !isNaN(maxVal)) {
        if (minVal >= maxVal) {
          setFormError('Expected minimum must be less than expected maximum.');
          return;
        }
        expectedRange = { min: minVal, max: maxVal };
      }
    }

    // Map sourceItemIds and sourceDimensionIds
    const sourceItemIds: string[] = [];
    selectedItemCodes.forEach(c => {
      const item = availableItems.find(i => i.itemCode === c);
      if (item) sourceItemIds.push(item.itemId);
    });

    const sourceDimensionIds: string[] = [];
    if (sourceType === 'dimensions') {
      selectedDimensionCodes.forEach(dc => {
        const dim = allDimensions.find(
          d => `DIM_${d.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}` === dc
        );
        if (dim) sourceDimensionIds.push(dim.id);
      });
    }

    onSave({
      id: initialRule ? initialRule.id : undefined,
      projectId,
      targetType,
      targetId,
      targetCode: targetCode.trim().toUpperCase(),
      targetName: targetName.trim(),
      method,
      sourceType,
      sourceItemIds,
      sourceItemCodes: selectedItemCodes,
      sourceDimensionIds,
      sourceDimensionCodes: selectedDimensionCodes,
      missingValuePolicy,
      minimumRequiredItems: missingValuePolicy === 'minimum_required_items' ? minimumRequiredItems : undefined,
      expectedRange,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {initialRule ? 'Edit Scoring Rule' : 'Create Scoring Rule'}
              </h3>
              <p className="text-xs text-slate-500">
                Define an explicit, deterministic aggregation formula for dimensions or variables.
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* Target Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              1. Target Construct Level
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleTargetTypeChange('Dimension')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetType === 'Dimension'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">Dimension Score</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Aggregate specific indicator items belonging to a dimension
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleTargetTypeChange('Variable')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  targetType === 'Variable'
                    ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold ring-1 ring-indigo-600'
                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="text-xs font-bold">Variable / Composite Score</div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Aggregate dimension scores or direct items into a construct score
                </div>
              </button>
            </div>
          </div>

          {/* Target Entity Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target {targetType}
              </label>
              <select
                value={targetId}
                onChange={e => handleTargetChange(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                {targetType === 'Dimension' ? (
                  allDimensions.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code}) - {d.variableName}
                    </option>
                  ))
                ) : (
                  variables.map(v => (
                    <option key={v.id} value={v.id}>
                      {v.name} ({v.code})
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Column Code (e.g. DIM_EE, VAR_BURNOUT)
              </label>
              <input
                type="text"
                value={targetCode}
                onChange={e => setTargetCode(e.target.value.toUpperCase())}
                placeholder="DIM_CODE"
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {/* For Variable: Source Type Selection */}
          {targetType === 'Variable' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Variable Aggregation Source
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="sourceType"
                    checked={sourceType === 'dimensions'}
                    onChange={() => {
                      setSourceType('dimensions');
                      const v = variables.find(v => v.id === targetId);
                      if (v) {
                        const dimCodes = v.dimensions.map(d => `DIM_${d.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`);
                        setSelectedDimensionCodes(dimCodes);
                      }
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>From Dimension Scores (Second-order construct)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="sourceType"
                    checked={sourceType === 'items'}
                    onChange={() => {
                      setSourceType('items');
                      const v = variables.find(v => v.id === targetId);
                      if (v) {
                        const matchingItems = availableItems.filter(i => i.variableId === v.id);
                        setSelectedItemCodes(matchingItems.map(i => i.itemCode));
                      }
                    }}
                    className="text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>From Direct Item Responses</span>
                </label>
              </div>
            </div>
          )}

          {/* Source Selection Checkboxes */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                2. Select Source Inputs ({sourceType === 'dimensions' ? selectedDimensionCodes.length : selectedItemCodes.length} selected)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAllSources}
                  className="text-[11px] text-indigo-600 font-semibold hover:underline"
                >
                  Select All
                </button>
                <span className="text-slate-300">|</span>
                <button
                  type="button"
                  onClick={handleDeselectAllSources}
                  className="text-[11px] text-slate-500 font-semibold hover:underline"
                >
                  Deselect All
                </button>
              </div>
            </div>

            {sourceType === 'dimensions' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-slate-50/50">
                {allDimensions.map(d => {
                  const dimTargetCode = `DIM_${d.code.replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase()}`;
                  const isChecked = selectedDimensionCodes.includes(dimTargetCode);
                  return (
                    <label
                      key={d.id}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDimension(dimTargetCode)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div>
                        <span className="font-mono font-bold">{dimTargetCode}</span>
                        <div className="text-[11px] text-slate-500">{d.name}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 border border-slate-200 rounded-xl bg-slate-50/50">
                {availableItems.map(item => {
                  const isChecked = selectedItemCodes.includes(item.itemCode);
                  return (
                    <label
                      key={item.itemId}
                      className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-indigo-50/70 border-indigo-200 text-indigo-950 font-medium'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleItem(item.itemCode)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold">{item.itemCode}</span>
                          {item.reverseCodingRule && (
                            <span className="text-[9px] bg-amber-100 text-amber-800 font-semibold px-1 rounded">
                              REV
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate" title={item.questionText}>
                          {item.questionText}
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>

          {/* Scoring Method & Missing Policy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                3. Scoring Method
              </label>
              <select
                value={method}
                onChange={e => setMethod(e.target.value as ScoringMethod)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="MEAN">MEAN - Arithmetic Average (Standard)</option>
                <option value="SUM">SUM - Total Score Addition</option>
                <option value="MEDIAN">MEDIAN - Middle Response Value</option>
                <option value="MIN">MIN - Lowest Value</option>
                <option value="MAX">MAX - Highest Value</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                4. Missing Value Policy
              </label>
              <select
                value={missingValuePolicy}
                onChange={e => setMissingValuePolicy(e.target.value as ScoringMissingPolicy)}
                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 font-semibold focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="available_case">Available Case (Average of available responses)</option>
                <option value="complete_case">Complete Case (All responses required or null)</option>
                <option value="minimum_required_items">Minimum Required Items Threshold</option>
              </select>
            </div>
          </div>

          {/* Minimum Required Items Threshold (if selected) */}
          {missingValuePolicy === 'minimum_required_items' && (
            <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-amber-900">
                  Minimum Required Valid Items:
                </label>
                <p className="text-[11px] text-amber-700">
                  If fewer valid items are provided, score will be set to null.
                </p>
              </div>
              <input
                type="number"
                min="1"
                max={sourceType === 'dimensions' ? selectedDimensionCodes.length : selectedItemCodes.length}
                value={minimumRequiredItems}
                onChange={e => setMinimumRequiredItems(parseInt(e.target.value) || 1)}
                className="w-20 bg-white border border-amber-300 rounded-lg px-2.5 py-1.5 text-xs font-mono font-bold text-slate-900 text-center"
              />
            </div>
          )}

          {/* Expected Bounds Validation Range */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              5. Expected Scale Range (Optional Bounds Check)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Scale Minimum</span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 1"
                  value={expectedMin}
                  onChange={e => setExpectedMin(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                />
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block mb-1">Scale Maximum</span>
                <input
                  type="number"
                  step="any"
                  placeholder="e.g. 5"
                  value={expectedMax}
                  onChange={e => setExpectedMax(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900"
                />
              </div>
            </div>
          </div>

          {/* Live Mathematical Summary Preview */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Deterministic Formula Preview</span>
            </div>
            <p className="text-xs font-mono text-indigo-950 font-medium">
              {liveSummary}
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Methodological Notes &amp; Citations (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Mean aggregation conforming to Maslach et al. (1996)"
              className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs text-slate-900"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors shadow-2xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs"
            >
              {initialRule ? 'Save Rule Changes' : 'Create Scoring Rule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
