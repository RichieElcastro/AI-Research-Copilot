import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  ShieldAlert,
  FileCode,
  History,
  CheckCircle2,
  Calendar,
  Layers,
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useLanguage } from '../../context/LanguageContext';
import { projectService } from '../../services/projectService';
import { variableService } from '../../services/variableService';
import { ResearchProject } from '../../types';
import { ProjectStatusBadge } from '../common/Badge';
import { ProjectFormModal } from '../projects/ProjectFormModal';
import { SecurityTestModal } from '../projects/SecurityTestModal';
import { VariableBuilder } from '../variables/VariableBuilder';
import { InstrumentList } from '../instruments/InstrumentList';
import { InstrumentWorkspace } from '../instruments/InstrumentWorkspace';
import { AuditTrailTab } from './AuditTrailTab';
import { ProjectOverviewTab } from './ProjectOverviewTab';
import { WorkflowTracker } from './WorkflowTracker';
import { QuestionnaireTab } from '../questionnaires/QuestionnaireTab';
import { DataCollectionDashboard } from '../collection/DataCollectionDashboard';
import { DataProcessingDashboard } from '../processing/DataProcessingDashboard';
import { ScoringDashboard } from '../scoring/ScoringDashboard';
import { instrumentService } from '../../services/instrumentService';
import { scaleService } from '../../services/scaleService';

interface ProjectWorkspaceProps {
  projectId: string;
  onBackToProjects: () => void;
}

export const ProjectWorkspace: React.FC<ProjectWorkspaceProps> = ({
  projectId,
  onBackToProjects,
}) => {
  const { currentUser } = useAuth();
  const { success, error, info } = useToast();
  const { language, t } = useLanguage();

  const [project, setProject] = useState<ResearchProject | null>(null);
  const [variableCount, setVariableCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentStage, setCurrentStage] = useState<
    'setup' | 'variables' | 'instruments' | 'questionnaire' | 'collection' | 'processing' | 'scoring' | 'audit'
  >('setup');
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<string | null>(null);

  // Modals
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);

  const loadProjectData = async () => {
    if (!currentUser) return;
    setLoading(true);

    const pRes = projectService.getProject(projectId, currentUser.id);
    if (pRes.success && pRes.data) {
      setProject(pRes.data);

      const vRes = await variableService.getVariables(projectId, currentUser.id);
      setVariableCount(vRes.success && vRes.data ? vRes.data.length : 0);
    } else {
      error('Access Error', pRes.error || 'Failed to open project.');
      onBackToProjects();
    }
    setLoading(false);
  };

  useEffect(() => {
    loadProjectData();
  }, [projectId, currentUser?.id]);

  const handleUpdateProject = async (data: any) => {
    if (!currentUser || !project) return;
    const res = await projectService.updateProject(project.id, currentUser.id, currentUser.name, data);
    if (res.success && res.data) {
      setProject(res.data);
      success('Project Updated', `Setup information for "${res.data.title}" saved.`);
      loadProjectData();
    } else {
      error('Update Failed', res.error);
    }
  };

  const handleExportBlueprint = async () => {
    if (!project || !currentUser) return;
    const vRes = await variableService.getVariables(project.id, currentUser.id);
    const iRes = await instrumentService.getInstruments(project.id, currentUser.id);
    const sRes = await scaleService.getScales(project.id, currentUser.id);

    const blueprint = {
      manifestVersion: '2.0.0',
      exportedAt: new Date().toISOString(),
      project,
      variables: vRes.data || [],
      instruments: iRes.data || [],
      responseScales: sRes.data || [],
    };

    const blob = new Blob([JSON.stringify(blueprint, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qrp_blueprint_${project.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    info('Blueprint Exported', 'Quantitative research operationalization blueprint exported as JSON.');
  };

  if (loading || !project) {
    return (
      <div className="p-16 text-center text-xs text-slate-500">
        <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Authenticating researcher and loading workspace...
      </div>
    );
  }

  return (
    <div className="space-y-0" id="project-workspace-container">
      {/* Top Breadcrumb & Control Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="button"
                id="btn-back-to-projects"
                onClick={onBackToProjects}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2.5 py-1.5 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {language === 'id' ? 'Semua Proyek' : 'All Projects'}
              </button>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-900 truncate max-w-[280px] sm:max-w-md">
                  {project.title}
                </span>
                <ProjectStatusBadge status={project.status} />
              </div>
            </div>

            {/* Utility Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                id="btn-open-audit-trail"
                onClick={() => setCurrentStage('audit')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg transition-colors border ${
                  currentStage === 'audit'
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
                title="View Empirical Audit Trail"
              >
                <History className="w-3.5 h-3.5" />
                {t.stages.audit}
              </button>

              <button
                type="button"
                id="btn-export-blueprint"
                onClick={handleExportBlueprint}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                title="Export operational research blueprint"
              >
                <FileCode className="w-3.5 h-3.5 text-indigo-600" />
                {language === 'id' ? 'Ekspor JSON' : 'Export JSON'}
              </button>

              <button
                type="button"
                id="btn-open-security-test"
                onClick={() => setIsSecurityModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors"
                title="Execute security authorization tests to verify isolation against other researchers"
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                {t.navbar.securityAudit}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 10-Stage Workflow Tracker */}
      <WorkflowTracker
        currentStage={currentStage}
        onSelectStage={stage => {
          setCurrentStage(stage);
          if (stage !== 'instruments') {
            setSelectedInstrumentId(null);
          }
        }}
        variableCount={variableCount}
      />

      {/* Main Workspace Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentStage === 'setup' && (
          <ProjectOverviewTab
            project={project}
            variableCount={variableCount}
            onEditProject={() => setIsEditModalOpen(true)}
            onProceedToVariables={() => setCurrentStage('variables')}
          />
        )}

        {currentStage === 'variables' && (
          <VariableBuilder
            projectId={project.id}
            onProceedToNextStage={() => setCurrentStage('instruments')}
          />
        )}

        {currentStage === 'instruments' && (
          selectedInstrumentId ? (
            <InstrumentWorkspace
              instrumentId={selectedInstrumentId}
              projectId={project.id}
              onBack={() => setSelectedInstrumentId(null)}
            />
          ) : (
            <InstrumentList
              projectId={project.id}
              onSelectInstrument={id => setSelectedInstrumentId(id)}
            />
          )
        )}

        {currentStage === 'questionnaire' && (
          <QuestionnaireTab
            projectId={project.id}
            onNavigateToInstruments={() => {
              setCurrentStage('instruments');
              setSelectedInstrumentId(null);
            }}
          />
        )}

        {currentStage === 'collection' && (
          <DataCollectionDashboard
            projectId={project.id}
            onNavigateToStage={stage => setCurrentStage(stage)}
          />
        )}

        {currentStage === 'processing' && (
          <DataProcessingDashboard
            projectId={project.id}
            onNavigateToStage={stage => setCurrentStage(stage)}
          />
        )}

        {currentStage === 'scoring' && (
          <ScoringDashboard
            projectId={project.id}
            onNavigateToStage={stage => setCurrentStage(stage)}
          />
        )}

        {currentStage === 'audit' && <AuditTrailTab projectId={project.id} />}
      </div>

      {/* Edit Project Modal */}
      <ProjectFormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleUpdateProject}
        initialProject={project}
      />

      {/* Security Penetration Suite Modal */}
      <SecurityTestModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
      />
    </div>
  );
};
