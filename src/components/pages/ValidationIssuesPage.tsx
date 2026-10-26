import React, { useState, useMemo } from 'react';
import {
  AlertOctagon,
  Copy,
  FileQuestion,
  Binary,
  UsersRound,
  CheckCircle,
  XCircle,
  RotateCcw,
  Building,
  ArrowRight,
  Filter,
  RefreshCw,
  AlertTriangle,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { IssueType, ValidationIssue } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SyntheticBanner } from '../common/SyntheticBanner';

export const ValidationIssuesPage: React.FC = () => {
  const {
    issues,
    resolveIssue,
    triggerVerificationScan,
    setSelectedStudent,
    students,
    setActiveTab,
    currentUser,
  } = useApp();

  const [isScanning, setIsScanning] = useState(false);
  const [scanMessage, setScanMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const handleRunScan = async () => {
    setIsScanning(true);
    setScanMessage(null);
    const startTime = Date.now();
    try {
      const result = await triggerVerificationScan();
      const elapsed = Date.now() - startTime;
      if (elapsed < 400) {
        await new Promise((resolve) => setTimeout(resolve, 400 - elapsed));
      }
      setScanMessage({
        type: 'success',
        text: `Scan complete — ${result.detectedCount} active issue${result.detectedCount !== 1 ? 's' : ''} detected in PostgreSQL. Discrepancy queue and institutional intake capacities have been refreshed.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setScanMessage({ type: 'error', text: `Scan failed: ${msg}. Please verify that the backend server and PostgreSQL are connected.` });
    } finally {
      setIsScanning(false);
    }
  };

  const [resolvingIssueId, setResolvingIssueId] = useState<string | null>(null);
  const [issueActionError, setIssueActionError] = useState<{ issueId: string; message: string } | null>(null);

  const handleResolveIssue = async (issueId: string, resolution: 'RESOLVED' | 'DISMISSED' | 'OPEN') => {
    setResolvingIssueId(issueId);
    setIssueActionError(null);
    try {
      await resolveIssue(issueId, resolution);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update issue status';
      setIssueActionError({ issueId, message: msg });
    } finally {
      setResolvingIssueId(null);
    }
  };

  // Active category filter
  const [selectedCategory, setSelectedCategory] = useState<IssueType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'RESOLVED'>('OPEN');

  const categories: { id: IssueType | 'ALL'; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'ALL', label: 'All Discrepancies', icon: AlertOctagon },
    { id: 'DUPLICATE_RECORD', label: 'Duplicate Records', icon: Copy },
    { id: 'INVALID_FORMAT', label: 'Invalid ID Format', icon: Binary },
    { id: 'INTAKE_DISCREPANCY', label: 'Intake Discrepancies', icon: UsersRound },
    { id: 'MISSING_FIELD', label: 'Missing Fields', icon: FileQuestion },
  ];

  const filteredIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (selectedCategory !== 'ALL' && iss.issueType !== selectedCategory) {
        return false;
      }
      if (statusFilter !== 'ALL' && iss.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [issues, selectedCategory, statusFilter]);

  const handleInspectStudent = (recordId: string) => {
    const student = students.find((s) => s.id === recordId);
    if (student) {
      setSelectedStudent(student);
      setActiveTab('students');
    }
  };

  const openCount = issues.filter((i) => i.status === 'OPEN').length;
  const resolvedCount = issues.filter((i) => i.status === 'RESOLVED').length;

  return (
    <div className="space-y-6">
      {/* Synthetic Notice */}
      <SyntheticBanner />

      {/* Header and Status Toggle */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Intake & Regulatory Validation Discrepancy Queue
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Audit potential synthetic APAAR collisions, non-compliant ID syntaxes, missing registration fields,
            and batch enrolments that exceed AICTE sanctioned quotas.
          </p>
        </div>

        {/* Controls: Scan Trigger and Status Filter */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            onClick={handleRunScan}
            disabled={isScanning}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded transition-colors shadow-2xs ${
              isScanning
                ? 'bg-blue-100 text-blue-800 border border-blue-300 cursor-wait opacity-80'
                : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200'
            }`}
            title="Scan PostgreSQL database for duplicate synthetic APAAR IDs, intake discrepancies, and missing fields"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-blue-600 ${isScanning ? 'animate-spin' : ''}`} />
            <span>{isScanning ? 'Auditing Database...' : 'Run Audit Scan'}</span>
          </button>

          {/* Status Filter Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md border border-slate-200 text-xs w-full sm:w-auto justify-between sm:justify-start overflow-x-auto shrink-0">
            <button
              onClick={() => setStatusFilter('OPEN')}
              className={`px-3 py-1.5 font-medium rounded transition-colors whitespace-nowrap ${
                statusFilter === 'OPEN'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Open Alerts ({openCount})
            </button>
            <button
              onClick={() => setStatusFilter('RESOLVED')}
              className={`px-3 py-1.5 font-medium rounded transition-colors whitespace-nowrap ${
                statusFilter === 'RESOLVED'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Resolved ({resolvedCount})
            </button>
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 font-medium rounded transition-colors whitespace-nowrap ${
                statusFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({issues.length})
            </button>
          </div>
        </div>
      </div>

      {/* Audit Scan Feedback Banner */}
      {scanMessage && (
        <div
          role="alert"
          className={`p-4 rounded-lg border flex items-start justify-between gap-3 transition-all ${
            scanMessage.type === 'success'
              ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
              : 'bg-rose-50/90 border-rose-200 text-rose-900'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {scanMessage.type === 'success' ? (
              <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            )}
            <div>
              <div className="text-xs font-semibold">
                {scanMessage.type === 'success' ? 'Database Audit Complete' : 'Audit Notice'}
              </div>
              <p className="text-xs mt-0.5 leading-relaxed">{scanMessage.text}</p>
            </div>
          </div>
          <button
            onClick={() => setScanMessage(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded transition-colors text-xs"
            title="Dismiss notification"
          >
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Category Tabs (Segmented Controls) */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.id;
          const count =
            cat.id === 'ALL'
              ? issues.length
              : issues.filter((i) => i.issueType === cat.id).length;

          return (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{cat.label}</span>
              <span
                className={`ml-1 text-[10px] font-mono px-1.5 py-0.2 rounded ${
                  isActive ? 'bg-blue-700 text-blue-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Issues Cards List */}
      <div className="space-y-3">
        {filteredIssues.length === 0 ? (
          <div className="p-12 bg-white border border-slate-200 rounded-lg text-center space-y-2">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto" />
            <h3 className="text-sm font-semibold text-slate-800">No issues found in this category</h3>
            <p className="text-xs text-slate-400">
              All records for the selected filters comply with synthetic APAAR standards.
            </p>
          </div>
        ) : (
          filteredIssues.map((issue) => (
            <div
              key={issue.id}
              className={`p-5 bg-white border rounded-lg transition-shadow shadow-2xs ${
                issue.status === 'RESOLVED'
                  ? 'border-slate-200 opacity-80'
                  : issue.severity === 'HIGH'
                  ? 'border-slate-300'
                  : 'border-slate-200'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                {/* Left: Issue Details */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={issue.severity} />
                    <span className="text-xs font-mono font-medium text-slate-500">
                      ID: {issue.id}
                    </span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-semibold text-slate-900">
                      {issue.studentName}
                    </span>
                    <span className="text-xs font-mono text-slate-500">({issue.recordId})</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs font-mono text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      APAAR: ••••-••••-{issue.apaarTestId.slice(-4)}
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="font-medium text-slate-800">{issue.institutionName}</span>
                    <span>·</span>
                    <span className="text-slate-500">{issue.programmeName}</span>
                  </div>

                  {/* Discrepancy Reason */}
                  <div className="p-3 bg-slate-50 border border-slate-200/80 rounded text-xs space-y-1">
                    <div className="font-semibold text-slate-900">Detected Reason:</div>
                    <p className="text-slate-700 leading-relaxed">{issue.reason}</p>
                  </div>

                  {/* Recommended Action */}
                  <div className="text-xs text-blue-900 bg-blue-50/60 p-2.5 rounded border border-blue-100 flex items-start gap-2">
                    <div className="font-semibold shrink-0 text-blue-950">Recommended Action:</div>
                    <div className="text-blue-800">{issue.recommendedAction}</div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-3 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <div className="text-[11px] text-slate-500 font-mono">
                    Detected: {issue.detectedAt}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    {currentUser?.role === 'REGULATORY_REVIEWER' ? (
                      issue.status === 'OPEN' ? (
                        <>
                          <button
                            onClick={() => handleResolveIssue(issue.id, 'RESOLVED')}
                            disabled={resolvingIssueId === issue.id}
                            className="flex items-center justify-center gap-1 px-3 py-2 min-h-[34px] text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors shadow-2xs flex-1 sm:flex-initial"
                          >
                            {resolvingIssueId === issue.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}
                            <span>Mark Resolved</span>
                          </button>
                          <button
                            onClick={() => handleResolveIssue(issue.id, 'DISMISSED')}
                            disabled={resolvingIssueId === issue.id}
                            className="flex items-center justify-center gap-1 px-2.5 py-2 min-h-[34px] text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-slate-200 transition-colors flex-1 sm:flex-initial"
                          >
                            <span>Dismiss</span>
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => handleResolveIssue(issue.id, 'OPEN')}
                          disabled={resolvingIssueId === issue.id}
                          className="flex items-center justify-center gap-1 px-3 py-2 min-h-[34px] text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed rounded border border-blue-200 transition-colors flex-1 sm:flex-initial"
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${resolvingIssueId === issue.id ? 'animate-spin' : ''}`} />
                          <span>Re-open Issue</span>
                        </button>
                      )
                    ) : null}

                    <button
                      onClick={() => handleInspectStudent(issue.recordId)}
                      className="flex items-center justify-center gap-1 px-3 py-2 min-h-[34px] text-xs font-medium text-slate-700 hover:text-blue-600 hover:bg-slate-100 rounded border border-slate-200 sm:border-transparent transition-colors flex-1 sm:flex-initial"
                      title="Inspect student dossier"
                    >
                      <span>Dossier</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {issueActionError && issueActionError.issueId === issue.id && (
                    <div className="w-full mt-2 p-2 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start justify-between gap-1.5">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{issueActionError.message}</span>
                      </div>
                      <button
                        onClick={() => setIssueActionError(null)}
                        className="text-rose-600 hover:text-rose-800 font-bold px-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
