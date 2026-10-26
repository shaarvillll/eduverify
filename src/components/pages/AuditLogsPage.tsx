import React, { useState, useEffect } from 'react';
import {
  FileText,
  Filter,
  RefreshCw,
  Search,
  Shield,
  Clock,
  Terminal,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuditLogEntry } from '../../types';
import { API_BASE_URL } from '../../config';

export const AuditLogsPage: React.FC = () => {
  const { fetchWithAuth } = useApp();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionFilter, setActionFilter] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadAuditLogs = async () => {
    setIsLoading(true);
    try {
      let url = `${API_BASE_URL}/api/admin/audit-logs?limit=100`;
      if (actionFilter !== 'ALL') url += `&action=${encodeURIComponent(actionFilter)}`;
      if (roleFilter !== 'ALL') url += `&role=${encodeURIComponent(roleFilter)}`;

      const res = await fetchWithAuth(url);
      if (!res.ok) {
        throw new Error(`Failed to load audit logs (HTTP ${res.status})`);
      }
      const data = await res.json();
      setLogs(data.logs || []);
      setTotalCount(data.totalCount || 0);
    } catch (err: any) {
      console.error('Audit logs query error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter, roleFilter]);

  const toggleExpand = (id: string) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const getActionColor = (action: string) => {
    if (action.includes('LOGIN_SUCCESS')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (action.includes('FAILED') || action.includes('BLOCKED')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (action.includes('REGULATORY') || action.includes('DECISION')) return 'bg-purple-50 text-purple-700 border-purple-200';
    if (action.includes('DOCUMENT')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (action.includes('USER')) return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const filteredLogs = logs.filter((log) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      log.userEmail.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      (log.resourceType && log.resourceType.toLowerCase().includes(q)) ||
      (log.resourceId && log.resourceId.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span>Immutable Security Audit Log</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tamper-evident system event log stored in PostgreSQL. Captures all logins, status determinations, document views, and administrative actions with IP verification.
          </p>
        </div>

        <button
          onClick={loadAuditLogs}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs ({totalCount} total)</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 border border-slate-200 rounded-lg shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by user email, resource, or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Actions</option>
            <option value="LOGIN_SUCCESS">LOGIN_SUCCESS</option>
            <option value="LOGIN_FAILED">LOGIN_FAILED</option>
            <option value="REGULATORY_DECISION_RECORDED">REGULATORY_DECISION_RECORDED</option>
            <option value="STUDENT_RECORD_SUBMITTED">STUDENT_RECORD_SUBMITTED</option>
            <option value="STUDENT_BATCH_INGESTED">STUDENT_BATCH_INGESTED</option>
            <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
            <option value="DOCUMENT_ACCESSED">DOCUMENT_ACCESSED</option>
            <option value="ISSUE_STATUS_UPDATED">ISSUE_STATUS_UPDATED</option>
            <option value="USER_CREATED">USER_CREATED</option>
            <option value="USER_UPDATED">USER_UPDATED</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs border border-slate-200 rounded-md px-2 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="INSTITUTION_MEMBER">Institution Member</option>
            <option value="REGULATORY_REVIEWER">Regulatory Reviewer</option>
            <option value="SYSTEM_ADMIN">System Administrator</option>
            <option value="ANONYMOUS">Anonymous</option>
          </select>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-3 w-8"></th>
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Actor Email</th>
                <th className="py-3 px-3">Role</th>
                <th className="py-3 px-3">Action Performed</th>
                <th className="py-3 px-3">Resource Target</th>
                <th className="py-3 px-3">IP Address</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 font-sans">
                    {isLoading ? 'Loading audit records from PostgreSQL...' : 'No audit records match the selected filters.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <React.Fragment key={log.id}>
                      <tr
                        onClick={() => toggleExpand(log.id)}
                        className="hover:bg-slate-50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 px-3 text-slate-400">
                          {isExpanded ? (
                            <ChevronDown className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronRight className="w-3.5 h-3.5" />
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-800 truncate max-w-[180px]">
                          {log.userEmail}
                        </td>
                        <td className="py-2.5 px-3 font-sans">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {log.role}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getActionColor(
                              log.action
                            )}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                          {log.resourceType}
                          {log.resourceId ? ` · ${log.resourceId}` : ''}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                          {log.ipAddress || '127.0.0.1'}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="bg-slate-900 text-slate-200">
                          <td colSpan={7} className="p-4 font-mono text-[11px]">
                            <div className="flex items-center gap-2 text-slate-400 mb-2 font-sans font-semibold">
                              <Terminal className="w-3.5 h-3.5" />
                              <span>Audit Record Payload ID: {log.id}</span>
                            </div>
                            <pre className="bg-slate-950 p-3 rounded overflow-x-auto text-emerald-400 border border-slate-800">
                              {JSON.stringify(
                                {
                                  id: log.id,
                                  userId: log.userId,
                                  userEmail: log.userEmail,
                                  role: log.role,
                                  action: log.action,
                                  resourceType: log.resourceType,
                                  resourceId: log.resourceId,
                                  institutionId: log.institutionId,
                                  details: log.details,
                                  ipAddress: log.ipAddress,
                                  createdAt: log.createdAt,
                                },
                                null,
                                2
                              )}
                            </pre>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
