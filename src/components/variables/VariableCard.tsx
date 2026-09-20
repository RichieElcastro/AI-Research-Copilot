import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Edit3,
  Trash2,
  ArrowUp,
  ArrowDown,
  Layers,
  ListCheck,
  FileText,
  Bookmark,
} from 'lucide-react';
import { Dimension, Indicator, Variable } from '../../types';
import { MeasurementScaleBadge, VariableRoleBadge } from '../common/Badge';

interface VariableCardProps {
  variable: Variable;
  onEditVariable: (variable: Variable) => void;
  onDeleteVariable: (variable: Variable) => void;
  onAddDimension: (variable: Variable) => void;
  onEditDimension: (variable: Variable, dimension: Dimension) => void;
  onDeleteDimension: (variable: Variable, dimension: Dimension) => void;
  onReorderDimension: (variable: Variable, dimension: Dimension, direction: 'up' | 'down') => void;
  onAddIndicator: (variable: Variable, dimension: Dimension) => void;
  onEditIndicator: (variable: Variable, dimension: Dimension, indicator: Indicator) => void;
  onDeleteIndicator: (variable: Variable, dimension: Dimension, indicator: Indicator) => void;
  onReorderIndicator: (
    variable: Variable,
    dimension: Dimension,
    indicator: Indicator,
    direction: 'up' | 'down'
  ) => void;
}

