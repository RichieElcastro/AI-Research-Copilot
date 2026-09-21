import { DEMO_PROJECT } from '../data/demoData';
import { ProjectStatus, ResearchProject } from '../types';
import { ProjectRepository } from '../repositories';
import { auditService } from './auditService';

export interface ServiceResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  statusCode?: 200 | 201 | 400 | 403 | 404 | 409 | 500;
}

let memoryProjects: ResearchProject[] = [
  DEMO_PROJECT,
  {
    id: 'proj_foreign_test_999',
    userId: 'usr_foreign_attacker',
    title: 'Foreign Restricted Project',
    researchTopic: 'Confidential Internal Study',
    researchObjective: 'Unauthorized multi-tenant boundary probe target.',
    researchMethod: 'Quantitative Analysis',
    population: 'Internal',
    sampleDescription: 'N/A',
    researchDesign: 'Experimental',
    status: 'Draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const projectService = {
  _getAllProjects(): ResearchProject[] {
    return memoryProjects;
  },

  async loadFromServer(): Promise<ResearchProject[]> {
    try {
      const remote = await ProjectRepository.getAll();
      if (remote && remote.length > 0) {
        const remoteIds = new Set(remote.map(r => r.id));
        memoryProjects = [...remote, ...memoryProjects.filter(p => !remoteIds.has(p.id))];
      }
    } catch (e) {
      console.warn('Failed to load projects from server:', e);
    }
    return memoryProjects;
  },

  getProjects(userId?: string): ServiceResult<ResearchProject[]> {
    if (!userId) {
      return { success: false, error: 'Authentication required', statusCode: 403 };
    }
    const userProjects = memoryProjects.filter(p => p.userId === userId || p.isDemo);
    // Background sync with server
    this.loadFromServer();
    return { success: true, data: userProjects, statusCode: 200 };
  },

  getProject(projectId: string, userId: string): ServiceResult<ResearchProject> {
    if (!userId) {
      return { success: false, error: 'Authentication required. No active session.', statusCode: 403 };
    }
    const project = memoryProjects.find(p => p.id === projectId);
    if (!project) {
      return { success: false, error: 'Research project not found in repository.', statusCode: 404 };
    }
    if (project.userId !== userId && !project.isDemo) {
      return {
        success: false,
        error: `403 Forbidden: Security Violation. User "${userId}" is not authorized to access project "${projectId}" owned by "${project.userId}".`,
        statusCode: 403,
      };
    }
    return { success: true, data: project, statusCode: 200 };
  },

  async createProject(
    userId: string,
    userName: string,
    payload: {
      title: string;
      description?: string;
      researchTopic?: string;
      researchObjective?: string;
      researchMethod?: string;
      population?: string;
      sampleDescription?: string;
      researchDesign?: string;
    }
  ): Promise<ServiceResult<ResearchProject>> {
    const res = await ProjectRepository.create(payload);
    if (!res.success || !res.data) {
      return {
        success: false,
        error: res.error || 'Failed to create project',
        statusCode: (res.status as any) || 400,
      };
    }
    memoryProjects = [res.data, ...memoryProjects];

    auditService.logAction({
      userId,
      userName,
      projectId: res.data.id,
      action: 'project_created',
      entityType: 'project',
      entityId: res.data.id,
      entityName: res.data.title,
    });

    return { success: true, data: res.data, statusCode: 201 };
  },

  async updateProject(
    projectId: string,
    userId: string,
    userName: string,
    updates: Partial<ResearchProject>
  ): Promise<ServiceResult<ResearchProject>> {
    const authCheck = this.getProject(projectId, userId);
    if (!authCheck.success) {
      return authCheck;
    }

    const res = await ProjectRepository.update(projectId, updates);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to update project',
        statusCode: (res.status as any) || 400,
      };
    }

    const idx = memoryProjects.findIndex(p => p.id === projectId);
    if (idx !== -1) {
      memoryProjects[idx] = { ...memoryProjects[idx], ...updates, updatedAt: new Date().toISOString() };
    }

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'project_updated',
      entityType: 'project',
      entityId: projectId,
      entityName: memoryProjects[idx]?.title || projectId,
      metadata: updates,
    });

    return { success: true, data: memoryProjects[idx], statusCode: 200 };
  },

  async deleteProject(
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<void>> {
    const authCheck = this.getProject(projectId, userId);
    if (!authCheck.success) {
      return { success: false, error: authCheck.error, statusCode: authCheck.statusCode };
    }

    const res = await ProjectRepository.delete(projectId);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Failed to delete project',
        statusCode: (res.status as any) || 400,
      };
    }

    memoryProjects = memoryProjects.filter(p => p.id !== projectId);

    auditService.logAction({
      userId,
      userName,
      projectId,
      action: 'project_deleted',
      entityType: 'project',
      entityId: projectId,
      entityName: projectId,
    });

    return { success: true, statusCode: 200 };
  },

  async archiveProject(
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<ResearchProject>> {
    return this.updateProject(projectId, userId, userName, { status: 'Archived' });
  },

  async toggleArchive(
    projectId: string,
    userId: string,
    userName: string
  ): Promise<ServiceResult<ResearchProject>> {
    const proj = this.getProject(projectId, userId);
    if (!proj.success || !proj.data) {
      return proj;
    }
    const newStatus: ProjectStatus = proj.data.status === 'Archived' ? 'Draft' : 'Archived';
    return this.updateProject(projectId, userId, userName, { status: newStatus });
  },

  async loadDemoProjectForUser(
    userId: string,
    userName: string
  ): Promise<ServiceResult<ResearchProject>> {
    const existing = memoryProjects.find(p => p.userId === userId && p.isDemo);
    if (existing) {
      return { success: true, data: existing, statusCode: 200 };
    }
    const demo: ResearchProject = {
      ...DEMO_PROJECT,
      id: `proj_demo_${Date.now()}`,
      userId,
      isDemo: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    memoryProjects = [demo, ...memoryProjects];
    return { success: true, data: demo, statusCode: 201 };
  },
};
