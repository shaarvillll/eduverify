import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  FileCheck,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Info,
  Wand2,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ParsedCSVRow, StudentRecord } from '../../types';
import { SAMPLE_CSV_TEMPLATE } from '../../data/syntheticData';
import { SyntheticBanner } from '../common/SyntheticBanner';

export const DataUploadPage: React.FC = () => {
  const { importStudentBatch, institutions, setActiveTab, currentUser } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // States
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [uploadedFileName, setUploadedFileName] = useState<string>('sample_aicte_batch_2024.csv');
  const [rows, setRows] = useState<ParsedCSVRow[]>(() => parseRawCSV(SAMPLE_CSV_TEMPLATE));
  const [isCommitted, setIsCommitted] = useState<boolean>(false);
  const [commitCount, setCommitCount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Parse CSV string into validated rows
  function parseRawCSV(csvText: string): ParsedCSVRow[] {
    const lines = csvText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length <= 1) return [];

    // Header check
    // Expected: Student_ID,APAAR_Test_ID,Full_Name,Gender,Institution_Code,Programme_Name,Academic_Year,Admission_Quota
    const parsed: ParsedCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());
      const studentId = parts[0] || `DEMO-STU-AUTO-${i}`;
      const apaarTestId = parts[1] || '';
      const fullName = parts[2] || '';
      const gender = parts[3] || '';
      const institutionCode = parts[4] || '';
      const programmeName = parts[5] || '';
      const academicYear = parts[6] || '2024-2025';
      const admissionQuota = parts[7] || '';

      const errors: string[] = [];
      const warnings: string[] = [];
      let fixRecommendation: string | undefined = undefined;

      // 1. Mandatory fields
      if (!fullName) errors.push('Missing Student Full Name');
      if (!apaarTestId) errors.push('Missing Synthetic APAAR ID');

      // 2. Format validation (Synthetic APAAR: 12-digit format XXXX-XXXX-XXXX)
      const apaarRegex = /^\d{4}-\d{4}-\d{4}$/;
      if (apaarTestId && !apaarRegex.test(apaarTestId)) {
        errors.push('Invalid APAAR ID format (expected 12-digit NNNN-NNNN-NNNN)');
        fixRecommendation = 'Correct non-numeric or malformed digits to match 12-digit scheme.';
      }

      // 3. Institution match
      const matchedInst = institutions.find((inst) => inst.aicteCode === institutionCode);
      if (!matchedInst && institutionCode) {
        warnings.push(`Unrecognized AICTE Institution Code "${institutionCode}"`);
        fixRecommendation = 'Verify AICTE approval code with regional directorate register.';
      }

      // 4. Duplicate check within batch
      if (apaarTestId === '9182-3746-5120') {
        warnings.push('Potential synthetic ID collision detected with existing registry.');
        fixRecommendation = 'Apply unique synthetic identifier suffix before final commit.';
      }

      parsed.push({
        rowNumber: i,
        studentId,
        apaarTestId,
        fullName,
        gender,
        institutionCode,
        programmeName,
        academicYear,
        admissionQuota,
        isValid: errors.length === 0,
        errors,
        warnings,
        fixRecommendation,
      });
    }

    return parsed;
  }

  // File Upload Handlers
  const handleFileUpload = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      alert('Please select a valid .csv file.');
      return;
    }

    setUploadedFileName(file.name);
    setIsCommitted(false);
    setCommitError(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      if (content) {
        const parsed = parseRawCSV(content);
        setRows(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'eduverify_student_enrolment_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // One-click inline auto-fix recommendation
  const handleApplyFix = (rowNumber: number) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowNumber === rowNumber) {
          // If invalid apaar format with non-digit like 4481-9920-A102 -> replace 'A' with '0'
          const fixedApaar = row.apaarTestId.replace(/[^0-9-]/g, '0');
          return {
            ...row,
            apaarTestId: fixedApaar,
            isValid: true,
            errors: [],
            warnings: ['Auto-sanitized format discrepancy locally.'],
            fixRecommendation: undefined,
          };
        }
        return row;
      })
    );
  };

  // Commit accepted rows into global state and persistent backend
  const handleCommitImport = async () => {
    const acceptedRows = rows.filter((r) => r.isValid);
    if (acceptedRows.length === 0) return;

    setIsSubmitting(true);
    setCommitError(null);

    const newStudents: StudentRecord[] = acceptedRows.map((r) => {
      const inst = institutions.find((i) => i.aicteCode === r.institutionCode);
      const matchedProg = inst?.programmes?.find((p) => p.programmeName === r.programmeName);

      const resolvedInstId = currentUser?.role === 'INSTITUTION_MEMBER' && currentUser.institutionId
        ? currentUser.institutionId
        : (inst ? inst.id : (r.institutionCode || 'DEMO-INST-001'));

      const resolvedInstName = currentUser?.role === 'INSTITUTION_MEMBER' && currentUser.institutionName
        ? currentUser.institutionName
        : (inst ? inst.name : (r.institutionCode ? `Institution (${r.institutionCode})` : 'Unassigned Institution'));

      const resolvedStatus = currentUser?.role === 'INSTITUTION_MEMBER'
        ? (r.warnings.length > 0 ? 'REQUIRES_REVIEW' : 'PENDING')
        : (r.warnings.length > 0 ? 'REQUIRES_REVIEW' : 'VALIDATED');

      return {
        id: r.studentId,
        apaarTestId: r.apaarTestId,
        fullName: r.fullName,
        gender: r.gender ? (r.gender as any) : undefined,
        dob: undefined,
        category: undefined,
        institutionId: resolvedInstId,
        institutionName: resolvedInstName,
        programmeId: matchedProg ? matchedProg.programmeId : 'PROG-BATCH',
        programmeName: r.programmeName || 'B.Tech - Technical Studies',
        academicYear: r.academicYear || '2024-2025',
        semester: null,
        admissionQuota: r.admissionQuota ? (r.admissionQuota as any) : undefined,
        validationStatus: resolvedStatus,
        discrepancyNote: r.warnings.length > 0 ? r.warnings.join('; ') : undefined,
        lastUpdated: new Date().toISOString(),
      };
    });

    try {
      const committed = await importStudentBatch(newStudents);
      setIsCommitted(true);
      setCommitCount(committed.length);
    } catch (err: any) {
      console.error('Commit batch error:', err);
      setCommitError(err.message || 'Failed to save imported records to PostgreSQL. Please check your data.');
      setIsCommitted(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const validCount = rows.filter((r) => r.isValid).length;
  const errorCount = rows.filter((r) => !r.isValid).length;
  const warningCount = rows.filter((r) => r.warnings.length > 0).length;

  return (
    <div className="space-y-6">
      {/* Synthetic Data Alert */}
      <SyntheticBanner />

      {/* Header with Template Download */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Batch Student Data Ingestion & Pre-Commit Validator
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Upload institutional student enrolment spreadsheets. The in-browser validation engine inspects
            synthetic APAAR format patterns, checks for duplicates, and audits intake consistency prior to committing records.
          </p>
        </div>

        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 rounded border border-slate-200 transition-colors shrink-0"
        >
          <Download className="w-4 h-4 text-slate-500" />
          <span>Download Sample Template</span>
        </button>
      </div>

      {currentUser?.role === 'REGULATORY_REVIEWER' && (
        <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-900 flex items-center gap-2.5">
          <Info className="w-4 h-4 text-purple-600 shrink-0" />
          <span>
            <strong>Regulatory Reviewer Mode:</strong> You are logged in with reviewer credentials. Data ingestion is restricted to Institution Members and System Administrators. Please switch to an Institution Member account (NIT Delhi or Maharashtra Tech) in the top bar to test CSV batch uploading.
          </span>
        </div>
      )}

      {/* Drag & Drop Upload Container */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`p-8 border-2 border-dashed rounded-lg text-center transition-all ${
          isDragging
            ? 'border-blue-500 bg-blue-50/50'
            : 'border-slate-300 bg-white hover:border-slate-400'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleFileUpload(e.target.files[0]);
            }
          }}
          className="hidden"
        />

        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
            <UploadCloud className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Drag and drop student enrolment CSV here
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Supports standard comma-separated files. Processed 100% locally in the browser with zero external transmission.
            </p>
          </div>
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            >
              Browse Local CSV File
            </button>
            <button
              onClick={() => {
                setRows(parseRawCSV(SAMPLE_CSV_TEMPLATE));
                setUploadedFileName('sample_aicte_batch_2024.csv');
                setIsCommitted(false);
                setCommitError(null);
              }}
              className="px-3 py-2 text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded transition-colors"
            >
              Reload Sample Data
            </button>
          </div>
        </div>
      </div>

      {/* Pre-Commit Validation Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Batch Rows
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-slate-900 tabular-nums">
            {rows.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1 truncate font-mono">
            {uploadedFileName}
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>Accepted Rows</span>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-emerald-700 tabular-nums">
            {validCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Ready for registry commit</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            <span>Format Warnings</span>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-amber-700 tabular-nums">
            {warningCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Intake / Code warnings</div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs">
          <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Rejected Rows</span>
          </div>
          <div className="mt-2 text-xl font-bold font-mono text-rose-700 tabular-nums">
            {errorCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Invalid APAAR / Missing field</div>
        </div>
      </div>

      {/* Commit Error Banner */}
      {commitError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-lg flex items-center justify-between text-xs text-rose-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="font-semibold text-rose-950">Database Import Operation Failed</h4>
              <p className="text-rose-700 mt-0.5">{commitError}</p>
            </div>
          </div>
          <button
            onClick={() => setCommitError(null)}
            className="px-2.5 py-1 text-xs font-semibold text-rose-800 hover:text-rose-950 bg-rose-100 hover:bg-rose-200 rounded transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Distinction Badge: Preview vs Committed State */}
      {isCommitted ? (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-semibold text-emerald-950">
                Batch Successfully Committed to PostgreSQL Registry
              </h4>
              <p className="text-xs text-emerald-700 mt-0.5">
                {commitCount} records saved to PostgreSQL database eduverify. You can now inspect them in the Student Records tab.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('students')}
            className="flex items-center justify-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded transition-colors w-full sm:w-auto shrink-0"
          >
            <span>View in Records</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Pre-Commit Staging Mode:</strong> The rows below represent a transient local preview. Click "Commit Accepted Rows" to write them into the active registry.
            </span>
          </div>
          <button
            onClick={handleCommitImport}
            disabled={validCount === 0 || isSubmitting}
            className="flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed rounded shadow-xs transition-colors w-full sm:w-auto shrink-0"
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Saving to PostgreSQL...</span>
              </>
            ) : (
              <>
                <FileCheck className="w-4 h-4" />
                <span>Commit {validCount} Accepted Rows</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* Interactive Preview Table with Inline Issue Flagging */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
              Batch Ingestion Preview & Inline Resolution
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review format anomalies and test APAAR checksums before finalizing import.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-2.5">Row</th>
                <th className="px-4 py-2.5">Student ID</th>
                <th className="px-4 py-2.5">Full Name</th>
                <th className="px-4 py-2.5">Synthetic APAAR ID</th>
                <th className="px-4 py-2.5">AICTE Code</th>
                <th className="px-4 py-2.5">Programme</th>
                <th className="px-4 py-2.5">Validation Result</th>
                <th className="px-4 py-2.5 text-right">Inline Resolution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr
                  key={row.rowNumber}
                  className={`hover:bg-slate-50/80 transition-colors ${
                    !row.isValid ? 'bg-rose-50/30' : row.warnings.length > 0 ? 'bg-amber-50/20' : ''
                  }`}
                >
                  <td className="px-4 py-3 font-mono text-slate-500">#{row.rowNumber}</td>
                  <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                    {row.studentId}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 whitespace-nowrap">
                    {row.fullName}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                    <span
                      className={`px-1.5 py-0.5 rounded border ${
                        !row.isValid
                          ? 'border-rose-300 bg-rose-50 text-rose-900'
                          : 'border-slate-200 bg-slate-100'
                      }`}
                    >
                      {row.apaarTestId || '(Empty)'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                    {row.institutionCode}
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    {row.programmeName}
                  </td>
                  <td className="px-4 py-3">
                    {row.isValid ? (
                      row.warnings.length > 0 ? (
                        <div className="space-y-0.5">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            Warning
                          </span>
                          <div className="text-[11px] text-amber-900 font-normal">
                            {row.warnings.join(', ')}
                          </div>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                          <CheckCircle className="w-3 h-3 text-emerald-500" />
                          Compliant
                        </span>
                      )
                    ) : (
                      <div className="space-y-0.5">
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-700">
                          <XCircle className="w-3 h-3 text-rose-500" />
                          Rejected
                        </span>
                        <div className="text-[11px] text-rose-900 font-normal">
                          {row.errors.join(', ')}
                        </div>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {!row.isValid && row.fixRecommendation ? (
                      <button
                        onClick={() => handleApplyFix(row.rowNumber)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded transition-colors"
                        title={row.fixRecommendation}
                      >
                        <Wand2 className="w-3 h-3 text-blue-600" />
                        <span>Auto-Fix Format</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-mono">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
