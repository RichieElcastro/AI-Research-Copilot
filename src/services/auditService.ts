import { AuditAction, AuditEntityType, AuditLog } from '../types';
import { AuditRepository } from '../repositories';

let memoryLogs: AuditLog[] = [];

export const auditService = {
  async getLogs(projectId?: string): Promise<AuditLog[]> {
    if (!projectId) return memoryLogs;
    const res = await AuditRepository.getByProject(projectId);
    const remoteLogs = res.data || [];
    // Merge into memory logs
    memoryLogs = [
      ...remoteLogs,
      ...memoryLogs.filter(m => m.projectId !== projectId),
    ];
    return remoteLogs;
  },

  async getProjectLogs(projectId: string): Promise<AuditLog[]> {
    return this.getLogs(projectId);
  },

  getProjectLogsSync(projectId: string): AuditLog[] {
    return memoryLogs.filter(l => l.projectId === projectId);
  },

  logAction(params: {
    userId: string;
    userName?: string;
    projectId: string;
    action: AuditAction;
    entityType: AuditEntityType;
    entityId: string;
    entityName?: string;
    metadata?: Record<string, any>;
  }): AuditLog {
    const newLog: AuditLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: params.userId,
      userName: params.userName,
      projectId: params.projectId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      timestamp: new Date().toISOString(),
      metadata: params.metadata,
    };

    memoryLogs = [newLog, ...memoryLogs];

    // Authoritative Server append (tamper-evident audit trail)
    AuditRepository.log(params.projectId, {
      userId: params.userId,
      userName: params.userName,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      entityName: params.entityName,
      metadata: params.metadata,
    }).catch(err => {
      console.error('[AUDIT LOG ERROR] Failed to record audit log on server:', err);
    });

    return newLog;
  },

  deleteLogsForProject(projectId: string): void {
    // Tamper-evident policy: Audit logs are immutable records and cannot be deleted.
    console.warn('[AUDIT INTEGRITY] Audit logs are immutable and cannot be deleted.');
  },
};
