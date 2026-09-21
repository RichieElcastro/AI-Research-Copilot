import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Search, FolderPlus, Sparkles, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { projectService } from '../../services/projectService';
import { variableService } from '../../services/variableService';
import { ProjectStatus, ResearchProject } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { EmptyState } from '../common/EmptyState';
import { ProjectCard } from './ProjectCard';
import { ProjectFormModal } from './ProjectFormModal';

interface ProjectListProps {
  onOpenProject: (project: ResearchProject) => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onOpenProject }) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();
  const { language, t } = useLanguage();

  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [variableCounts, setVariableCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | ProjectStatus>('All');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ResearchProject | null>(null);
  const [deletingProject, setDeletingProject] = useState<ResearchProject | null>(null);

  const loadProjects = async () => {
    if (!currentUser) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const res = projectService.getProjects(currentUser.id);
    if (res.success && res.data) {
      setProjects(res.data);

      // Load variable counts for each project
      const counts: Record<string, number> = {};
      for (const p of res.data) {
        const vRes = await variableService.getVariables(p.id, currentUser.id);
        counts[p.id] = vRes.success && vRes.data ? vRes.data.length : 0;
      }
      setVariableCounts(counts);
    } else {
      error('Failed to load projects', res.error);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProjects();
  }, [currentUser?.id]);

  const handleCreateOrUpdate = async (data: any) => {
    if (!currentUser) return;

    if (editingProject) {
      const res = await projectService.updateProject(editingProject.id, currentUser.id, currentUser.name, data);
      if (res.success && res.data) {
        success('Project Updated', `Modifications saved for "${res.data.title}".`);
        loadProjects();
      } else {
        error('Update Failed', res.error);
      }
    } else {
      const res = await projectService.createProject(currentUser.id, currentUser.name, data);
      if (res.success && res.data) {
        success('Research Project Created', `Workspace initialized for "${res.data.title}".`);
        loadProjects();
      } else {
        error('Creation Failed', res.error);
      }
    }
  };

  const handleArchive = async (project: ResearchProject) => {
    if (!currentUser) return;
    const res = await projectService.toggleArchive(project.id, currentUser.id, currentUser.name);
    if (res.success && res.data) {
      info(
        res.data.status === 'Archived' ? 'Project Archived' : 'Project Unarchived',
        `Status set to ${res.data.status}.`
      );
      loadProjects();
    } else {
      error('Action Failed', res.error);
    }
  };

  const handleDelete = async () => {
    if (!currentUser || !deletingProject) return;

    const res = await projectService.deleteProject(deletingProject.id, currentUser.id, currentUser.name);
    if (res.success) {
      success('Project Deleted', `Removed "${deletingProject.title}" and its associated variable definitions.`);
      setDeletingProject(null);
      loadProjects();
    } else {
      error('Deletion Denied', res.error);
    }
  };

  const handleLoadDemoProject = async () => {
    if (!currentUser) return;
    const res = await projectService.loadDemoProjectForUser(currentUser.id, currentUser.name);
    if (res.success && res.data) {
      success('Demo Research Loaded', 'Seeded the "Doomscrolling & Academic Burnout" project with complete variables and dimensions.');
      loadProjects();
    } else {
      error('Demo Load Failed', res.error);
    }
  };

  // Filtered list
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const matchesSearch =
        p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.researchTopic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.researchMethod.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  if (!currentUser) {
    return (
      <EmptyState
        id="unauthenticated-empty-state"
        icon={<AlertCircle className="w-8 h-8 text-indigo-600" />}
        title="Authentication Required"
        description="Please sign in or register with your institutional account to view and manage your strictly isolated research projects."
      />
    );
  }

  return (
    <div className="space-y-6" id="project-directory-view">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{t.projects.title}</h1>
          <p className="text-xs sm:text-sm text-slate-600 mt-0.5">
            {language === 'id' ? 'Repositori terisolasi untuk ' : 'Isolated repository for '}
            <span className="font-semibold text-indigo-700">{currentUser.name}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            id="btn-load-demo-data"
            onClick={handleLoadDemoProject}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-semibold rounded-lg transition-colors shadow-2xs"
            title={language === 'id' ? 'Muat proyek sampel akademik (Doomscrolling & Burnout)' : 'Seed an academic sample project (Doomscrolling & Burnout)'}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            {language === 'id' ? 'Muat Proyek Demo' : 'Load Demo Project'}
          </button>

          <button
            type="button"
            id="btn-create-project"
            onClick={() => {
              setEditingProject(null);
              setIsFormOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            {t.projects.newProject}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            id="input-search-projects"
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t.projects.searchPlaceholder}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { key: 'All', label: t.projects.filterAll },
            { key: 'Draft', label: t.projects.filterDraft },
            { key: 'Data Collection', label: language === 'id' ? 'Pengumpulan Data' : 'Data Collection' },
            { key: 'Analysis', label: language === 'id' ? 'Analisis' : 'Analysis' },
            { key: 'Completed', label: language === 'id' ? 'Selesai' : 'Completed' },
            { key: 'Archived', label: t.projects.filterArchived },
          ].map(tab => (
            <button
              key={tab.key}
              type="button"
              id={`filter-tab-${tab.key.toLowerCase().replace(' ', '-')}`}
              onClick={() => setStatusFilter(tab.key as any)}
              className={`px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap transition-colors ${
                statusFilter === tab.key
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Project Cards Grid / Empty State */}
      {loading ? (
        <div className="p-12 text-center text-xs text-slate-500">
          <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Loading researcher projects...
        </div>
      ) : filteredProjects.length === 0 ? (
        <EmptyState
          id="no-projects-empty-state"
          icon={<FolderPlus className="w-8 h-8 text-slate-400" />}
          title={searchQuery || statusFilter !== 'All' ? 'No matching projects found' : 'No Research Projects Yet'}
          description={
            searchQuery || statusFilter !== 'All'
              ? 'Try clearing your search query or switching your status filter.'
              : 'Begin by creating your first quantitative research investigation or explore with the pre-configured academic demo project.'
          }
          academicNote="A research project acts as the bounded workspace containing your operational definitions, variables, instrument items, and future empirical responses."
          actionLabel="Create New Project"
          onAction={() => {
            setEditingProject(null);
            setIsFormOpen(true);
          }}
          secondaryActionLabel="Load Sample Demo Project"
          onSecondaryAction={handleLoadDemoProject}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="projects-grid">
          {filteredProjects.map(proj => (
            <ProjectCard
              key={proj.id}
              project={proj}
              variableCount={variableCounts[proj.id] || 0}
              onOpen={onOpenProject}
              onEdit={p => {
                setEditingProject(p);
                setIsFormOpen(true);
              }}
              onArchive={handleArchive}
              onDelete={p => setDeletingProject(p)}
            />
          ))}
        </div>
      )}

      {/* Modal for Create/Edit Project */}
      <ProjectFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingProject(null);
        }}
        onSubmit={handleCreateOrUpdate}
        initialProject={editingProject}
      />

      {/* Safe Deletion Confirmation Modal */}
      <ConfirmModal
        id="confirm-delete-project-modal"
        isOpen={!!deletingProject}
        onClose={() => setDeletingProject(null)}
        onConfirm={handleDelete}
        title="Delete Research Project"
        message={`Are you sure you want to permanently delete the research project "${deletingProject?.title}"?`}
        cascadeWarning="Deleting this project will permanently remove all associated variables, dimensions, indicators, and audit records. This action cannot be undone."
        confirmLabel="Permanently Delete Project"
        isDanger={true}
      />
    </div>
  );
};
