import React, { useState, useEffect } from 'react';
import { History, Filter, RefreshCw, Layers } from 'lucide-react';
import { auditService } from '../../services/auditService';
import { AuditEntityType, AuditLog } from '../../types';
import { Badge } from '../common/Badge';

interface AuditTrailTabProps {
  projectId: string;
}

export const AuditTrailTab: React.FC<AuditTrailTabProps> = ({ projectId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [entityFilter, setEntityFilter] = useState<'all' | AuditEntityType>('all');

  const loadLogs = () => {
    const projectLogs = auditService.getProjectLogs(projectId);
    setLogs(projectLogs);
  };

  useEffect(() => {
    loadLogs();
  }, [projectId]);

  const filteredLogs = logs.filter(l => (entityFilter === 'all' ? true : l.entityType === entityFilter));

  const formatActionName = (action: string) => {
    return action
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getActionBadgeVariant = (action: string) => {
    if (action.includes('created')) return 'emerald';
    if (action.includes('updated')) return 'indigo';
    if (action.includes('deleted')) return 'rose';
    if (action.includes('archived')) return 'amber';
    return 'slate';
  };

  return (
    <div className="space-y-4" id="audit-trail-view">
      {/* Header & Filter Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
            <History className="w-4 h-4 text-indigo-600" />
            Empirical Audit Trail & Modification History
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log recording operationalization decisions, construct modifications, and metadata changes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Entity Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            {(['all', 'project', 'variable', 'dimension', 'indicator'] as const).map(type => (
              <button
                key={type}
                type="button"
                id={`btn-filter-audit-${type}`}
                onClick={() => setEntityFilter(type)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors capitalize ${
                  entityFilter === type
                    ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={loadLogs}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            title="Refresh Audit Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Entries Timeline */}
      {filteredLogs.length === 0 ? (
        <div className="p-8 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
          No audit logs recorded for this filter category yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="divide-y divide-slate-100">
            {filteredLogs.map(log => (
              <div key={log.id} className="p-4 hover:bg-slate-50/70 transition-colors flex items-start gap-3.5 text-xs">
                <div className="mt-0.5">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-[10px] uppercase ${
                      log.action.includes('created')
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : log.action.includes('updated')
                        ? 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                        : log.action.includes('deleted')
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {log.entityType[0]}
                  </span>
                </div>

                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={getActionBadgeVariant(log.action)}>
                        {formatActionName(log.action)}
                      </Badge>
                      <span className="font-semibold text-slate-900">{log.entityName || log.entityId}</span>
                      <span className="text-[11px] text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded font-mono font-medium">
                        {log.entityType}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-700 font-mono font-medium">
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-600 pt-0.5">
                    <span>
                      Actor: <span className="font-medium text-slate-700">{log.userName || log.userId}</span>
                    </span>
                    <span className="font-mono text-[10px] text-slate-600">ID: {log.id}</span>
                  </div>

                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-1.5 p-2 bg-slate-50 border border-slate-200 rounded font-mono text-[10px] text-slate-600 overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
