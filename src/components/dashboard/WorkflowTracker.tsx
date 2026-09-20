import React from 'react';
import {
  FileText,
  Layers,
  ListTodo,
  FileQuestion,
  Inbox,
  Binary,
  Calculator,
  BarChart3,
  Award,
  Download,
  Lock,
  CheckCircle2,
} from 'lucide-react';
import { WorkflowStage } from '../../types';

interface WorkflowTrackerProps {
  currentStage: 'setup' | 'variables' | 'instruments' | 'audit';
  onSelectStage: (stage: 'setup' | 'variables' | 'instruments' | 'audit') => void;
  variableCount: number;
}

export const WORKFLOW_STAGES: WorkflowStage[] = [
  {
    id: 1,
    name: 'Research Setup',
    description: 'Empirical objectives, methodology, population & design',
    phaseNumber: 1,
    isImplemented: true,
    status: 'completed',
  },
  {
    id: 2,
    name: 'Variables',
    description: 'Constructs, roles, scales, dimensions & indicators',
    phaseNumber: 1,
    isImplemented: true,
    status: 'completed',
  },
  {
    id: 3,
    name: 'Instruments',
    description: 'Scale items, literature references & reverse scoring rules',
    phaseNumber: 2,
    isImplemented: true,
    status: 'active',
  },
  {
    id: 4,
    name: 'Questionnaire',
    description: 'Audit gates, consent form & versioned release candidate',
    phaseNumber: 3,
    isImplemented: false,
    status: 'upcoming',
  },
  {
    id: 5,
    name: 'Data Collection',
    description: 'Anonymous participant submission & raw response storage',
    phaseNumber: 4,
    isImplemented: false,
    status: 'upcoming',
  },
  {
    id: 6,
    name: 'Data Coding',
    description: 'Automated item-to-numeric coding & audit lineage tracking',
    phaseNumber: 5,
    isImplemented: false,
    status: 'upcoming',
  },
  {
    id: 7,
    name: 'Scoring',
    description: 'Reverse coding execution & composite variable aggregation',
    phaseNumber: 6,
    isImplemented: false,
    status: 'upcoming',
  },
  {
    id: 8,
    name: 'Statistical Analysis',
    description: 'Descriptives, Cronbach alpha, Pearson r, OLS Regression & t-test',
    phaseNumber: 7,
    isImplemented: false,
    status: 'upcoming',
  },
  {
    id: 9,
    name: 'Results',
    description: 'APA formatted tables, hypothesis decisions & verified reporting',
    phaseNumber: 8,
    isImplemented: false,
    status: 'upcoming',
  },
  {
    id: 10,
    name: 'Export',
    description: 'SPSS/R ready dataset, codebook metadata & audit manifest',
    phaseNumber: 9,
    isImplemented: false,
    status: 'upcoming',
  },
];

export const WorkflowTracker: React.FC<WorkflowTrackerProps> = ({
  currentStage,
  onSelectStage,
  variableCount,
}) => {
  const getStageIcon = (id: number) => {
    switch (id) {
      case 1:
        return <FileText className="w-3.5 h-3.5" />;
      case 2:
        return <Layers className="w-3.5 h-3.5" />;
      case 3:
        return <ListTodo className="w-3.5 h-3.5" />;
      case 4:
        return <FileQuestion className="w-3.5 h-3.5" />;
      case 5:
        return <Inbox className="w-3.5 h-3.5" />;
      case 6:
        return <Binary className="w-3.5 h-3.5" />;
      case 7:
        return <Calculator className="w-3.5 h-3.5" />;
      case 8:
        return <BarChart3 className="w-3.5 h-3.5" />;
      case 9:
        return <Award className="w-3.5 h-3.5" />;
      case 10:
        return <Download className="w-3.5 h-3.5" />;
      default:
        return <Layers className="w-3.5 h-3.5" />;
    }
  };

  return (
    <div className="bg-white border-b border-slate-200 shadow-2xs" id="workflow-lifecycle-tracker">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        {/* Tracker Header */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Quantitative Research Workflow
            </span>
            <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              Phase 1 &amp; 2 Active (Stages 1, 2 &amp; 3)
            </span>
          </div>
          <span className="text-xs text-slate-700 font-medium">
            {variableCount} {variableCount === 1 ? 'Construct defined' : 'Constructs defined'}
          </span>
        </div>

        {/* 10-Stage Horizontal Tracker */}
        <div className="overflow-x-auto pb-1.5 scrollbar-thin scrollbar-thumb-slate-300">
          <div className="flex items-center gap-1.5 min-w-max">
            {WORKFLOW_STAGES.map(stage => {
              const isFunctional = stage.isImplemented;
              const isSelected =
                (stage.id === 1 && currentStage === 'setup') ||
                (stage.id === 2 && currentStage === 'variables') ||
                (stage.id === 3 && currentStage === 'instruments');

              return (
                <button
                  key={stage.id}
                  type="button"
                  id={`stage-button-${stage.id}`}
                  disabled={!isFunctional}
                  onClick={() => {
                    if (stage.id === 1) onSelectStage('setup');
                    if (stage.id === 2) onSelectStage('variables');
                    if (stage.id === 3) onSelectStage('instruments');
                  }}
                  title={
                    isFunctional
                      ? `${stage.name}: Click to access stage workspace`
                      : `${stage.name}: Scheduled for Phase ${stage.phaseNumber}`
                  }
                  className={`group relative flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-all border ${
                    isSelected
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-semibold'
                      : isFunctional
                      ? 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200 font-medium cursor-pointer'
                      : 'bg-slate-50/50 text-slate-400 border-slate-200/60 cursor-not-allowed opacity-75'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : isFunctional
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-200/80 text-slate-500'
                    }`}
                  >
                    {stage.id}
                  </span>

                  <span className="flex items-center gap-1">
                    {getStageIcon(stage.id)}
                    <span>{stage.name}</span>
                  </span>

                  {!isFunctional && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-semibold text-slate-600 bg-slate-200/70 px-1.5 py-0.5 rounded">
                      <Lock className="w-2.5 h-2.5" /> P{stage.phaseNumber}
                    </span>
                  )}

                  {isFunctional && stage.id === 1 && (
                    <CheckCircle2 className={`w-3 h-3 ${isSelected ? 'text-indigo-200' : 'text-emerald-500'}`} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
