import { AuditAction, AuditEntityType, AuditLog } from '../types';
import { storage } from './storage';

const AUDIT_LOGS_KEY = 'audit_logs';

export const auditService = {
  getLogs(): AuditLog[] {
    return storage.get<AuditLog[]>(AUDIT_LOGS_KEY, []);
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
    const logs = this.getLogs();
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

    const updated = [newLog, ...logs];
    storage.set(AUDIT_LOGS_KEY, updated);
    return newLog;
  },

  getProjectLogs(projectId: string): AuditLog[] {
    const logs = this.getLogs();
    return logs.filter(l => l.projectId === projectId);
  },

  deleteLogsForProject(projectId: string): void {
    const logs = this.getLogs();
    const filtered = logs.filter(l => l.projectId !== projectId);
    storage.set(AUDIT_LOGS_KEY, filtered);
  }
};
