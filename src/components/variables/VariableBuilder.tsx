import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, Layers, Sparkles, Filter, HelpCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { variableService } from '../../services/variableService';
import { Dimension, Indicator, MeasurementScale, Variable, VariableRole } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { EmptyState } from '../common/EmptyState';
import { DimensionFormModal } from './DimensionFormModal';
import { IndicatorFormModal } from './IndicatorFormModal';
import { VariableCard } from './VariableCard';
import { VariableFormModal } from './VariableFormModal';

interface VariableBuilderProps {
  projectId: string;
  onProceedToNextStage?: () => void;
}

export const VariableBuilder: React.FC<VariableBuilderProps> = ({
  projectId,
  onProceedToNextStage,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();
  const { language, t } = useLanguage();

  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | VariableRole>('All');
  const [showMethodologyGuide, setShowMethodologyGuide] = useState(false);

  // Modals state
  const [isVarModalOpen, setIsVarModalOpen] = useState(false);
  const [editingVariable, setEditingVariable] = useState<Variable | null>(null);

  const [isDimModalOpen, setIsDimModalOpen] = useState(false);
  const [targetVarForDim, setTargetVarForDim] = useState<Variable | null>(null);
  const [editingDimension, setEditingDimension] = useState<Dimension | null>(null);

  const [isIndModalOpen, setIsIndModalOpen] = useState(false);
  const [targetVarForInd, setTargetVarForInd] = useState<Variable | null>(null);
  const [targetDimForInd, setTargetDimForInd] = useState<Dimension | null>(null);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(null);

  // Deletion Confirmation state
  const [deletionTarget, setDeletionTarget] = useState<{
    type: 'variable' | 'dimension' | 'indicator';
    variable: Variable;
    dimension?: Dimension;
    indicator?: Indicator;
    title: string;
    message: string;
    cascadeWarning?: string;
  } | null>(null);

  const loadVariables = async () => {
    if (!currentUser) return;
    setLoading(true);
    const res = await variableService.getVariables(projectId, currentUser.id);
    if (res.success && res.data) {
      setVariables(res.data);
    } else {
      error('Failed to load variables', res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadVariables();
  }, [projectId, currentUser?.id]);

  // Total Counts
  const totalDimensions = useMemo(() => {
    return variables.reduce((acc, v) => acc + (v.dimensions?.length || 0), 0);
  }, [variables]);

  const totalIndicators = useMemo(() => {
    return variables.reduce((acc, v) => {
      return (
        acc +
        (v.dimensions || []).reduce((dimSum, d) => dimSum + (d.indicators?.length || 0), 0)
      );
    }, 0);
  }, [variables]);

  // Filtered variables
  const filteredVariables = useMemo(() => {
    return variables.filter(v => {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        v.name.toLowerCase().includes(query) ||
        v.code.toLowerCase().includes(query) ||
        (v.conceptualDefinition && v.conceptualDefinition.toLowerCase().includes(query)) ||
        (v.operationalDefinition && v.operationalDefinition.toLowerCase().includes(query)) ||
        (v.dimensions &&
          v.dimensions.some(
            d =>
              d.name.toLowerCase().includes(query) ||
              d.code.toLowerCase().includes(query) ||
              (d.indicators &&
                d.indicators.some(
                  ind => ind.name.toLowerCase().includes(query) || ind.code.toLowerCase().includes(query)
                ))
          ));

      const matchesRole = roleFilter === 'All' || v.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [variables, searchQuery, roleFilter]);

  // ==========================================
  // VARIABLE HANDLERS
  // ==========================================

  const handleSaveVariable = async (data: {
    name: string;
    code: string;
    variableType: string;
    role: VariableRole;
    measurementScale: MeasurementScale;
    conceptualDefinition: string;
    operationalDefinition: string;
    description: string;
  }) => {
    if (!currentUser) return;

    if (editingVariable) {
      const res = await variableService.updateVariable(
        projectId,
        editingVariable.id,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success && res.data) {
        success('Variable Updated', `Changes saved for ${res.data.code}: ${res.data.name}`);
        loadVariables();
      } else {
        error('Update Failed', res.error);
      }
    } else {
      const res = await variableService.createVariable(
        projectId,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success && res.data) {
        success('Variable Defined', `Construct ${res.data.code}: ${res.data.name} initialized.`);
        loadVariables();
      } else {
        error('Definition Failed', res.error);
      }
    }
  };

  const confirmDeleteVariable = (variable: Variable) => {
    const dimCount = variable.dimensions?.length || 0;
    const indCount = (variable.dimensions || []).reduce(
      (sum, d) => sum + (d.indicators?.length || 0),
      0
    );

    setDeletionTarget({
      type: 'variable',
      variable,
      title: `Delete Variable: ${variable.code}`,
      message: `Are you sure you want to permanently delete the construct "${variable.code}: ${variable.name}"?`,
      cascadeWarning:
        dimCount > 0
          ? `This variable contains ${dimCount} dimensions and ${indCount} indicators. Deleting it will permanently cascade and remove all child dimensions and indicators.`
          : undefined,
    });
  };

  // ==========================================
  // DIMENSION HANDLERS
  // ==========================================

  const handleSaveDimension = async (data: {
    name: string;
    code: string;
    definition: string;
    description: string;
  }) => {
    if (!currentUser || !targetVarForDim) return;

    if (editingDimension) {
      const res = await variableService.updateDimension(
        projectId,
        targetVarForDim.id,
        editingDimension.id,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success && res.data) {
        success('Dimension Updated', `Saved ${res.data.code}: ${res.data.name}`);
        loadVariables();
      } else {
        error('Update Failed', res.error);
      }
    } else {
      const res = await variableService.createDimension(
        projectId,
        targetVarForDim.id,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success && res.data) {
        success('Dimension Added', `Created ${res.data.code}: ${res.data.name}`);
        loadVariables();
      } else {
        error('Failed to Add Dimension', res.error);
      }
    }
  };

  const confirmDeleteDimension = (variable: Variable, dimension: Dimension) => {
    const indCount = dimension.indicators?.length || 0;
    setDeletionTarget({
      type: 'dimension',
      variable,
      dimension,
      title: `Delete Dimension: ${dimension.code}`,
      message: `Are you sure you want to remove dimension "${dimension.code}: ${dimension.name}" from variable "${variable.code}"?`,
      cascadeWarning:
        indCount > 0
          ? `This dimension contains ${indCount} indicators that will be deleted.`
          : undefined,
    });
  };

  const handleReorderDimension = async (
    variable: Variable,
    dimension: Dimension,
    direction: 'up' | 'down'
  ) => {
    if (!currentUser) return;
    const res = await variableService.reorderDimensions(
      projectId,
      variable.id,
      dimension.id,
      direction,
      currentUser.id
    );
    if (res.success) {
      loadVariables();
    } else {
      error('Reorder Failed', res.error);
    }
  };

  // ==========================================
  // INDICATOR HANDLERS
  // ==========================================

  const handleSaveIndicator = async (data: {
    name: string;
    code: string;
    definition: string;
    description: string;
  }) => {
    if (!currentUser || !targetVarForInd || !targetDimForInd) return;

    if (editingIndicator) {
      const res = await variableService.updateIndicator(
        projectId,
        targetVarForInd.id,
        targetDimForInd.id,
        editingIndicator.id,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success && res.data) {
        success('Indicator Updated', `Saved ${res.data.code}: ${res.data.name}`);
        loadVariables();
      } else {
        error('Update Failed', res.error);
      }
    } else {
      const res = await variableService.createIndicator(
        projectId,
        targetVarForInd.id,
        targetDimForInd.id,
        currentUser.id,
        currentUser.name,
        data
      );
      if (res.success && res.data) {
        success('Indicator Added', `Created ${res.data.code}: ${res.data.name}`);
        loadVariables();
      } else {
        error('Failed to Add Indicator', res.error);
      }
    }
  };

  const confirmDeleteIndicator = (
    variable: Variable,
    dimension: Dimension,
    indicator: Indicator
  ) => {
    setDeletionTarget({
      type: 'indicator',
      variable,
      dimension,
      indicator,
      title: `Delete Indicator: ${indicator.code}`,
      message: `Are you sure you want to remove indicator "${indicator.code}: ${indicator.name}" from dimension "${dimension.code}"?`,
    });
  };

  const handleReorderIndicator = async (
    variable: Variable,
    dimension: Dimension,
    indicator: Indicator,
    direction: 'up' | 'down'
  ) => {
    if (!currentUser) return;
    const res = await variableService.reorderIndicators(
      projectId,
      variable.id,
      dimension.id,
      indicator.id,
      direction,
      currentUser.id
    );
    if (res.success) {
      loadVariables();
    } else {
      error('Reorder Failed', res.error);
    }
  };

  // Execute Confirmed Deletion
  const executeConfirmedDeletion = async () => {
    if (!currentUser || !deletionTarget) return;

    if (deletionTarget.type === 'variable') {
      const res = await variableService.deleteVariable(
        projectId,
        deletionTarget.variable.id,
        currentUser.id,
        currentUser.name
      );
      if (res.success) {
        success('Variable Deleted', `Permanently removed construct "${deletionTarget.variable.code}".`);
        loadVariables();
      } else {
        error('Deletion Failed', res.error);
      }
    } else if (deletionTarget.type === 'dimension' && deletionTarget.dimension) {
      const res = await variableService.deleteDimension(
        projectId,
        deletionTarget.variable.id,
        deletionTarget.dimension.id,
        currentUser.id,
        currentUser.name
      );
      if (res.success) {
        success('Dimension Deleted', `Removed dimension "${deletionTarget.dimension.code}".`);
        loadVariables();
      } else {
        error('Deletion Failed', res.error);
      }
    } else if (
      deletionTarget.type === 'indicator' &&
      deletionTarget.dimension &&
      deletionTarget.indicator
    ) {
      const res = await variableService.deleteIndicator(
        projectId,
        deletionTarget.variable.id,
        deletionTarget.dimension.id,
        deletionTarget.indicator.id,
        currentUser.id,
        currentUser.name
      );
      if (res.success) {
        success('Indicator Deleted', `Removed indicator "${deletionTarget.indicator.code}".`);
        loadVariables();
      } else {
        error('Deletion Failed', res.error);
      }
    }

    setDeletionTarget(null);
  };

  return (
    <div className="space-y-6" id="variable-builder-workspace">
      {/* Top Header & Stats Summary */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-indigo-600" />
                {language === 'id' ? 'Penyusun Konstruk & Variabel' : 'Construct & Variable Builder'}
              </h1>
              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded uppercase">
                {language === 'id' ? 'Tahap 2 dari 10' : 'Stage 2 of 10'}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {language === 'id'
                ? 'Operasionalisasikan konstruk teoretis menjadi dimensi teramati dan indikator empiris.'
                : 'Operationalize theoretical constructs into observable dimensions and empirical indicators.'}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              id="btn-toggle-methodology-guide"
              onClick={() => setShowMethodologyGuide(!showMethodologyGuide)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
              {showMethodologyGuide
                ? (language === 'id' ? 'Sembunyikan Panduan' : 'Hide Guide')
                : (language === 'id' ? 'Panduan Metodologi' : 'Methodology Guide')}
            </button>

            <button
              type="button"
              id="btn-add-new-variable"
              onClick={() => {
                setEditingVariable(null);
                setIsVarModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              {t.variables.addVariable}
            </button>
          </div>
        </div>

        {/* Hierarchy Metrics Bar */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 pt-4 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-700 font-medium uppercase tracking-wider">
              {language === 'id' ? 'Total Variabel' : 'Total Variables'}
            </p>
            <p className="text-base font-bold text-slate-900 mt-0.5">{variables.length}</p>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-700 font-medium uppercase tracking-wider">
              {language === 'id' ? 'Total Dimensi' : 'Total Dimensions'}
            </p>
            <p className="text-base font-bold text-indigo-700 mt-0.5">{totalDimensions}</p>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-700 font-medium uppercase tracking-wider">
              {language === 'id' ? 'Indikator Empiris' : 'Empirical Indicators'}
            </p>
            <p className="text-base font-bold text-emerald-700 mt-0.5">{totalIndicators}</p>
          </div>
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 hidden sm:block">
            <p className="text-[10px] text-slate-700 font-medium uppercase tracking-wider">
              {language === 'id' ? 'Standar Hirarki' : 'Hierarchy Standard'}
            </p>
            <p className="text-xs font-mono font-semibold text-slate-800 mt-1">Var → Dim → Ind</p>
          </div>
        </div>
      </div>

      {/* Methodology Guide Callout (Expandable) */}
      {showMethodologyGuide && (
        <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl text-xs space-y-3 animate-in fade-in duration-150">
          <p className="font-bold text-indigo-950 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            {language === 'id' ? 'Arsitektur Operasionalisasi Kuantitatif' : 'Quantitative Operationalization Architecture'}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-700 leading-relaxed">
            <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
              <span className="font-bold text-slate-900 block mb-1">
                {language === 'id' ? '1. Variabel / Konstruk' : '1. Variable / Construct'}
              </span>
              {language === 'id'
                ? 'Konsep abstrak tingkat tinggi (mis. Doomscrolling, Burnout). Peran mendefinisikan fungsi statistiknya: Independen (X), Dependen (Y), atau Kontrol (C).'
                : 'The high-level abstract concept (e.g. Doomscrolling, Burnout, Self-Efficacy). Roles define its statistical function: Independent ($X$), Dependent ($Y$), or Covariate ($C$).'}
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
              <span className="font-bold text-slate-900 block mb-1">
                {language === 'id' ? '2. Dimensi' : '2. Dimensions'}
              </span>
              {language === 'id'
                ? 'Faset teoretis atau sub-komponen dari konstruk multi-dimensi (mis. Konsumsi Kompulsif, Kelelahan Emosional).'
                : 'Theoretical facets or sub-components of a multi-dimensional construct (e.g. Compulsive Consumption, Difficulty Disengaging).'}
            </div>
            <div className="p-2.5 bg-white rounded-lg border border-indigo-100">
              <span className="font-bold text-slate-900 block mb-1">
                {language === 'id' ? '3. Indikator' : '3. Indicators'}
              </span>
              {language === 'id'
                ? 'Manifestasi empiris yang dapat diamati. Indikator ini berfungsi sebagai jangkar langsung untuk butir skala dan pertanyaan kuesioner.'
                : 'Observable empirical manifestations. These indicators serve as direct anchors for scale items, Likert questions, and future psychometric verification in Phase 2.'}
            </div>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="input-search-variables"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={language === 'id' ? 'Cari konstruk, dimensi, kode (cth. X1), atau indikator...' : 'Search constructs, dimensions, codes (e.g. X1), or indicators...'}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
          />
        </div>

        {/* Role Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <Filter className="w-3.5 h-3.5 text-slate-400 mr-1 flex-shrink-0" />
          {[
            { key: 'All', label: t.variables.filterAllRoles },
            { key: 'Independent Variable', label: language === 'id' ? 'Independen' : 'Independent' },
            { key: 'Dependent Variable', label: language === 'id' ? 'Dependen' : 'Dependent' },
            { key: 'Control Variable', label: language === 'id' ? 'Kontrol' : 'Control' },
            { key: 'Demographic Variable', label: language === 'id' ? 'Demografis' : 'Demographic' },
          ].map(role => (
            <button
              key={role.key}
              type="button"
              id={`filter-role-${role.key.toLowerCase().replace(' ', '-')}`}
              onClick={() => setRoleFilter(role.key as any)}
              className={`px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                roleFilter === role.key
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {role.label}
            </button>
          ))}
        </div>
      </div>

      {/* Variables List / Empty State */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          {language === 'id' ? 'Memuat hierarki konstruk...' : 'Loading construct hierarchies...'}
        </div>
      ) : filteredVariables.length === 0 ? (
        <EmptyState
          id="no-variables-empty-state"
          icon={<Layers className="w-8 h-8 text-slate-400" />}
          title={
            searchQuery || roleFilter !== 'All'
              ? (language === 'id' ? 'Tidak ada variabel yang cocok' : 'No matching variables found')
              : t.variables.emptyTitle
          }
          description={
            searchQuery || roleFilter !== 'All'
              ? (language === 'id' ? 'Coba ubah kata kunci pencarian atau setel ulang filter peran.' : 'Try modifying your search keywords or resetting your role filter.')
              : t.variables.emptyDesc
          }
          academicNote={
            language === 'id'
              ? 'Setiap penelitian kuantitatif memerlukan setidaknya satu Variabel Independen (prediktor) dan satu Variabel Dependen (kriteria/luaran) untuk menguji hipotesis relasional.'
              : 'Every quantitative research study requires at least one Independent Variable (predictor) and one Dependent Variable (criterion/outcome) to test relational hypotheses.'
          }
          actionLabel={t.variables.addFirst}
          onAction={() => {
            setEditingVariable(null);
            setIsVarModalOpen(true);
          }}
        />
      ) : (
        <div className="space-y-4" id="variable-cards-container">
          {filteredVariables.map(variable => (
            <VariableCard
              key={variable.id}
              variable={variable}
              onEditVariable={v => {
                setEditingVariable(v);
                setIsVarModalOpen(true);
              }}
              onDeleteVariable={confirmDeleteVariable}
              onAddDimension={v => {
                setTargetVarForDim(v);
                setEditingDimension(null);
                setIsDimModalOpen(true);
              }}
              onEditDimension={(v, d) => {
                setTargetVarForDim(v);
                setEditingDimension(d);
                setIsDimModalOpen(true);
              }}
              onDeleteDimension={confirmDeleteDimension}
              onReorderDimension={handleReorderDimension}
              onAddIndicator={(v, d) => {
                setTargetVarForInd(v);
                setTargetDimForInd(d);
                setEditingIndicator(null);
                setIsIndModalOpen(true);
              }}
              onEditIndicator={(v, d, ind) => {
                setTargetVarForInd(v);
                setTargetDimForInd(d);
                setEditingIndicator(ind);
                setIsIndModalOpen(true);
              }}
              onDeleteIndicator={confirmDeleteIndicator}
              onReorderIndicator={handleReorderIndicator}
            />
          ))}
        </div>
      )}

      {/* Navigation Footer */}
      {variables.length > 0 && onProceedToNextStage && (
        <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="text-xs text-slate-500">
            <span className="font-semibold text-slate-800">
              {language === 'id' ? 'Operasionalisasi Siap: ' : 'Operationalization Ready: '}
            </span>
            {variables.length} {language === 'id' ? 'konstruk terdefinisi dengan' : 'constructs defined with'} {totalDimensions} {language === 'id' ? 'dimensi dan' : 'dimensions and'} {totalIndicators} {language === 'id' ? 'indikator.' : 'indicators.'}
          </div>
          <button
            type="button"
            id="btn-proceed-to-stage-3"
            onClick={onProceedToNextStage}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-900 rounded-lg transition-colors shadow-xs"
          >
            {language === 'id' ? 'Lanjut ke Instrumen' : 'Proceed to Instruments'} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Modals */}
      <VariableFormModal
        isOpen={isVarModalOpen}
        onClose={() => {
          setIsVarModalOpen(false);
          setEditingVariable(null);
        }}
        onSubmit={handleSaveVariable}
        initialVariable={editingVariable}
        existingCodes={variables.map(v => v.code)}
      />

      <DimensionFormModal
        isOpen={isDimModalOpen}
        onClose={() => {
          setIsDimModalOpen(false);
          setTargetVarForDim(null);
          setEditingDimension(null);
        }}
        onSubmit={handleSaveDimension}
        initialDimension={editingDimension}
        variableName={targetVarForDim?.name || ''}
      />

      <IndicatorFormModal
        isOpen={isIndModalOpen}
        onClose={() => {
          setIsIndModalOpen(false);
          setTargetVarForInd(null);
          setTargetDimForInd(null);
          setEditingIndicator(null);
        }}
        onSubmit={handleSaveIndicator}
        initialIndicator={editingIndicator}
        dimensionName={targetDimForInd?.name || ''}
      />

      {/* Safe Deletion Confirmation Modal */}
      <ConfirmModal
        id="confirm-deletion-modal"
        isOpen={!!deletionTarget}
        onClose={() => setDeletionTarget(null)}
        onConfirm={executeConfirmedDeletion}
        title={deletionTarget?.title || 'Confirm Deletion'}
        message={deletionTarget?.message || 'Are you sure you want to delete this entity?'}
        cascadeWarning={deletionTarget?.cascadeWarning}
        confirmLabel="Permanently Delete"
        isDanger={true}
      />
    </div>
  );
};
