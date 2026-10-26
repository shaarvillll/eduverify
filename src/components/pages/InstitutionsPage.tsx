import React, { useState } from 'react';
import {
  Building2,
  MapPin,
  Mail,
  GraduationCap,
  AlertTriangle,
  CheckCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Institution } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { SyntheticBanner } from '../common/SyntheticBanner';

export const InstitutionsPage: React.FC = () => {
  const { institutions, setActiveTab } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(institutions[0]?.id || null);
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>('ALL');

  const states = Array.from(new Set(institutions.map((i) => i.state)));

  const filteredInstitutions = institutions.filter((inst) => {
    if (selectedStateFilter !== 'ALL' && inst.state !== selectedStateFilter) {
      return false;
    }
    return true;
  });

  const toggleExpand = (id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="space-y-6">
      {/* Synthetic Banner */}
      <SyntheticBanner />

      {/* Header and Filter */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            AICTE Approved Institutions & Programme Intake Capacities
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Audit institutional seat allocations against reported enrolment rosters. Discrepancies where enrolment
            exceeds sanctioned limits are highlighted for regulatory inquiry.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <label className="font-semibold text-slate-500">Filter by State:</label>
          <select
            value={selectedStateFilter}
            onChange={(e) => setSelectedStateFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All States ({institutions.length} Colleges)</option>
            {states.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Institutions Accordion List */}
      <div className="space-y-4">
        {filteredInstitutions.map((inst) => {
          const isExpanded = expandedId === inst.id;

          // Calculate institution totals
          let totalApproved = 0;
          let totalReported = 0;
          let hasOverIntake = false;

          inst.programmes?.forEach((p) => {
            totalApproved += p.approvedIntake || 0;
            totalReported += p.reportedEnrolment || 0;
            if (p.intakeStatus === 'OVER_INTAKE') hasOverIntake = true;
          });

          const utilizationPct = totalApproved > 0 ? Math.round((totalReported / totalApproved) * 100) : 0;

          return (
            <div
              key={inst.id}
              className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden transition-all"
            >
              {/* Institution Header Card */}
              <div
                onClick={() => toggleExpand(inst.id)}
                className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
              >
                <div className="space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {inst.aicteCode}
                    </span>
                    <span className="text-xs text-slate-500 font-mono">({inst.id})</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-600 font-medium">{inst.type}</span>
                    {hasOverIntake && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                        <AlertTriangle className="w-3 h-3 text-rose-600" />
                        <span>Intake Discrepancy Flagged</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm md:text-base font-bold text-slate-900 leading-snug">
                    {inst.name}
                  </h3>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      {inst.city}, {inst.state}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {inst.contactEmail}
                    </span>
                    <span>·</span>
                    <span>Est. {inst.establishedYear}</span>
                  </div>
                </div>

                {/* Right: Enrolment Capacity Metric & Expand Button */}
                <div className="flex items-center gap-6 shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                  <div className="text-right">
                    <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                      Approved Capacity
                    </div>
                    <div className="text-sm font-mono font-bold text-slate-900 mt-0.5">
                      <span className={hasOverIntake ? 'text-rose-600' : 'text-slate-900'}>
                        {totalReported}
                      </span>{' '}
                      / {totalApproved} seats
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Utilization:{' '}
                      <strong className={utilizationPct > 100 ? 'text-rose-600' : 'text-emerald-700'}>
                        {utilizationPct}%
                      </strong>
                    </div>
                  </div>

                  <div className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-md">
                    {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Collapsible Programme Intake Breakdown */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-100 bg-slate-50/40">
                  <div className="flex items-center justify-between pb-3">
                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                      Departmental Intake Allocation & Verification Roster
                    </h4>
                    <span className="text-[11px] text-slate-500">
                      {(inst.programmes || []).length} approved degree programmes
                    </span>
                  </div>

                  <div className="overflow-x-auto bg-white rounded-md border border-slate-200">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-2.5">Programme Name</th>
                          <th className="px-4 py-2.5">Degree Level</th>
                          <th className="px-4 py-2.5 text-right">Approved Intake</th>
                          <th className="px-4 py-2.5 text-right">Reported Enrolment</th>
                          <th className="px-4 py-2.5">Capacity Bar</th>
                          <th className="px-4 py-2.5">Intake Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {(inst.programmes || []).map((prog) => {
                          const pct = Math.round((prog.reportedEnrolment / prog.approvedIntake) * 100);
                          const isOver = prog.intakeStatus === 'OVER_INTAKE';
                          const isVacant = prog.intakeStatus === 'VACANCY_WARNING';

                          return (
                            <tr key={prog.programmeId} className="hover:bg-slate-50/60">
                              <td className="px-4 py-3 font-semibold text-slate-800">
                                {prog.programmeName}
                              </td>
                              <td className="px-4 py-3 text-slate-600">{prog.degreeType}</td>
                              <td className="px-4 py-3 text-right font-mono font-medium text-slate-900">
                                {prog.approvedIntake}
                              </td>
                              <td className="px-4 py-3 text-right font-mono font-medium">
                                <span className={isOver ? 'text-rose-700 font-bold' : 'text-slate-900'}>
                                  {prog.reportedEnrolment}
                                </span>
                              </td>
                              <td className="px-4 py-3 w-40">
                                <div className="space-y-1">
                                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${
                                        isOver
                                          ? 'bg-rose-500'
                                          : isVacant
                                          ? 'bg-amber-400'
                                          : 'bg-emerald-500'
                                      }`}
                                      style={{ width: `${Math.min(pct, 100)}%` }}
                                    />
                                  </div>
                                  <div className="text-[10px] text-slate-500 font-mono text-right">
                                    {pct}% capacity
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap">
                                <StatusBadge status={prog.intakeStatus} />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
