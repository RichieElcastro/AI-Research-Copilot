import React, { useState, useEffect } from 'react';
import {
  Plus,
  Sliders,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  Eye,
  Trash2,
  Archive,
  ArrowRight,
  Sparkles,
  Layers,
  Scale,
  ShieldCheck,
} from 'lucide-react';
import { Instrument, InstrumentStatus, ResponseScale, Variable } from '../../types';
import { instrumentService } from '../../services/instrumentService';
import { scaleService } from '../../services/scaleService';
import { variableService } from '../../services/variableService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { InstrumentFormModal } from './InstrumentFormModal';
import { ScaleManagerModal } from './ScaleManagerModal';

interface InstrumentListProps {
  projectId: string;
  onSelectInstrument: (instrumentId: string) => void;
}

export const InstrumentList: React.FC<InstrumentListProps> = ({
  projectId,
  onSelectInstrument,
}) => {
  const { currentUser } = useAuth();
  const { success, error } = useToast();

  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isScaleLibraryOpen, setIsScaleLibraryOpen] = useState(false);

  const loadData = () => {
    if (!currentUser) return;
    setLoading(true);

    const instRes = instrumentService.getInstruments(projectId, currentUser.id);
    if (instRes.success && instRes.data) {
      setInstruments(instRes.data);
    }

    const varRes = variableService.getVariables(projectId, currentUser.id);
    if (varRes.success && varRes.data) {
      setVariables(varRes.data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [projectId]);

  const varsMap = new Map(variables.map(v => [v.id, v]));

  // Metrics
  const totalInstruments = instruments.length;
  const totalItems = instruments.reduce((sum, inst) => sum + (inst.items?.length || 0), 0);
  const approvedCount = instruments.filter(i => i.status === 'Approved').length;

  const handleCreateSubmit = (data: any) => {
    if (!currentUser) return;
    const res = instrumentService.createInstrument(
      projectId,
      currentUser.id,
      currentUser.name,
      data
    );
    if (res.success && res.data) {
      success('Instrument Created', `Instrument "${data.name}" added to project.`);
      setIsCreateOpen(false);
      loadData();
      onSelectInstrument(res.data.id);
    } else {
      error('Creation Failed', res.error);
    }
  };

  const handleDeleteInstrument = (e: React.MouseEvent, instrumentId: string, name: string) => {
    e.stopPropagation();
    if (!currentUser) return;
    const res = instrumentService.deleteInstrument(instrumentId, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Instrument Deleted', `Instrument "${name}" removed.`);
      loadData();
    } else {
      error('Cannot Delete', res.error);
    }
  };

  const handleArchiveInstrument = (e: React.MouseEvent, instrumentId: string) => {
    e.stopPropagation();
    if (!currentUser) return;
    const res = instrumentService.archiveInstrument(instrumentId, projectId, currentUser.id, currentUser.name);
    if (res.success) {
      success('Archived', 'Instrument archived.');
      loadData();
    } else {
      error('Archive Failed', res.error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Global Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Research Instruments &amp; Measurement Model</h2>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
              Phase 2
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Operationalize theoretical variables into standardized, reliable empirical measurement instruments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsScaleLibraryOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <Scale className="w-4 h-4 text-indigo-600" />
            Scale Library
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New Instrument
          </button>
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Total Instruments</span>
          <span className="text-xl font-bold text-slate-900">{totalInstruments}</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Measurement Items</span>
          <span className="text-xl font-bold text-indigo-600">{totalItems}</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Approved Instruments</span>
          <span className="text-xl font-bold text-emerald-600">{approvedCount}</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[11px] font-medium text-slate-500 block">Defined Constructs</span>
          <span className="text-xl font-bold text-slate-900">{variables.length}</span>
        </div>
      </div>

      {/* Instruments Grid */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-400">Loading research instruments...</div>
      ) : instruments.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-dashed border-slate-300">
          <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Research Instruments Configured</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            Each research variable can be measured by one or more instruments. Create an adapted, standardized,
            or researcher-developed measurement scale to operationalize your constructs.
          </p>
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-colors shadow-2xs inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Create First Instrument
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {instruments.map(inst => {
            const itemCount = inst.items?.length || 0;
            const reverseCount = inst.items?.filter(i => i.reverseCoded).length || 0;
            const isApproved = inst.status === 'Approved';

            return (
              <div
                key={inst.id}
                onClick={() => onSelectInstrument(inst.id)}
                className="p-5 bg-white rounded-2xl border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="space-y-3">
                  {/* Top Bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                          {inst.code}
                        </span>
                        <span className="font-mono text-xs text-slate-500">v{inst.version}</span>
                        <StatusBadge status={inst.status} />
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1 group-hover:text-indigo-600 transition-colors">
                        {inst.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1">
                      {inst.status !== 'Approved' && (
                        <button
                          type="button"
                          onClick={e => handleDeleteInstrument(e, inst.id, inst.name)}
                          title="Delete Instrument"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Purpose / Description */}
                  {inst.purpose && (
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {inst.purpose}
                    </p>
                  )}

                  {/* Source Reference */}
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                    <span className="font-semibold text-slate-700">{inst.sourceType}</span>
                    {inst.sourceReference && <span>• {inst.sourceReference}</span>}
                  </div>

                  {/* Mapped Variables Chips */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                      Measured Constructs:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {inst.variableIds.map(vid => {
                        const v = varsMap.get(vid);
                        return (
                          <span
                            key={vid}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium"
                          >
                            <span className="font-mono font-bold text-indigo-600">
                              {v?.code || 'VAR'}
                            </span>
                            <span>{v?.name || vid}</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Card Footer Metrics & Action */}
                <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3 text-slate-500">
                    <span className="font-semibold text-slate-700">
                      {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                    </span>
                    {reverseCount > 0 && (
                      <span className="text-amber-700 font-medium">
                        {reverseCount} Reverse Coded
                      </span>
                    )}
                  </div>

                  <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-0.5 transition-transform inline-flex items-center gap-1">
                    Open Builder
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <InstrumentFormModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreateSubmit}
        projectId={projectId}
      />

      <ScaleManagerModal
        isOpen={isScaleLibraryOpen}
        onClose={() => setIsScaleLibraryOpen(false)}
        projectId={projectId}
      />
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
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {status}
    </span>
  );
};
