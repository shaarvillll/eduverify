import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Download,
  CheckCircle,
  FileText,
  BarChart2,
  PieChart as PieIcon,
  ShieldCheck,
  Calendar,
  Layers,
  ArrowDownToLine,
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
import { SyntheticBanner } from '../common/SyntheticBanner';

export const ReportsPage: React.FC = () => {
  const { students, issues, institutions, stats } = useApp();
  const [downloadSuccessMessage, setDownloadSuccessMessage] = useState<string | null>(null);

  // 1. Social Category Distribution
  const categoryCount: Record<string, number> = {};
  students.forEach((s) => {
    const cat = s.category || 'Unassigned';
    categoryCount[cat] = (categoryCount[cat] || 0) + 1;
  });
  const categoryData = Object.entries(categoryCount).map(([category, count]) => ({
    name: category,
    count,
  }));

  // 2. Admission Quota Distribution
  const quotaCount: Record<string, number> = {};
  students.forEach((s) => {
    const quota = s.admissionQuota || 'Unassigned';
    quotaCount[quota] = (quotaCount[quota] || 0) + 1;
  });
  const quotaData = [
    { name: 'State Merit', value: quotaCount['State Merit'] || 0, color: '#2563EB' },
    { name: 'All India AICTE', value: quotaCount['All India AICTE'] || 0, color: '#059669' },
    { name: 'Management', value: quotaCount['Management'] || 0, color: '#D97706' },
    { name: 'Lateral Entry', value: quotaCount['Lateral Entry'] || 0, color: '#7C3AED' },
  ].filter((d) => d.value > 0);

  // Download Student Master Register CSV
  const handleDownloadStudentRegister = () => {
    const headers = [
      'Student_ID',
      'Synthetic_APAAR_Test_ID',
      'Full_Name',
      'Gender',
      'DOB',
      'Category',
      'Institution_ID',
      'Institution_Name',
      'Programme_Name',
      'Academic_Year',
      'Semester',
      'Admission_Quota',
      'Validation_Status',
      'Discrepancy_Note',
      'Last_Updated',
    ];

    const rows = students.map((s) => [
      `"${s.id}"`,
      `"${s.apaarTestId}"`,
      `"${s.fullName}"`,
      `"${s.gender || ''}"`,
      `"${s.dob || ''}"`,
      `"${s.category || ''}"`,
      `"${s.institutionId || ''}"`,
      `"${(s.institutionName || '').replace(/"/g, '""')}"`,
      `"${(s.programmeName || '').replace(/"/g, '""')}"`,
      `"${s.academicYear || ''}"`,
      s.semester ?? '',
      `"${s.admissionQuota || ''}"`,
      `"${s.validationStatus}"`,
      `"${(s.discrepancyNote || '').replace(/"/g, '""')}"`,
      `"${s.lastUpdated}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `eduverify_student_master_register_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccessMessage('Student Master Register exported successfully.');
    setTimeout(() => setDownloadSuccessMessage(null), 4000);
  };

  // Download Discrepancy Audit Log CSV
  const handleDownloadDiscrepancyLog = () => {
    const headers = [
      'Issue_ID',
      'Record_ID',
      'Student_Name',
      'Synthetic_APAAR_Test_ID',
      'Institution_Name',
      'Programme_Name',
      'Issue_Type',
      'Severity',
      'Reason',
      'Recommended_Action',
      'Status',
      'Detected_Timestamp',
    ];

    const rows = issues.map((iss) => [
      `"${iss.id}"`,
      `"${iss.recordId}"`,
      `"${iss.studentName}"`,
      `"${iss.apaarTestId}"`,
      `"${iss.institutionName.replace(/"/g, '""')}"`,
      `"${iss.programmeName.replace(/"/g, '""')}"`,
      `"${iss.issueType}"`,
      `"${iss.severity}"`,
      `"${iss.reason.replace(/"/g, '""')}"`,
      `"${iss.recommendedAction.replace(/"/g, '""')}"`,
      `"${iss.status}"`,
      `"${iss.detectedAt}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `eduverify_audit_discrepancy_log_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccessMessage('Discrepancy Audit Log exported successfully.');
    setTimeout(() => setDownloadSuccessMessage(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Synthetic Notice */}
      <SyntheticBanner />

      {/* Header with Export Triggers */}
      <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Compliance Analytics & Regulatory Audit Packages
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Generate and export consolidated compliance reports for the AICTE scrutiny committee,
            enrolment statistics, demographic allocations, and historical validation registers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadStudentRegister}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-2xs"
          >
            <Download className="w-4 h-4" />
            <span>Export Master Register (CSV)</span>
          </button>
          <button
            onClick={handleDownloadDiscrepancyLog}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded border border-slate-200 transition-colors"
          >
            <ArrowDownToLine className="w-4 h-4 text-slate-500" />
            <span>Export Discrepancies (CSV)</span>
          </button>
        </div>
      </div>

      {/* Toast feedback */}
      {downloadSuccessMessage && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-center gap-2 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{downloadSuccessMessage}</span>
        </div>
      )}

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Overall Compliance Index
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-emerald-700 tabular-nums">
            {stats.totalStudents ? Math.round((stats.validatedStudents / stats.totalStudents) * 100) : 0}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.validatedStudents} of {stats.totalStudents} records fully validated
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Capacity Fill Ratio
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-blue-700 tabular-nums">
            {stats.totalIntakeSeats ? Math.round((stats.reportedIntakeSeats / stats.totalIntakeSeats) * 100) : 0}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.reportedIntakeSeats} reported / {stats.totalIntakeSeats} sanctioned seats
          </p>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Discrepancy Exception Rate
          </div>
          <div className="mt-2 text-2xl font-bold font-mono text-amber-700 tabular-nums">
            {stats.totalStudents
              ? Math.round(((stats.reviewRequiredStudents + stats.rejectedStudents) / stats.totalStudents) * 100)
              : 0}%
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {stats.openIssuesCount} active inspection flags logged
          </p>
        </div>
      </div>

      {/* Visual Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution Chart */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Reservation Category Enrolment
              </h3>
              <p className="text-xs text-slate-500">
                Representation across General, OBC-NCL, SC, ST, and EWS seats
              </p>
            </div>
            <BarChart2 className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-60 mt-4 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748B' }} axisLine={{ stroke: '#E2E8F0' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0];
                      return (
                        <div className="p-2 bg-slate-900 text-white rounded text-xs">
                          <span className="font-medium">{data.payload.name}:</span>{' '}
                          <span className="font-mono font-bold">{data.value} students</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="count" fill="#3B82F6" radius={[4, 4, 0, 0]} name="Students" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quota Breakdown Chart */}
        <div className="p-5 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col">
          <div className="pb-3 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Admission Quota Allocation
              </h3>
              <p className="text-xs text-slate-500">
                Breakdown by State Merit, All India, Management, and Lateral Entry
              </p>
            </div>
            <PieIcon className="w-4 h-4 text-slate-400" />
          </div>

          <div className="h-48 mt-2 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={quotaData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {quotaData.map((entry, index) => (
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
                          <span className="font-mono font-bold">{data.value} candidates</span>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1 mt-auto pt-2 border-t border-slate-100 text-xs">
            {quotaData.map((item) => (
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
    </div>
  );
};
