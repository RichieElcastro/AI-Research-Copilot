import React from 'react';
import { ArrowRight, Calendar, Edit3, Archive, Trash2, BookOpen, Layers } from 'lucide-react';
import { ResearchProject } from '../../types';
import { ProjectStatusBadge } from '../common/Badge';

interface ProjectCardProps {
  project: ResearchProject;
  variableCount: number;
  onOpen: (project: ResearchProject) => void;
  onEdit: (project: ResearchProject) => void;
  onArchive: (project: ResearchProject) => void;
  onDelete: (project: ResearchProject) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  variableCount,
  onOpen,
  onEdit,
  onArchive,
  onDelete,
}) => {
  const isArchived = project.status === 'Archived';

  return (
    <div
      id={`project-card-${project.id}`}
      className={`bg-white rounded-xl border transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col justify-between overflow-hidden ${
        isArchived ? 'border-slate-200 opacity-75' : 'border-slate-200/90 hover:border-indigo-300'
      }`}
    >
      <div className="p-5">
        {/* Header Badges */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <ProjectStatusBadge status={project.status} />
            {project.isDemo && (
              <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                Demo Data
              </span>
            )}
          </div>
          <span className="text-[11px] text-slate-700 flex items-center gap-1 font-medium">
            <Calendar className="w-3 h-3 text-slate-700" />
            {new Date(project.updatedAt).toLocaleDateString()}
          </span>
        </div>

        {/* Title */}
        <h3
          onClick={() => onOpen(project)}
          className="text-sm sm:text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer line-clamp-2 mb-2"
        >
          {project.title}
        </h3>

        {/* Topic & Objective */}
        {project.researchTopic && (
          <p className="text-xs text-indigo-700 font-medium mb-2 flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-indigo-700 flex-shrink-0" />
            <span className="line-clamp-1">{project.researchTopic}</span>
          </p>
        )}

        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
          {project.researchObjective || 'No research objective entered yet.'}
        </p>

        {/* Methodology & Variable Metrics */}
        <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100 text-xs">
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-700 font-medium uppercase tracking-wider">Methodology</p>
            <p className="text-xs font-semibold text-slate-800 truncate">
              {project.researchMethod || 'Survey Design'}
            </p>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
            <p className="text-[10px] text-slate-700 font-medium uppercase tracking-wider">Variables Defined</p>
            <p className="text-xs font-semibold text-indigo-700 flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-indigo-600" />
              {variableCount} {variableCount === 1 ? 'Construct' : 'Constructs'}
            </p>
          </div>
        </div>
      </div>

      {/* Card Footer Actions */}
      <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            id={`btn-edit-project-${project.id}`}
            onClick={() => onEdit(project)}
            title="Edit Research Information"
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            type="button"
            id={`btn-archive-project-${project.id}`}
            onClick={() => onArchive(project)}
            title={isArchived ? 'Unarchive Project' : 'Archive Project'}
            className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
          >
            <Archive className="w-4 h-4" />
          </button>
          <button
            type="button"
            id={`btn-delete-project-${project.id}`}
            onClick={() => onDelete(project)}
            title="Delete Project (Requires Confirmation)"
            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          id={`btn-open-workspace-${project.id}`}
          onClick={() => onOpen(project)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-2xs transition-colors"
        >
          Open Workspace <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
