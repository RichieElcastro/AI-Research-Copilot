import React, { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Plus,
  Sliders,
  Eye,
  Sparkles,
  ShieldCheck,
  RotateCw,
  Copy,
  Trash2,
  Edit2,
  AlertCircle,
  FileSpreadsheet,
  CheckCircle2,
  ArrowUp,
  ArrowDown,
  Layers,
  Clock,
  History,
  Tag,
  Check,
  Archive,
} from 'lucide-react';
import {
  Instrument,
  InstrumentItem,
  InstrumentStatus,
  InstrumentValidationReport,
  InstrumentVersion,
  ResearchProject,
  ResponseScale,
  Variable,
} from '../../types';
import { instrumentService } from '../../services/instrumentService';
import { scaleService } from '../../services/scaleService';
import { variableService } from '../../services/variableService';
import { projectService } from '../../services/projectService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { InstrumentItemModal } from './InstrumentItemModal';
import { InstrumentFormModal } from './InstrumentFormModal';
import { ScaleManagerModal } from './ScaleManagerModal';
import { QuestionnairePreviewModal } from './QuestionnairePreviewModal';
import { AIReadinessModal } from './AIReadinessModal';
import { InstrumentValidationCard } from './InstrumentValidationCard';
import { AIGeneratorModal } from '../ai/AIGeneratorModal';

interface InstrumentWorkspaceProps {
  instrumentId: string;
  projectId: string;
  onBack: () => void;
}

