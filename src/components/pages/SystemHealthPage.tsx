import React, { useState, useEffect } from 'react';
import {
  Activity,
  Database,
  HardDrive,
  Cpu,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Server,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SystemHealthMetrics } from '../../types';
import { API_BASE_URL } from '../../config';

export const SystemHealthPage: React.FC = () => {
  const { fetchWithAuth } = useApp();
  const [metrics, setMetrics] = useState<SystemHealthMetrics | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastRefreshed, setLastRefreshed] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const loadHealthMetrics = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system-health`);
      if (!res.ok) {
        throw new Error(`Failed to load system health (HTTP ${res.status})`);
      }
      const data: SystemHealthMetrics = await res.json();
      setMetrics(data);
      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err: any) {
      setError(err.message || 'Error querying system health');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHealthMetrics();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
    if (mins > 0) return `${mins}m ${secs}s`;
    return `${secs}s`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Operational
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs font-mono text-slate-500">Refreshed: {lastRefreshed || 'Just now'}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 mt-1">
            System Health & Operational Telemetry
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time monitoring of PostgreSQL connection pool, multi-tenant database tables, and isolated document storage.
          </p>
        </div>

        <button
          onClick={loadHealthMetrics}
          disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh Telemetry</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DB Connection Pool */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">PostgreSQL Pool</span>
            <Database className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics?.database ? `${metrics.database.totalConnections} Conn` : '...'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Idle: {metrics?.database.idleConnections ?? 0}</span>
            <span>Waiting: {metrics?.database.waitingClients ?? 0}</span>
          </div>
        </div>

        {/* Server Uptime */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Runtime Uptime</span>
            <Activity className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics ? formatUptime(metrics.uptimeSeconds) : '...'}
          </div>
          <div className="text-[11px] text-emerald-700 mt-1 flex items-center gap-1">
            <CheckCircle className="w-3 h-3" />
            <span>Process Active</span>
          </div>
        </div>

        {/* Heap Memory */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Memory Allocation</span>
            <Cpu className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics ? formatBytes(metrics.memory.heapUsed) : '...'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Heap Total: {metrics ? formatBytes(metrics.memory.heapTotal) : '...'}
          </div>
        </div>

        {/* Storage Isolation */}
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold text-slate-600">Document Vault</span>
            <HardDrive className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-bold text-slate-900 font-mono">
            {metrics ? `${metrics.storage.filesOnDisk} Files` : '...'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Size: {metrics ? formatBytes(metrics.storage.totalSizeBytes) : '...'} · Non-Public
          </div>
        </div>
      </div>

      {/* Relational Table Record Counts */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              PostgreSQL Relational Tables & Row Counts
            </h3>
          </div>
          <span className="text-[11px] font-mono text-slate-400">Target: eduverify (public schema)</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-slate-500 text-[11px]">users</div>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {metrics?.recordCounts.users ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">RBAC & Clearance</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-slate-500 text-[11px]">institutions</div>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {metrics?.recordCounts.institutions ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Participating AICTE Units</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-slate-500 text-[11px]">students</div>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {metrics?.recordCounts.students ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Synthetic Student Registry</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-slate-500 text-[11px]">student_documents</div>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {metrics?.recordCounts.studentDocuments ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Vault Document Metadata</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-slate-500 text-[11px]">validation_issues</div>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {metrics?.recordCounts.validationIssues ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Detected Intake/ID Issues</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-slate-500 text-[11px]">document_mismatch_findings</div>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {metrics?.recordCounts.documentMismatchFindings ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">OCR Deterministic Findings</div>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-md">
            <div className="text-slate-500 text-[11px]">audit_logs</div>
            <div className="text-lg font-bold text-slate-900 font-mono mt-0.5">
              {metrics?.recordCounts.auditLogs ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Security Event Trail</div>
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-md">
            <div className="text-blue-700 text-[11px] font-medium">Node.js Environment</div>
            <div className="text-sm font-bold text-blue-900 font-mono mt-0.5">
              {metrics?.nodeVersion || 'v20+'}
            </div>
            <div className="text-[10px] text-blue-600 mt-0.5">OS: {metrics?.platform || 'darwin'}</div>
          </div>
        </div>
      </div>

      {/* Security & Access Controls Overview */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <ShieldCheck className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-900">
            Security Architecture & Isolation Enforcements
          </h3>
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="p-3 rounded bg-slate-50 border border-slate-100 space-y-1">
            <div className="font-semibold text-slate-800">1. Server-Side RBAC</div>
            <p className="text-[11px] text-slate-500">
              Institution Member, Regulatory Reviewer, and System Administrator identities verified via signed JWT tokens with PostgreSQL database synchronization.
            </p>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-100 space-y-1">
            <div className="font-semibold text-slate-800">2. Storage Isolation</div>
            <p className="text-[11px] text-slate-500">
              Student certificates are stored completely outside public directories. Raw file access requires authenticated token and explicit authorization checks.
            </p>
          </div>
          <div className="p-3 rounded bg-slate-50 border border-slate-100 space-y-1">
            <div className="font-semibold text-slate-800">3. Non-Repudiation Audit Log</div>
            <p className="text-[11px] text-slate-500">
              Every status determination, document inspection, and user provisioning event is recorded into PostgreSQL with IP tracking and timestamp.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
