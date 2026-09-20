import { DEMO_PROJECT, DEMO_VARIABLES } from '../data/demoData';
import { ProjectStatus, ResearchProject } from '../types';
import { auditService } from './auditService';
import { storage } from './storage';

const PROJECTS_KEY = 'projects';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: 200 | 201 | 400 | 403 | 404 | 409 | 500;
}

export const projectService = {
  /**
   * Internal retrieval of all stored projects
   */
  _getAllProjects(): ResearchProject[] {
    const projects = storage.get<ResearchProject[]>(PROJECTS_KEY, []);
    if (projects.length === 0) {
      // Initialize with demo project for Dr. Amelia Ross by default
      storage.set(PROJECTS_KEY, [DEMO_PROJECT]);
      return [DEMO_PROJECT];
    }
    return projects;
  },

  /**
   * List projects strictly owned by the authenticated user
   */
  getProjects(userId: string): ServiceResult<ResearchProject[]> {
    if (!userId) {
      return { success: false, error: 'Authentication required', statusCode: 403 };
    }
    const all = this._getAllProjects();
    const userProjects = all.filter(p => p.userId === userId);
    return { success: true, data: userProjects, statusCode: 200 };
  },

  /**
   * Get single project with strict server/repository layer ownership authorization
   */
  getProject(projectId: string, userId: string): ServiceResult<ResearchProject> {
    if (!userId) {
      return { success: false, error: 'Authentication required. No active session.', statusCode: 403 };
    }
    const all = this._getAllProjects();
    const project = all.find(p => p.id === projectId);

    if (!project) {
      return { success: false, error: 'Research project not found in repository.', statusCode: 404 };
    }

    // STRICT AUTHORIZATION CHECK
    if (project.userId !== userId) {
      return {
        success: false,
        error: `403 Forbidden: Security Violation. User "${userId}" is not authorized to access project "${projectId}" owned by "${project.userId}".`,
        statusCode: 403,
      };
    }

    return { success: true, data: project, statusCode: 200 };
  },

  /**
   * Create a new research project
   */
  createProject(
    userId: string,
    userName: string,
    payload: {
      title: string;
      researchTopic?: string;
      researchObjective?: string;
      researchMethod?: string;
      population?: string;
      sampleDescription?: string;
      researchDesign?: string;
      status?: ProjectStatus;
    }
  ): ServiceResult<ResearchProject> {
    if (!userId) {
      return { success: false, error: 'Authentication required', statusCode: 403 };
    }

    if (!payload.title || !payload.title.trim()) {
      return { success: false, error: 'Research project title is required.', statusCode: 400 };
    }

    const all = this._getAllProjects();
    const newProject: ResearchProject = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      title: payload.title.trim(),
      researchTopic: payload.researchTopic?.trim() || '',
      researchObjective: payload.researchObjective?.trim() || '',
      researchMethod: payload.researchMethod?.trim() || 'Quantitative Survey',
      population: payload.population?.trim() || '',
      sampleDescription: payload.sampleDescription?.trim() || '',
      researchDesign: payload.researchDesign?.trim() || 'Cross-Sectional Correlational',
      status: payload.status || 'Draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    all.unshift(newProject);
    storage.set(PROJECTS_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId: newProject.id,
      action: 'project_created',
      entityType: 'project',
      entityId: newProject.id,
      entityName: newProject.title,
      metadata: { status: newProject.status, researchMethod: newProject.researchMethod },
    });

    return { success: true, data: newProject, statusCode: 201 };
  },

  /**
   * Update an existing research project with strict ownership authorization
   */
  updateProject(
    projectId: string,
    userId: string,
    userName: string,
    updates: Partial<ResearchProject>
  ): ServiceResult<ResearchProject> {
    const authCheck = this.getProject(projectId, userId);
    if (!authCheck.success || !authCheck.data) {
      return authCheck;
    }

    const all = this._getAllProjects();
    const index = all.findIndex(p => p.id === projectId);
    if (index === -1) {
      return { success: false, error: 'Project not found.', statusCode: 404 };
    }

    // Disallow overriding ownership
    const safeUpdates = { ...updates };
    delete safeUpdates.userId;
    delete safeUpdates.id;

    const updatedProject: ResearchProject = {
      ...all[index],
      ...safeUpdates,
      updatedAt: new Date().toISOString(),
    };

    all[index] = updatedProject;
    storage.set(PROJECTS_KEY, all);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: updates.status === 'Archived' ? 'project_archived' : 'project_updated',
      entityType: 'project',
      entityId: projectId,
      entityName: updatedProject.title,
      metadata: { updatedFields: Object.keys(safeUpdates) },
    });

    return { success: true, data: updatedProject, statusCode: 200 };
  },

  /**
   * Archive / Unarchive project
   */
  toggleArchive(projectId: string, userId: string, userName: string): ServiceResult<ResearchProject> {
    const authCheck = this.getProject(projectId, userId);
    if (!authCheck.success || !authCheck.data) {
      return authCheck;
    }

    const newStatus: ProjectStatus = authCheck.data.status === 'Archived' ? 'Draft' : 'Archived';
    return this.updateProject(projectId, userId, userName, { status: newStatus });
  },

  /**
   * Delete a project and cascadingly delete its variables & audit records
   */
  deleteProject(projectId: string, userId: string, userName: string): ServiceResult<{ id: string }> {
    const authCheck = this.getProject(projectId, userId);
    if (!authCheck.success || !authCheck.data) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const projectTitle = authCheck.data.title;
    const all = this._getAllProjects();
    const filtered = all.filter(p => p.id !== projectId);
    storage.set(PROJECTS_KEY, filtered);

    // Cascading delete for variables belonging to this project
    const allVars = storage.get<any[]>('variables', []);
    const remainingVars = allVars.filter(v => v.projectId !== projectId);
    storage.set('variables', remainingVars);

    // Log the deletion action
    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'project_deleted',
      entityType: 'project',
      entityId: projectId,
      entityName: projectTitle,
      metadata: { cascadeDeleted: true },
    });

    return { success: true, data: { id: projectId }, statusCode: 200 };
  },

  /**
   * Load seed demo project explicitly for the current user
   */
  loadDemoProjectForUser(userId: string, userName: string): ServiceResult<ResearchProject> {
    const all = this._getAllProjects();
    const existing = all.find(p => p.userId === userId && p.isDemo);
    if (existing) {
      return { success: true, data: existing, statusCode: 200 };
    }

    const newDemoProject: ResearchProject = {
      ...DEMO_PROJECT,
      id: `proj_demo_${Date.now()}_${userId.slice(-4)}`,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    all.unshift(newDemoProject);
    storage.set(PROJECTS_KEY, all);

    // Also seed the demo variables linked to this new project
    const allVars = storage.get<any[]>('variables', []);
    const userDemoVars = DEMO_VARIABLES.map(v => ({
      ...v,
      id: `var_${Date.now()}_${v.code.toLowerCase()}`,
      projectId: newDemoProject.id,
      dimensions: v.dimensions.map(d => ({
        ...d,
        id: `dim_${Date.now()}_${d.code.toLowerCase()}`,
        variableId: `var_${Date.now()}_${v.code.toLowerCase()}`,
        indicators: d.indicators.map(ind => ({
          ...ind,
          id: `ind_${Date.now()}_${ind.code.toLowerCase().replace('.', '_')}`,
          dimensionId: `dim_${Date.now()}_${d.code.toLowerCase()}`,
          variableId: `var_${Date.now()}_${v.code.toLowerCase()}`,
        })),
      })),
    }));

    storage.set('variables', [...userDemoVars, ...allVars]);

    auditService.logAction({
      userId,
      userName,
      projectId: newDemoProject.id,
      action: 'project_created',
      entityType: 'project',
      entityId: newDemoProject.id,
      entityName: newDemoProject.title,
      metadata: { isDemo: true, variablesCount: userDemoVars.length },
    });

    return { success: true, data: newDemoProject, statusCode: 201 };
  },
};