export const InstrumentWorkspace: React.FC<InstrumentWorkspaceProps> = ({
  instrumentId,
  projectId,
  onBack,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();

  const [instrument, setInstrument] = useState<Instrument | null>(null);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [scales, setScales] = useState<ResponseScale[]>([]);
  const [versions, setVersions] = useState<InstrumentVersion[]>([]);
  const [validationReport, setValidationReport] = useState<InstrumentValidationReport | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InstrumentItem | null>(null);
  const [isEditSpecOpen, setIsEditSpecOpen] = useState(false);
  const [isScaleManagerOpen, setIsScaleManagerOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiContextPayload, setAIContextPayload] = useState<any>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [project, setProject] = useState<ResearchProject | null>(null);
  const [isAIGeneratorOpen, setIsAIGeneratorOpen] = useState(false);
  const [aiGeneratorIndicatorId, setAiGeneratorIndicatorId] = useState<string | undefined>(undefined);

  // Active view tab: 'items' | 'construct_tree' | 'validation' | 'versions'
  const [activeTab, setActiveTab] = useState<'items' | 'construct_tree' | 'validation' | 'versions'>('items');

  const loadData = () => {
    if (!currentUser) return;
    setLoading(true);

    const pRes = projectService.getProject(projectId, currentUser.id);
    if (pRes.success && pRes.data) {
      setProject(pRes.data);
    }

    const instRes = instrumentService.getInstrument(instrumentId, projectId, currentUser.id);
    if (instRes.success && instRes.data) {
      setInstrument(instRes.data);
    } else {
      error('Failed to load instrument', instRes.error);
      return;
    }

    const varRes = variableService.getVariables(projectId, currentUser.id);
    if (varRes.success && varRes.data) {
      setVariables(varRes.data);
    }

    const scaleRes = scaleService.getScales(projectId, currentUser.id);
    if (scaleRes.success && scaleRes.data) {
      setScales(scaleRes.data);
    }

    const verRes = instrumentService.getInstrumentVersions(instrumentId, projectId, currentUser.id);
    if (verRes.success && verRes.data) {
      setVersions(verRes.data);
    }

    const valRes = instrumentService.validateInstrument(instrumentId, projectId, currentUser.id);
    if (valRes.success && valRes.data) {
      setValidationReport(valRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [instrumentId, projectId]);

  if (loading || !instrument) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        Loading instrument workspace...
      </div>
    );
  }

  const isApproved = instrument.status === 'Approved';
  const isArchived = instrument.status === 'Archived';
  const items = instrument.items || [];
  const scalesMap = new Map(scales.map(s => [s.id, s]));
  const varsMap = new Map(variables.map(v => [v.id, v]));

  // Status Change (Draft <-> Review)
  const handleStatusChange = (newStatus: InstrumentStatus) => {
    if (!currentUser) return;
    if (isApproved && newStatus !== 'Archived') {
      error('Locked', 'Approved instruments must be branched via "Branch New Version".');
      return;
    }
    const res = instrumentService.updateInstrument(instrument.id, projectId, currentUser.id, currentUser.name, {
      status: newStatus,
    });
    if (res.success) {
      success('Status Updated', `Instrument status changed to ${newStatus}.`);
      loadData();
    } else {
      error('Status Update Failed', res.error);
    }
  };

  // Item Modal Submission
  const handleItemSubmit = (data: any) => {
    if (!currentUser) return;

    if (editingItem) {
      const res = instrumentService.updateItem(
        editingItem.id,
        instrument.id,
        projectId,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success) {
        success('Item Updated', `Item ${data.itemCode} updated.`);
        setIsItemModalOpen(false);
        setEditingItem(null);
        loadData();
      } else {
        error('Update Failed', res.error);
      }
    } else {
      const res = instrumentService.createItem(
        instrument.id,
        projectId,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success) {
        success('Item Created', `Item ${data.itemCode} added to instrument.`);
        setIsItemModalOpen(false);
        loadData();
      } else {
        error('Creation Failed', res.error);
      }
    }
  };

  // Delete Item
  const handleDeleteItem = (itemId: string, itemCode: string) => {
    if (!currentUser) return;
    if (isApproved) {
      error('Action Blocked', 'Approved instruments cannot delete items. Branch a new version first.');
      return;
    }
    const res = instrumentService.deleteItem(itemId, instrument.id, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Item Removed', `Item ${itemCode} deleted.`);
      loadData();
    } else {
      error('Deletion Failed', res.error);
    }
  };

  // Duplicate Item
  const handleDuplicateItem = (itemId: string) => {
    if (!currentUser) return;
    if (isApproved) {
      error('Action Blocked', 'Approved instruments cannot be edited. Branch a new version first.');
      return;
    }
    const res = instrumentService.duplicateItem(itemId, instrument.id, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Item Cloned', `Duplicate created: ${res.data?.itemCode}.`);
      loadData();
    } else {
      error('Cloning Failed', res.error);
    }
  };

  // Move Item Up / Down
  const handleMoveItem = (index: number, direction: 'up' | 'down') => {
    if (!currentUser || isApproved) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const ordered = [...items];
    const [moved] = ordered.splice(index, 1);
    ordered.splice(targetIndex, 0, moved);

    const orderedIds = ordered.map(it => it.id);
    const res = instrumentService.reorderItems(
      instrument.id,
      projectId,
      currentUser.id,
      currentUser.name,
      orderedIds
    );
    if (res.success) {
      loadData();
    } else {
      error('Reorder Failed', res.error);
    }
  };

  // Approve Instrument
  const handleApprove = (notes?: string) => {
    if (!currentUser) return;
    setIsApproving(true);
    const res = instrumentService.approveInstrument(
      instrument.id,
      projectId,
      currentUser.id,
      currentUser.name,
      notes
    );
    setIsApproving(false);
    if (res.success) {
      success('Instrument Approved', 'Instrument is approved and an immutable snapshot was created.');
      loadData();
    } else {
      error('Approval Failed', res.error);
    }
  };

  // Branch New Version
  const handleBranchVersion = () => {
    if (!currentUser) return;
    const res = instrumentService.createInstrumentVersion(
      instrument.id,
      projectId,
      currentUser.id,
      currentUser.name
    );
    if (res.success) {
      success('New Version Branched', `Created editable Draft v${res.data?.version}.`);
      loadData();
    } else {
      error('Branching Failed', res.error);
    }
  };

  // Export AI Context
  const handleExportAI = () => {
    if (!currentUser) return;
    const res = instrumentService.exportAIContext(instrument.id, projectId, currentUser.id);
    if (res.success) {
      setAIContextPayload(res.data);
      setIsAIModalOpen(true);
    } else {
      error('Export Failed', res.error);
    }
  };

  // Edit Instrument Specs
  const handleEditSpecsSubmit = (data: any) => {
    if (!currentUser) return;
    const res = instrumentService.updateInstrument(
      instrument.id,
      projectId,
      currentUser.id,
      currentUser.name,
      data
    );
    if (res.success) {
      success('Updated', 'Instrument specifications saved.');
      setIsEditSpecOpen(false);
      loadData();
    } else {
      error('Update Failed', res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Return to Instruments list"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">{instrument.name}</h2>
              <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                {instrument.code}
              </span>
              <span className="font-mono text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                v{instrument.version}
              </span>
              <StatusBadge status={instrument.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {instrument.sourceType} • {instrument.sourceReference || 'Empirically Developed'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Progression */}
          {!isApproved && !isArchived && (
            <select
              value={instrument.status}
              onChange={e => handleStatusChange(e.target.value as InstrumentStatus)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 shadow-2xs"
            >
              <option value="Draft">Status: Draft</option>
              <option value="Review">Status: In Review</option>
            </select>
          )}

          <button
            type="button"
            onClick={() => setIsPreviewOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5 text-indigo-600" />
            Preview Form
          </button>

          <button
            type="button"
            onClick={() => setIsScaleManagerOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-600" />
            Scale Library
          </button>

          <button
            type="button"
            onClick={handleExportAI}
            className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            AI Context
          </button>

          {!isApproved && !isArchived && (
            <button
              type="button"
              id="action-open-ai-generator"
              onClick={() => {
                setAiGeneratorIndicatorId(undefined);
                setIsAIGeneratorOpen(true);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate Items with AI
            </button>
          )}

          {!isApproved && (
            <button
              type="button"
              onClick={() => setIsEditSpecOpen(true)}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Edit2 className="w-3.5 h-3.5 text-slate-500" />
              Edit Specs
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center justify-between">
        <div className="flex space-x-6">
          <button
            type="button"
            onClick={() => setActiveTab('items')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'items'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Items &amp; Scales ({items.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('construct_tree')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'construct_tree'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Construct Tree &amp; Coverage</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('validation')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'validation'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Validation &amp; Approval</span>
            {validationReport && validationReport.errors.length > 0 && (
              <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {validationReport.errors.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('versions')}
            className={`py-3 text-xs font-bold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'versions'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Version History ({versions.length})</span>
          </button>
        </div>

        {/* Add Item Action (if on items tab and not approved) */}
        {activeTab === 'items' && !isApproved && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="items-open-ai-generator-btn"
              onClick={() => {
                setAiGeneratorIndicatorId(undefined);
                setIsAIGeneratorOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              AI Questionnaire Generator
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingItem(null);
                setIsItemModalOpen(true);
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Item Manually
            </button>
          </div>
        )}
      </div>

      {/* TAB CONTENT: Items */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {/* If Approved, show notice */}
          {isApproved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>
                  <strong>Version Locked:</strong> This instrument is Approved. Item definitions are locked to guarantee
                  empirical reproducibility. Click "Branch New Version" to propose alterations.
                </span>
              </div>
              <button
                type="button"
                onClick={handleBranchVersion}
                className="px-3 py-1 text-xs font-bold bg-white text-emerald-800 border border-emerald-300 rounded-md hover:bg-emerald-100"
              >
                Branch New Version
              </button>
            </div>
          )}

          {items.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-dashed border-slate-300">
              <FileSpreadsheet className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-800">No items created for this instrument yet</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Begin operationalizing your research variables by generating candidate items with the AI Questionnaire Generator or adding items manually.
              </p>
              {!isApproved && (
                <div className="mt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setAiGeneratorIndicatorId(undefined);
                      setIsAIGeneratorOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
                  >
                    <Sparkles className="w-4 h-4" />
                    Generate with AI
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setIsItemModalOpen(true);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors shadow-2xs inline-flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Add Item Manually
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-3 px-3 w-14 text-center">#</th>
                      <th className="py-3 px-3 w-24">Code</th>
                      <th className="py-3 px-4">Question Prompt</th>
                      <th className="py-3 px-3">Construct Mapping</th>
                      <th className="py-3 px-3">Scale</th>
                      <th className="py-3 px-3">Scoring</th>
                      <th className="py-3 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item, index) => {
                      const v = varsMap.get(item.variableId);
                      const d = v?.dimensions.find(dim => dim.id === item.dimensionId);
                      const ind = d?.indicators.find(i => i.id === item.indicatorId);
                      const scale = item.responseScaleId ? scalesMap.get(item.responseScaleId) : undefined;

                      return (
                        <tr key={item.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Order & Reordering */}
                          <td className="py-3 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <span className="font-bold text-slate-700 text-xs">{item.itemNumber}</span>
                              {!isApproved && (
                                <div className="flex flex-col">
                                  <button
                                    type="button"
                                    onClick={() => handleMoveItem(index, 'up')}
                                    disabled={index === 0}
                                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 p-0.5"
                                  >
                                    <ArrowUp className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveItem(index, 'down')}
                                    disabled={index === items.length - 1}
                                    className="text-slate-400 hover:text-slate-700 disabled:opacity-20 p-0.5"
                                  >
                                    <ArrowDown className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Item Code */}
                          <td className="py-3 px-3">
                            <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                              {item.itemCode}
                            </span>
                          </td>

                          {/* Question Prompt */}
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-900 leading-snug">
                              {item.questionText}
                              {item.required && <span className="text-rose-500 ml-1 font-bold">*</span>}
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                              {item.source === 'AI Generated' ? (
                                <span
                                  className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800"
                                  title={
                                    item.originalAiText
                                      ? `Original AI candidate statement: "${item.originalAiText}"`
                                      : 'Item was generated by AI assistant'
                                  }
                                >
                                  <Sparkles className="w-2.5 h-2.5" />
                                  AI Generated
                                  {item.modifiedByResearcher && ' (Edited)'}
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium text-slate-400">
                                  {item.source}
                                </span>
                              )}
                            </div>
                            {item.notes && (
                              <p className="text-[11px] text-slate-500 italic mt-0.5">{item.notes}</p>
                            )}
                          </td>

                          {/* Construct Mapping Hierarchy */}
                          <td className="py-3 px-3">
                            <div className="space-y-0.5 text-[11px]">
                              <div className="font-semibold text-indigo-700">
                                {v?.code ? `[${v.code}] ${v.name}` : 'Unmapped Variable'}
                              </div>
                              {d && <div className="text-slate-700 font-medium">Dim: {d.name}</div>}
                              {ind ? (
                                <div className="text-emerald-700 font-medium">Ind: {ind.name}</div>
                              ) : (
                                <div className="text-amber-700 italic">No indicator mapped</div>
                              )}
                            </div>
                          </td>

                          {/* Response Scale */}
                          <td className="py-3 px-3">
                            {scale ? (
                              <div>
                                <span className="font-semibold text-slate-800 block truncate max-w-[140px]" title={scale.name}>
                                  {scale.name}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  {scale.options.length} pts ({scale.minValue}–{scale.maxValue})
                                </span>
                              </div>
                            ) : (
                              <span className="text-rose-700 font-medium text-[11px]">Missing Scale</span>
                            )}
                          </td>

                          {/* Scoring / Reverse Coded */}
                          <td className="py-3 px-3">
                            {item.reverseCoded ? (
                              <span className="inline-flex items-center gap-1 font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                <RotateCw className="w-3 h-3" />
                                Reverse (Inverted)
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">Direct Scoring</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {!isApproved && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingItem(item);
                                      setIsItemModalOpen(true);
                                    }}
                                    title="Edit Item"
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDuplicateItem(item.id)}
                                    title="Clone Item"
                                    className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id, item.itemCode)}
                                    title="Delete Item"
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Construct Tree & Coverage */}
      {activeTab === 'construct_tree' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs">
            <h3 className="text-sm font-bold text-slate-900 mb-1">Construct Operationalization Coverage</h3>
            <p className="text-xs text-slate-500">
              Verify how each theoretical construct, dimension, and empirical indicator is operationalized across items in this instrument.
            </p>
          </div>

          <div className="space-y-4">
            {instrument.variableIds.map(vid => {
              const variable = varsMap.get(vid);
              if (!variable) return null;

              const variableItems = items.filter(it => it.variableId === vid);

              return (
                <div key={vid} className="p-5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800">
                        {variable.code}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900">{variable.name}</h4>
                      <span className="text-xs text-slate-500">({variable.role})</span>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                      {variableItems.length} {variableItems.length === 1 ? 'Item' : 'Items'} Mapped
                    </span>
                  </div>

                  {/* Dimensions & Indicators Tree */}
                  {variable.dimensions.length === 0 ? (
                    <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-500 italic">
                      No dimensions defined for this variable in Stage 2.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {variable.dimensions.map(dim => {
                        const dimItems = variableItems.filter(it => it.dimensionId === dim.id);
                        return (
                          <div key={dim.id} className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-800">
                                  {dim.code}
                                </span>
                                <span className="text-xs font-bold text-slate-800">{dim.name}</span>
                              </div>
                              <span className="text-[11px] font-medium text-slate-500">
                                {dimItems.length} items
                              </span>
                            </div>

                            {/* Indicators List */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-4 border-l-2 border-slate-200">
                              {dim.indicators.map(ind => {
                                const indItems = dimItems.filter(it => it.indicatorId === ind.id);
                                const hasItems = indItems.length > 0;
                                return (
                                  <div
                                    key={ind.id}
                                    className={`p-2 rounded-lg border text-xs flex items-start justify-between gap-2 ${
                                      hasItems
                                        ? 'bg-white border-emerald-200 text-slate-800'
                                        : 'bg-amber-50/50 border-amber-200 text-amber-900'
                                    }`}
                                  >
                                    <div>
                                      <div className="flex items-center gap-1.5 font-semibold">
                                        <span className="font-mono text-[10px] bg-slate-100 px-1 py-0.2 rounded">
                                          {ind.code}
                                        </span>
                                        <span>{ind.name}</span>
                                      </div>
                                      {hasItems && (
                                        <div className="flex flex-wrap gap-1 mt-1">
                                          {indItems.map(it => (
                                            <span
                                              key={it.id}
                                              className="font-mono text-[10px] px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded"
                                            >
                                              {it.itemCode}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                      {hasItems ? (
                                        <span className="text-[10px] font-bold text-emerald-700 px-1.5 py-0.5 bg-emerald-50 rounded">
                                          {indItems.length} {indItems.length === 1 ? 'item' : 'items'}
                                        </span>
                                      ) : (
                                        <>
                                          <span className="text-[10px] font-bold text-amber-700 px-1.5 py-0.5 bg-amber-100 rounded">
                                            0 items (Uncovered)
                                          </span>
                                          {!isApproved && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setAiGeneratorIndicatorId(ind.id);
                                                setIsAIGeneratorOpen(true);
                                              }}
                                              className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition"
                                            >
                                              <Sparkles className="w-2.5 h-2.5 text-indigo-600" />
                                              Generate with AI
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB CONTENT: Validation & Approval */}
      {activeTab === 'validation' && (
        <InstrumentValidationCard
          instrument={instrument}
          report={validationReport}
          onApprove={handleApprove}
          onBranchVersion={handleBranchVersion}
          isApproving={isApproving}
        />
      )}

      {/* TAB CONTENT: Version History */}
      {activeTab === 'versions' && (
        <div className="space-y-4">
          <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Immutable Version Snapshots</h3>
              <p className="text-xs text-slate-500">
                Audit trail of verified instrument releases, items, and response scales for peer review and reproducibility.
              </p>
            </div>
            {isApproved && (
              <button
                type="button"
                onClick={handleBranchVersion}
                className="px-3.5 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center gap-1.5"
              >
                <RotateCw className="w-3.5 h-3.5" />
                Branch New Version (v{(parseFloat(instrument.version) + 1.0).toFixed(1)})
              </button>
            )}
          </div>

          {versions.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
              No historical approved versions yet. When this instrument is Approved, an immutable snapshot will be saved here.
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map(ver => (
                <div
                  key={ver.id}
                  className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-indigo-100 text-indigo-800">
                        Version {ver.versionNumber}
                      </span>
                      <span className="text-xs font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded-full">
                        {ver.status}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(ver.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600">
                    Approved by: <strong>{ver.snapshot.approvedBy || 'Researcher'}</strong>
                    {ver.snapshot.notes && (
                      <span className="block mt-1 italic text-slate-500">"{ver.snapshot.notes}"</span>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center gap-4 text-xs text-slate-500">
                    <span>
                      Items Snapshot: <strong>{ver.snapshot.items?.length || 0} items</strong>
                    </span>
                    <span>
                      Scales: <strong>{ver.snapshot.scalesSnapshot?.length || 0} scales</strong>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODALS */}
      <InstrumentItemModal
        isOpen={isItemModalOpen}
        onClose={() => {
          setIsItemModalOpen(false);
          setEditingItem(null);
        }}
        onSubmit={handleItemSubmit}
        initialItem={editingItem}
        instrument={instrument}
        projectId={projectId}
        onOpenScaleManager={() => setIsScaleManagerOpen(true)}
      />

      <InstrumentFormModal
        isOpen={isEditSpecOpen}
        onClose={() => setIsEditSpecOpen(false)}
        onSubmit={handleEditSpecsSubmit}
        initialInstrument={instrument}
        projectId={projectId}
      />

      <ScaleManagerModal
        isOpen={isScaleManagerOpen}
        onClose={() => setIsScaleManagerOpen(false)}
        projectId={projectId}
        onScaleChanged={loadData}
      />

      <QuestionnairePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        instrument={instrument}
        variables={variables}
        scales={scales}
      />

      <AIReadinessModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        contextPayload={aiContextPayload}
        instrumentName={instrument.name}
      />

      {project && currentUser && (
        <AIGeneratorModal
          isOpen={isAIGeneratorOpen}
          onClose={() => setIsAIGeneratorOpen(false)}
          project={project}
          instrument={instrument}
          userId={currentUser.id}
          userName={currentUser.name}
          initialIndicatorId={aiGeneratorIndicatorId}
          onItemsAddedToInstrument={() => {
            loadData();
          }}
        />
      )}
    </div>
  );
};

const StatusBadge = ({ status }: { status: InstrumentStatus }) => {
  const styles: Record<InstrumentStatus, string> = {
    Draft: 'bg-amber-50 text-amber-700 border-amber-200',
    Review: 'bg-blue-50 text-blue-700 border-blue-200',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Archived: 'bg-slate-100 text-slate-600 border-slate-200',
  };

  return (
    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
};