export const VariableCard: React.FC<VariableCardProps> = ({
  variable,
  onEditVariable,
  onDeleteVariable,
  onAddDimension,
  onEditDimension,
  onDeleteDimension,
  onReorderDimension,
  onAddIndicator,
  onEditIndicator,
  onDeleteIndicator,
  onReorderIndicator,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  const totalIndicators = (variable.dimensions || []).reduce(
    (sum, d) => sum + (d.indicators?.length || 0),
    0
  );

  return (
    <div
      id={`variable-card-${variable.id}`}
      className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden transition-all duration-150"
    >
      {/* Variable Header */}
      <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-1 text-slate-400 hover:text-slate-700 p-0.5 rounded transition-colors"
              aria-label={isExpanded ? 'Collapse variable details' : 'Expand variable details'}
            >
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="px-2 py-0.5 font-mono text-xs font-bold rounded bg-slate-900 text-white shadow-2xs">
                  {variable.code}
                </span>
                <VariableRoleBadge role={variable.role} />
                <MeasurementScaleBadge scale={variable.measurementScale} />
                <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                  {variable.variableType}
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">{variable.name}</h3>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              type="button"
              id={`btn-add-dimension-${variable.id}`}
              onClick={() => onAddDimension(variable)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors border border-indigo-200"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Dimension
            </button>
            <button
              type="button"
              id={`btn-edit-variable-${variable.id}`}
              onClick={() => onEditVariable(variable)}
              title="Edit Variable Definitions"
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              type="button"
              id={`btn-delete-variable-${variable.id}`}
              onClick={() => onDeleteVariable(variable)}
              title="Delete Variable and its hierarchy"
              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Operationalization Definitions */}
        {isExpanded && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200/70 text-xs">
            <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <Bookmark className="w-3.5 h-3.5 text-indigo-600" />
                Conceptual Definition:
              </span>
              <p className="text-slate-600 leading-relaxed italic">
                {variable.conceptualDefinition || (
                  <span className="text-slate-400 not-italic">No theoretical definition documented yet.</span>
                )}
              </p>
            </div>

            <div className="bg-white p-3 rounded-lg border border-slate-200/70 space-y-1">
              <span className="font-semibold text-slate-700 flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-indigo-600" />
                Operational Definition:
              </span>
              <p className="text-slate-600 leading-relaxed">
                {variable.operationalDefinition || (
                  <span className="text-slate-400 italic">No operational scoring definition entered yet.</span>
                )}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Dimensions & Indicators Hierarchy */}
      {isExpanded && (
        <div className="p-4 sm:p-5 space-y-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 uppercase tracking-wider pb-1">
            <span className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-indigo-700" />
              Dimensions ({variable.dimensions?.length || 0}) & Indicators ({totalIndicators})
            </span>
            <span className="text-[11px] font-normal lowercase text-slate-700">
              hierarchy: variable → dimension → indicator
            </span>
          </div>

          {(!variable.dimensions || variable.dimensions.length === 0) ? (
            <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500">
              <p className="font-medium text-slate-700 mb-0.5">No Dimensions Configured</p>
              <p className="mb-2">
                This construct is currently defined as a unidimensional or observed metric. If it contains sub-facets, you can add dimensions.
              </p>
              <button
                type="button"
                onClick={() => onAddDimension(variable)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-lg transition-colors shadow-2xs"
              >
                <Plus className="w-3.5 h-3.5" /> Add Dimension
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {variable.dimensions.map((dim, dIdx) => (
                <div
                  key={dim.id}
                  id={`dimension-block-${dim.id}`}
                  className="bg-slate-50/80 rounded-lg border border-slate-200/90 p-3.5 space-y-3"
                >
                  {/* Dimension Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 text-[11px] font-mono font-bold rounded bg-indigo-100 text-indigo-800 border border-indigo-200">
                        {dim.code}
                      </span>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-800">{dim.name}</h4>
                      {dim.definition && (
                        <span className="text-[11px] text-slate-500 hidden sm:inline truncate max-w-xs">
                          — {dim.definition}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1 self-end sm:self-center">
                      {/* Reorder Dimension */}
                      <button
                        type="button"
                        onClick={() => onReorderDimension(variable, dim, 'up')}
                        disabled={dIdx === 0}
                        title="Move Dimension Up"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onReorderDimension(variable, dim, 'down')}
                        disabled={dIdx === (variable.dimensions?.length || 0) - 1}
                        title="Move Dimension Down"
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>

                      {/* Add Indicator */}
                      <button
                        type="button"
                        id={`btn-add-indicator-${dim.id}`}
                        onClick={() => onAddIndicator(variable, dim)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-indigo-700 bg-white border border-indigo-200 hover:bg-indigo-50 rounded-md transition-colors shadow-2xs ml-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Indicator
                      </button>

                      <button
                        type="button"
                        onClick={() => onEditDimension(variable, dim)}
                        title="Edit Dimension"
                        className="p-1 text-slate-400 hover:text-slate-700 rounded"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteDimension(variable, dim)}
                        title="Delete Dimension"
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Indicators Sub-List */}
                  {(!dim.indicators || dim.indicators.length === 0) ? (
                    <div className="text-[11px] text-slate-400 italic bg-white/70 p-2.5 rounded border border-slate-200/60 flex items-center justify-between">
                      <span>No empirical indicators added yet under this dimension.</span>
                      <button
                        type="button"
                        onClick={() => onAddIndicator(variable, dim)}
                        className="text-indigo-600 hover:underline font-medium not-italic"
                      >
                        + Add First Indicator
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 pl-2 sm:pl-3 border-l-2 border-indigo-200">
                      {dim.indicators.map((ind, iIdx) => (
                        <div
                          key={ind.id}
                          id={`indicator-item-${ind.id}`}
                          className="bg-white p-2.5 rounded-md border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div className="flex items-start sm:items-center gap-2">
                            <span className="px-1.5 py-0.5 text-[10px] font-mono font-bold rounded bg-slate-100 text-slate-700 border border-slate-200 flex-shrink-0">
                              {ind.code}
                            </span>
                            <div>
                              <p className="font-semibold text-slate-800">{ind.name}</p>
                              {ind.definition && (
                                <p className="text-[11px] text-slate-500 line-clamp-1">{ind.definition}</p>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1 self-end sm:self-center flex-shrink-0">
                            {/* Reorder Indicator */}
                            <button
                              type="button"
                              onClick={() => onReorderIndicator(variable, dim, ind, 'up')}
                              disabled={iIdx === 0}
                              title="Move Indicator Up"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onReorderIndicator(variable, dim, ind, 'down')}
                              disabled={iIdx === (dim.indicators?.length || 0) - 1}
                              title="Move Indicator Down"
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 rounded"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() => onEditIndicator(variable, dim, ind)}
                              title="Edit Indicator"
                              className="p-1 text-slate-400 hover:text-slate-700 rounded"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteIndicator(variable, dim, ind)}
                              title="Delete Indicator"
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
