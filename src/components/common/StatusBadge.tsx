import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { ValidationStatus, IssueSeverity } from '../../types';

interface StatusBadgeProps {
  status: ValidationStatus | IssueSeverity | 'COMPLIANT' | 'OVER_INTAKE' | 'VACANCY_WARNING' | 'OPEN' | 'RESOLVED' | 'DISMISSED';
  showIcon?: boolean;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  className = '',
}) => {
  switch (status) {
    case 'VALIDATED':
    case 'COMPLIANT':
    case 'RESOLVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-emerald-200 bg-emerald-50 text-emerald-800 ${className}`}
        >
          {showIcon && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
          <span>{status === 'VALIDATED' ? 'Validated' : status === 'COMPLIANT' ? 'Intake Compliant' : 'Resolved'}</span>
        </span>
      );

    case 'REQUIRES_REVIEW':
    case 'OVER_INTAKE':
    case 'HIGH':
    case 'OPEN':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-amber-200 bg-amber-50 text-amber-800 ${className}`}
        >
          {showIcon && <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />}
          <span>
            {status === 'REQUIRES_REVIEW'
              ? 'Requires Review'
              : status === 'OVER_INTAKE'
              ? 'Intake Exceeded'
              : status === 'HIGH'
              ? 'High Severity'
              : 'Open Review'}
          </span>
        </span>
      );

    case 'REJECTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-rose-200 bg-rose-50 text-rose-800 ${className}`}
        >
          {showIcon && <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
          <span>Rejected</span>
        </span>
      );

    case 'VACANCY_WARNING':
    case 'MEDIUM':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-orange-200 bg-orange-50 text-orange-800 ${className}`}
        >
          {showIcon && <AlertCircle className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
          <span>{status === 'VACANCY_WARNING' ? 'Low Enrolment' : 'Medium Severity'}</span>
        </span>
      );

    case 'PENDING':
    case 'LOW':
    case 'DISMISSED':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 bg-slate-100 text-slate-700 ${className}`}
        >
          {showIcon && <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />}
          <span>
            {status === 'PENDING'
              ? 'Pending Audit'
              : status === 'LOW'
              ? 'Low Severity'
              : status === 'DISMISSED'
              ? 'Dismissed'
              : status}
          </span>
        </span>
      );
  }
};
