import React from 'react';
import {
  FileText,
  Target,
  FlaskConical,
  Users,
  Layers,
  Edit3,
  ArrowRight,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import { ResearchProject } from '../../types';
import { ProjectStatusBadge } from '../common/Badge';

interface ProjectOverviewTabProps {
  project: ResearchProject;
  variableCount: number;
  onEditProject: () => void;
  onProceedToVariables: () => void;
}

export const ProjectOverviewTab: React.FC<ProjectOverviewTabProps> = ({
  project,
  variableCount,
  onEditProject,
  onProceedToVariables,
}) => {
  return (
    <div className="space-y-6" id="project-overview-content">
      {/* Top Banner / Summary Card */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-6 sm:p-7">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <ProjectStatusBadge status={project.status} />
                {project.isDemo && (
                  <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                    Demo Data
                  </span>
                )}
                <span className="text-xs text-slate-700 flex items-center gap-1 font-medium">
                  <Calendar className="w-3 h-3 text-slate-700" />
                  Last Updated: {new Date(project.updatedAt).toLocaleDateString()}
                </span>
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {project.title}
              </h1>
              {project.researchTopic && (
                <p className="text-xs sm:text-sm text-indigo-700 font-semibold mt-1">
                  Topic: {project.researchTopic}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                id="btn-overview-edit-project"
                onClick={onEditProject}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit Setup
              </button>
              <button
                type="button"
                id="btn-overview-goto-variables"
                onClick={onProceedToVariables}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-xs"
              >
                Variables Workspace <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Research Design Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
            {/* Left Column: Research Objective & Problem */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-indigo-700" /> Research Objective & Problem Formulation
                </h2>
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg text-xs text-slate-700 leading-relaxed min-h-[100px]">
                  {project.researchObjective ? (
                    <p className="whitespace-pre-line">{project.researchObjective}</p>
                  ) : (
                    <p className="text-slate-400 italic">
                      No research objective has been drafted yet. Click "Edit Setup" to define your empirical problem statement.
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-indigo-700" /> Research Design & Methodology
                </h2>
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Primary Method: </span>
                    <span className="text-slate-800">{project.researchMethod || 'Not specified'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Investigation Design: </span>
                    <span className="text-slate-800">{project.researchDesign || 'Not specified'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Population, Sample & Construct Summary */}
            <div className="space-y-4">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-indigo-700" /> Target Population & Sampling Protocol
                </h2>
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-lg space-y-2 text-xs min-h-[100px]">
                  <div>
                    <span className="font-semibold text-slate-700">Target Population: </span>
                    <span className="text-slate-800">{project.population || 'General population (unspecified)'}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Sampling Technique: </span>
                    <span className="text-slate-800">{project.sampleDescription || 'Convenience / Stratified sample'}</span>
                  </div>
                </div>
              </div>

              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-700" /> Operationalization Status
                </h2>
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-lg text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-indigo-950">Active Constructs:</span>
                    <span className="font-bold text-indigo-700 bg-white px-2.5 py-0.5 rounded border border-indigo-200">
                      {variableCount} {variableCount === 1 ? 'Variable' : 'Variables'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Constructs define independent predictors, dependent outcomes, and control covariates before scale items and instruments are constructed.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Rigor & Academic Principles Notice */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span className="font-medium">
              Data Integrity Mode: Deterministic business logic with auditable data lineage.
            </span>
          </div>
          <span className="text-[11px] text-slate-700 font-mono">
            Project ID: {project.id}
          </span>
        </div>
      </div>
    </div>
  );
};
