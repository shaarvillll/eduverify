import React from 'react';
import {
  Users,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { StatusBadge } from '../common/StatusBadge';
import { SyntheticBanner } from '../common/SyntheticBanner';

export const OverviewPage: React.FC = () => {
  const { stats, students, issues, institutions, setActiveTab, setSelectedStudent } = useApp();

  // Prepare chart data for Approved Intake vs Reported Enrolment per Institution
  const enrolmentChartData = institutions.map((inst) => {
    let approved = 0;
    let reported = 0;
    inst.programmes?.forEach((p) => {
      approved += p.approvedIntake || 0;
      reported += p.reportedEnrolment || 0;
    });
    return {
      name: inst.city,
      fullName: inst.name,
      approved,
      reported,
    };
  });

  // Prepare chart data for Validation Status distribution
  const statusPieData = [
    { name: 'Validated', value: stats.validatedStudents, color: '#059669' },
    { name: 'Requires Review', value: stats.reviewRequiredStudents, color: '#D97706' },
    { name: 'Pending Audit', value: stats.pendingStudents, color: '#64748B' },
    { name: 'Rejected', value: stats.rejectedStudents, color: '#DC2626' },
  ].filter((d) => d.value > 0);

  const recentStudents = students.slice(0, 5);
  const recentAlerts = issues.filter((i) => i.status === 'OPEN').slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Top Synthetic Compliance Notice */}
      <SyntheticBanner />

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Students */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Enrolled Students</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {stats.totalStudents}
            </span>
            <span className="text-xs text-slate-500 font-medium">registered</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>Across {stats.totalInstitutions} AICTE colleges</span>
          </div>
        </div>

        {/* Institutions */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Approved Institutions</span>
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono tabular-nums">
              {stats.totalInstitutions}
            </span>
            <span className="text-xs text-slate-500 font-medium">technical colleges</span>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            <span>Sanctioned Capacity: </span>
            <strong className="text-slate-700 font-mono tabular-nums">{stats.totalIntakeSeats}</strong> seats
          </div>
        </div>

        {/* Validated Records */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Validated APAAR Records</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-700 font-mono tabular-nums">
              {stats.validatedStudents}
            </span>
            <span className="text-xs text-slate-500 font-mono">
              ({stats.totalStudents ? Math.round((stats.validatedStudents / stats.totalStudents) * 100) : 0}%)
            </span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Format & intake compliant</span>
          </div>
        </div>

        {/* Records Requiring Review */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-semibold uppercase tracking-wider">Records Requiring Review</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-amber-700 font-mono tabular-nums">
              {stats.reviewRequiredStudents + stats.rejectedStudents}
            </span>
            <span className="text-xs text-slate-500 font-medium">exceptions</span>
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            <span>{stats.openIssuesCount} active validation items</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Enrolment vs Approved Intake Chart (2 Cols) */}
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Institutional Enrolment vs Approved Intake
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparing approved AICTE seat quotas against actual reported admissions.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-slate-300" />
                <span className="text-slate-600">Approved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-blue-600" />
                <span className="text-slate-600">Reported</span>
              </div>
            </div>
          </div>

          <div className="h-64 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={enrolmentChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="p-2.5 bg-slate-900 text-white rounded text-xs shadow-lg">
                          <div className="font-semibold text-slate-100">{data.fullName}</div>
                          <div className="mt-1 flex items-center justify-between gap-4 text-slate-300">
                            <span>Approved Quota:</span>
                            <span className="font-mono text-white">{data.approved}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4 text-slate-300">
                            <span>Reported Enrolment:</span>
                            <span className="font-mono text-blue-400">{data.reported}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="approved" fill="#CBD5E1" radius={[4, 4, 0, 0]} name="Approved Intake" />
                <Bar dataKey="reported" fill="#2563EB" radius={[4, 4, 0, 0]} name="Reported Enrolment" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Validation Status Breakdown Chart (1 Col) */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Registry Validation Breakdown
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Proportion of student dossiers validated vs pending review.
            </p>
          </div>

          <div className="h-48 mt-2 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusPieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {statusPieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="p-2 bg-slate-900 text-white rounded text-xs shadow-md">
                          <span className="font-medium">{data.name}:</span>{' '}
                          <span className="font-mono font-bold">{data.value} records</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 mt-auto pt-2 border-t border-slate-100 text-xs">
            {statusPieData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-slate-600">{item.name}</span>
                </div>
                <span className="font-mono font-medium text-slate-900 tabular-nums">
                  {item.value} ({Math.round((item.value / stats.totalStudents) * 100)}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lower Row: Recent Submissions & Recent Validation Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Submissions Table (2 Cols) */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Recent Student Enrolments</h3>
              <p className="text-xs text-slate-500">Newly recorded dossiers in the synthetic registry</p>
            </div>
            <button
              onClick={() => setActiveTab('students')}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors"
            >
              <span>View All Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mobile Card View (< 640px) */}
          <div className="sm:hidden divide-y divide-slate-100">
            {recentStudents.map((student) => (
              <div key={student.id} className="p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-slate-900 text-xs">{student.fullName}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{student.id}</div>
                  </div>
                  <StatusBadge status={student.validationStatus} />
                </div>
                <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded">
                  <div className="truncate text-slate-800 font-medium">{student.institutionName}</div>
                  <div className="flex items-center justify-between text-slate-500 mt-1">
                    <span className="font-mono text-slate-700">••••-••••-{student.apaarTestId.slice(-4)}</span>
                    <span className="truncate ml-2">{student.programmeName}</span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedStudent(student);
                    setActiveTab('students');
                  }}
                  className="w-full py-1.5 px-2.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors text-center min-h-[36px] flex items-center justify-center"
                >
                  View Details & Dossier
                </button>
              </div>
            ))}
          </div>

          {/* Desktop Table (>= 640px) */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">APAAR Test ID</th>
                  <th className="px-4 py-2.5">Institution</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-900">{student.fullName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{student.id}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      ••••-••••-{student.apaarTestId.slice(-4)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-slate-800 truncate max-w-xs">{student.institutionName}</div>
                      <div className="text-[11px] text-slate-500">{student.programmeName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={student.validationStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => {
                          setSelectedStudent(student);
                          setActiveTab('students');
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
                      >
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Validation Alerts List (1 Col) */}
        <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/50">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Validation Alerts</h3>
              <p className="text-xs text-slate-500">Requires institutional nodal action</p>
            </div>
            <button
              onClick={() => setActiveTab('issues')}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              <span>Manage</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            {recentAlerts.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                All validation alerts resolved.
              </div>
            ) : (
              recentAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 rounded border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-900 truncate">
                      {alert.studentName}
                    </span>
                    <StatusBadge status={alert.severity} showIcon={false} />
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-normal line-clamp-2">
                    {alert.reason}
                  </p>
                  <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px]">
                    <span className="text-slate-600 font-mono">{alert.recordId}</span>
                    <button
                      onClick={() => setActiveTab('issues')}
                      className="text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Review Issue →
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
