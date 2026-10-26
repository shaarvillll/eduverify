import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  GraduationCap,
  Building,
  CheckCircle,
  XCircle,
  FileText,
  FileImage,
  Upload,
  Loader2,
  RotateCcw,
  Download,
  Lock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { StudentRecord, ValidationStatus, StudentDocument, DocumentMismatchFinding } from '../../types';
import { StatusBadge } from '../common/StatusBadge';
import { Modal } from '../common/Modal';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { SyntheticBanner } from '../common/SyntheticBanner';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');

export const StudentRecordsPage: React.FC = () => {
  const {
    students,
    institutions,
    searchQuery,
    setSearchQuery,
    selectedStudent,
    setSelectedStudent,
    updateStudentStatus,
    currentUser,
    fetchWithAuth,
  } = useApp();

  // Filters
  const [selectedInstFilter, setSelectedInstFilter] = useState<string>('ALL');
  const [selectedProgFilter, setSelectedProgFilter] = useState<string>('ALL');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [revealApaar, setRevealApaar] = useState<boolean>(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal local state for notes
  const [adminNote, setAdminNote] = useState<string>('');
  const [showModalApaar, setShowModalApaar] = useState<boolean>(false);

  // Phase 2A: Document upload & listing state for selected student
  const [studentDocuments, setStudentDocuments] = useState<StudentDocument[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [selectedUploadFile, setSelectedUploadFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState<boolean>(false);
  const [docUploadError, setDocUploadError] = useState<string | null>(null);
  const [docUploadSuccess, setDocUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Phase 2B: OCR extraction state
  const [isExtractingDocId, setIsExtractingDocId] = useState<string | null>(null);
  const [ocrError, setOcrError] = useState<string | null>(null);

  // Phase 2C: Document Mismatch Detection state
  const [documentFindings, setDocumentFindings] = useState<Record<string, DocumentMismatchFinding[]>>({});
  const [isComparingDocId, setIsComparingDocId] = useState<string | null>(null);
  const [comparisonMessage, setComparisonMessage] = useState<{ docId: string; type: 'success' | 'error'; text: string } | null>(null);

  // Fetch documents whenever a student is selected
  useEffect(() => {
    if (selectedStudent) {
      setIsLoadingDocs(true);
      setDocUploadError(null);
      setDocUploadSuccess(null);
      setSelectedUploadFile(null);
      setComparisonMessage(null);
      if (fileInputRef.current) fileInputRef.current.value = '';

      fetchWithAuth(`${API_BASE_URL}/api/students/${selectedStudent.id}/documents`)
        .then((res) => (res.ok ? res.json() : []))
        .then((docs: StudentDocument[]) => {
          setStudentDocuments(docs);
        })
        .catch((err) => {
          console.error('Failed to load student documents:', err);
          setStudentDocuments([]);
        })
        .finally(() => {
          setIsLoadingDocs(false);
        });

      // Phase 2C: Fetch existing document mismatch findings for selected student
      fetchWithAuth(`${API_BASE_URL}/api/students/${selectedStudent.id}/document-findings`)
        .then((res) => (res.ok ? res.json() : []))
        .then((findings: DocumentMismatchFinding[]) => {
          const grouped: Record<string, DocumentMismatchFinding[]> = {};
          findings.forEach((f) => {
            if (!grouped[f.documentId]) grouped[f.documentId] = [];
            grouped[f.documentId].push(f);
          });
          setDocumentFindings(grouped);
        })
        .catch((err) => {
          console.error('Failed to load document findings:', err);
          setDocumentFindings({});
        });
    } else {
      setStudentDocuments([]);
      setDocumentFindings({});
      setSelectedUploadFile(null);
      setDocUploadError(null);
      setDocUploadSuccess(null);
      setComparisonMessage(null);
    }
  }, [selectedStudent]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDocUploadError(null);
    setDocUploadSuccess(null);
    const file = e.target.files?.[0];
    if (!file) {
      setSelectedUploadFile(null);
      return;
    }

    const allowedExtensions = ['pdf', 'png', 'jpg', 'jpeg'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.includes(ext)) {
      setDocUploadError(`Unsupported file format '.${ext}'. Only PDF, JPEG, and PNG files are allowed.`);
      setSelectedUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      setDocUploadError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`);
      setSelectedUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedUploadFile(file);
  };

  const handleDownloadDocument = async (doc: StudentDocument) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/documents/${doc.id}/file`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Download failed (HTTP ${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = doc.originalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(err.message || 'Error downloading document');
    }
  };

  const handleUploadDocument = async () => {
    if (!selectedStudent || !selectedUploadFile || isUploadingDoc) return;

    setIsUploadingDoc(true);
    setDocUploadError(null);
    setDocUploadSuccess(null);

    try {
      const formData = new FormData();
      formData.append('document', selectedUploadFile);

      const response = await fetchWithAuth(`${API_BASE_URL}/api/students/${selectedStudent.id}/documents`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Upload failed (HTTP ${response.status})`);
      }

      const uploadedDoc: StudentDocument = data.document;
      setStudentDocuments((prev) => [uploadedDoc, ...prev]);
      setDocUploadSuccess(`Document "${uploadedDoc.originalFilename}" uploaded successfully. Metadata recorded in PostgreSQL.`);
      setSelectedUploadFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during upload';
      setDocUploadError(msg);
    } finally {
      setIsUploadingDoc(false);
    }
  };

  // Phase 2B: Trigger local OCR / text extraction for a document
  const handleExtractText = async (docId: string) => {
    if (isExtractingDocId) return;
    setIsExtractingDocId(docId);
    setOcrError(null);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/documents/${docId}/extract`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));

      if (response.status === 409) {
        setOcrError('Document is already being processed. Please wait and refresh.');
        return;
      }

      if (!response.ok) {
        throw new Error(data.message || `Extraction failed (HTTP ${response.status})`);
      }

      const updatedDoc: StudentDocument = data.document;
      setStudentDocuments((prev) =>
        prev.map((d) => (d.id === docId ? { ...d, ...updatedDoc } : d))
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during text extraction';
      setOcrError(msg);
    } finally {
      setIsExtractingDocId(null);
    }
  };

  // Phase 2C: Deterministic document mismatch comparison
  const handleCompareDocument = async (docId: string) => {
    if (isComparingDocId) return;
    setIsComparingDocId(docId);
    setComparisonMessage(null);

    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/documents/${docId}/compare`, {
        method: 'POST',
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || `Comparison failed (HTTP ${response.status})`);
      }

      setDocumentFindings((prev) => ({
        ...prev,
        [docId]: data.findings || [],
      }));

      const count = data.findings?.length || 0;
      setComparisonMessage({
        docId,
        type: 'success',
        text:
          count > 0
            ? `Comparison completed against PostgreSQL student record. Found ${count} discrepancy ${count === 1 ? 'finding' : 'findings'} requiring review.`
            : 'Comparison completed. All extracted candidate fields match official student database records.',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error during document comparison';
      setComparisonMessage({ docId, type: 'error', text: msg });
    } finally {
      setIsComparingDocId(null);
    }
  };

  // Phase 2C: Update mismatch finding status (RESOLVED, DISMISSED, OPEN)
  const handleUpdateFindingStatus = async (
    findingId: string,
    newStatus: 'OPEN' | 'RESOLVED' | 'DISMISSED',
    docId: string
  ) => {
    try {
      const response = await fetchWithAuth(`${API_BASE_URL}/api/findings/${findingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.message || `Failed to update finding status (HTTP ${response.status})`);
      }

      const { finding } = await response.json();

      setDocumentFindings((prev) => {
        const currentList = prev[docId] || [];
        return {
          ...prev,
          [docId]: currentList.map((f) =>
            f.id === findingId ? { ...f, status: finding.status, updatedAt: finding.updatedAt } : f
          ),
        };
      });
    } catch (err: unknown) {
      console.error('Failed to update finding status:', err);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (bytes == null || isNaN(Number(bytes))) return '0 B';
    const num = Number(bytes);
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '—' : d.toLocaleDateString();
    } catch {
      return '—';
    }
  };

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '—' : d.toLocaleString();
    } catch {
      return '—';
    }
  };

  const renderConfidence = (conf?: number | string | null) => {
    if (conf == null) return null;
    const num = Number(conf);
    if (isNaN(num)) return null;
    return ` · ${num.toFixed(0)}% conf`;
  };

  // Unique programmes for filter dropdown
  const programmesList = useMemo(() => {
    const set = new Set<string>();
    institutions.forEach((inst) => {
      inst.programmes.forEach((p) => set.add(p.programmeName));
    });
    return Array.from(set);
  }, [institutions]);

  // Filtered Students
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Global search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = student.fullName.toLowerCase().includes(q);
        const matchesId = student.id.toLowerCase().includes(q);
        const matchesApaar = student.apaarTestId.toLowerCase().includes(q);
        const matchesInst = (student.institutionName || '').toLowerCase().includes(q);
        if (!matchesName && !matchesId && !matchesApaar && !matchesInst) {
          return false;
        }
      }

      // Institution filter
      if (selectedInstFilter !== 'ALL' && student.institutionId !== selectedInstFilter) {
        return false;
      }

      // Programme filter
      if (selectedProgFilter !== 'ALL' && student.programmeName !== selectedProgFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'ALL' && student.validationStatus !== selectedStatusFilter) {
        return false;
      }

      return true;
    });
  }, [students, searchQuery, selectedInstFilter, selectedProgFilter, selectedStatusFilter]);

  // Paginated records
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleOpenStudent = (student: StudentRecord) => {
    setSelectedStudent(student);
    setAdminNote(student.discrepancyNote || '');
    setShowModalApaar(false);
  };

  const handleUpdateStatus = (newStatus: ValidationStatus) => {
    if (selectedStudent) {
      updateStudentStatus(selectedStudent.id, newStatus, adminNote);
    }
  };

  const resetFilters = () => {
    setSelectedInstFilter('ALL');
    setSelectedProgFilter('ALL');
    setSelectedStatusFilter('ALL');
    setSearchQuery('');
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <SyntheticBanner />

      {/* Search and Filters Header */}
      <div className="p-4 bg-white border border-slate-200 rounded-lg shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by student name, ID, or masked APAAR..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500 text-slate-900 placeholder:text-slate-400"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setRevealApaar(!revealApaar)}
              className="flex items-center gap-1.5 px-3 py-2 min-h-[36px] text-xs font-medium text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded border border-slate-200 transition-colors"
              title="Toggle masking for synthetic test identifiers"
            >
              {revealApaar ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{revealApaar ? 'Mask Synthetic IDs' : 'Unmask Test IDs'}</span>
            </button>

            {(selectedInstFilter !== 'ALL' ||
              selectedProgFilter !== 'ALL' ||
              selectedStatusFilter !== 'ALL' ||
              searchQuery) && (
              <button
                onClick={resetFilters}
                className="flex items-center gap-1 px-2.5 py-2 min-h-[36px] text-xs font-medium text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded border border-rose-200 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Filters</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Institution Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Institution
            </label>
            <select
              value={selectedInstFilter}
              onChange={(e) => {
                setSelectedInstFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All AICTE Institutions ({institutions.length})</option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.city} - {inst.name}
                </option>
              ))}
            </select>
          </div>

          {/* Programme Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Programme
            </label>
            <select
              value={selectedProgFilter}
              onChange={(e) => {
                setSelectedProgFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Programmes</option>
              {programmesList.map((prog) => (
                <option key={prog} value={prog}>
                  {prog}
                </option>
              ))}
            </select>
          </div>

          {/* Validation Status Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
              Validation Status
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded text-slate-800 text-xs focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="VALIDATED">Validated</option>
              <option value="REQUIRES_REVIEW">Requires Review</option>
              <option value="REJECTED">Rejected</option>
              <option value="PENDING">Pending Audit</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Students Data Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50/50 text-xs text-slate-500 font-medium">
          <div>
            Showing <strong className="text-slate-900 font-mono tabular-nums">{filteredStudents.length}</strong> student records
          </div>
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 bg-white border border-slate-200 rounded text-xs text-slate-800"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>

        {/* Mobile View: Cards (< 768px) */}
        <div className="md:hidden divide-y divide-slate-100">
          {paginatedStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-500">
              <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <div className="font-semibold text-slate-800 text-sm">No matching student records</div>
              <p className="text-xs text-slate-400 mt-1">
                Try adjusting your search criteria or clearing active filters.
              </p>
              <button
                onClick={resetFilters}
                className="mt-3 px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium border border-blue-200 rounded bg-blue-50"
              >
                Clear Filters
              </button>
            </div>
          ) : (
            paginatedStudents.map((student) => {
              const displayApaar = revealApaar
                ? (student.apaarTestId || '—')
                : student.apaarTestId
                ? `••••-••••-${student.apaarTestId.slice(-4)}`
                : '—';

              return (
                <div
                  key={student.id}
                  className="p-3.5 space-y-2.5 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-slate-900 text-sm">
                        {student.fullName}
                      </div>
                      <div className="text-[11px] font-mono text-slate-400">
                        {student.id}
                      </div>
                    </div>
                    <StatusBadge status={student.validationStatus} />
                  </div>

                  <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded border border-slate-100">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400 font-medium">Synthetic APAAR:</span>
                      <span className="font-mono font-medium text-slate-800 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                        {displayApaar}
                      </span>
                    </div>
                    <div className="truncate text-slate-800 font-medium pt-0.5" title={student.institutionName}>
                      {student.institutionName}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="truncate">{student.programmeName}</span>
                      <span className="shrink-0 font-mono text-slate-400 ml-2">AY {student.academicYear}</span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleOpenStudent(student)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 rounded border border-blue-200 transition-colors min-h-[38px]"
                  >
                    <span>View Dossier & Documents</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Desktop View: Full Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Student ID</th>
                <th className="px-4 py-3">Full Name</th>
                <th className="px-4 py-3">APAAR ID (Synthetic)</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3">Academic Year</th>
                <th className="px-4 py-3">Validation Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                    <div className="max-w-xs mx-auto space-y-2">
                      <Filter className="w-8 h-8 text-slate-300 mx-auto" />
                      <div className="font-semibold text-slate-800">No matching student records</div>
                      <p className="text-xs text-slate-400">
                        Try adjusting your search criteria or clearing active filters.
                      </p>
                      <button
                        onClick={resetFilters}
                        className="px-3 py-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Clear Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((student) => {
                  const displayApaar = revealApaar
                    ? (student.apaarTestId || '—')
                    : student.apaarTestId
                    ? `••••-••••-${student.apaarTestId.slice(-4)}`
                    : '—';

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-blue-50/40 transition-colors group cursor-pointer"
                      onClick={() => handleOpenStudent(student)}
                    >
                      <td className="px-4 py-3 font-mono font-medium text-slate-900 whitespace-nowrap">
                        {student.id}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                        {student.fullName}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                        <span className="bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          {displayApaar}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-700" title={student.institutionName}>
                        {student.institutionName}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {student.programmeName}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                        {student.academicYear}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={student.validationStatus} />
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleOpenStudent(student)}
                          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-colors"
                        >
                          View Dossier
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs">
          <div className="text-slate-500">
            Page <span className="font-semibold text-slate-900">{currentPage}</span> of{' '}
            <span className="font-semibold text-slate-900">{totalPages}</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 sm:p-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 font-mono text-slate-700">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-2 sm:p-1.5 rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed min-w-[36px] min-h-[36px] flex items-center justify-center"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Student Dossier Modal */}
      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title={`Student Dossier: ${selectedStudent.fullName}`}
          subtitle={`AICTE Verification ID: ${selectedStudent.id}`}
          maxWidth="lg"
        >
          <ErrorBoundary label="Student Dossier">
            <div className="space-y-5 text-xs text-slate-700">
            {/* Top Identity Card */}
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Full Legal Name
                </span>
                <div className="text-sm font-bold text-slate-900 mt-0.5">
                  {selectedStudent.fullName}
                </div>
                <div className="text-slate-500 mt-1">
                  Gender: <strong className="text-slate-800">{selectedStudent.gender || '—'}</strong> · DOB:{' '}
                  <strong className="text-slate-800">{selectedStudent.dob || '—'}</strong> · Category:{' '}
                  <strong className="text-slate-800">{selectedStudent.category || '—'}</strong>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Synthetic APAAR ID
                  </span>
                  <button
                    onClick={() => setShowModalApaar(!showModalApaar)}
                    className="text-[11px] text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
                  >
                    {showModalApaar ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showModalApaar ? 'Mask' : 'Reveal'}</span>
                  </button>
                </div>
                <div className="text-sm font-mono font-bold text-slate-900 mt-0.5 bg-white px-2 py-1 rounded border border-slate-200 inline-block">
                  {showModalApaar
                    ? (selectedStudent.apaarTestId || '—')
                    : selectedStudent.apaarTestId
                    ? `••••-••••-${selectedStudent.apaarTestId.slice(-4)}`
                    : '—'}
                </div>
                <div className="text-[10px] text-amber-700 font-medium mt-1">
                  * Fictional synthetic test identifier for prototype validation only.
                </div>
              </div>
            </div>

            {/* Academic Placement Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <Building className="w-4 h-4 text-blue-600" />
                  <span>Enrolled Institution</span>
                </div>
                <div className="text-slate-800 leading-snug">{selectedStudent.institutionName}</div>
                <div className="text-[11px] text-slate-500">ID: {selectedStudent.institutionId}</div>
              </div>

              <div className="p-3 border border-slate-200 rounded-lg space-y-2">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <GraduationCap className="w-4 h-4 text-blue-600" />
                  <span>Academic Programme</span>
                </div>
                <div className="text-slate-800 leading-snug">{selectedStudent.programmeName}</div>
                <div className="text-[11px] text-slate-500">
                  Semester: {selectedStudent.semester ?? '—'} · Quota: {selectedStudent.admissionQuota || '—'}
                </div>
              </div>
            </div>

            {/* Phase 2A: Student Documents Management */}
            <div className="p-4 border border-slate-200 rounded-lg space-y-3 bg-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold text-slate-900 text-sm">
                    Verified Synthetic Enrolment Documents
                  </span>
                </div>
                <span className="text-xs text-slate-500 font-mono">
                  {studentDocuments.length} document{studentDocuments.length !== 1 ? 's' : ''}
                </span>
              </div>

              {currentUser?.role === 'REGULATORY_REVIEWER' && !currentUser?.canViewDocuments && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Sensitive Document Inspection Clearance Required:</strong> Viewing raw certificate files requires explicit regulatory clearance. To view or download, contact your System Administrator.
                  </span>
                </div>
              )}
              <p className="text-xs text-slate-500">
                Securely store synthetic student dossier files (PDF, PNG, JPEG, max 10 MB). Stored in isolated backend storage for regulatory audits.
              </p>

              {/* Upload Input & Action */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    onChange={handleFileSelect}
                    disabled={isUploadingDoc}
                    className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3 file:rounded file:border file:border-slate-300 file:text-xs file:font-semibold file:bg-white file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={handleUploadDocument}
                    disabled={!selectedUploadFile || isUploadingDoc}
                    className={`flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] text-xs font-semibold rounded shrink-0 transition-colors ${
                      !selectedUploadFile || isUploadingDoc
                        ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 shadow-2xs'
                    }`}
                  >
                    {isUploadingDoc ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-3.5 h-3.5" />
                        <span>Upload File</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Selected File Details */}
                {selectedUploadFile && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                    <span className="truncate max-w-xs font-medium text-slate-800">
                      📄 {selectedUploadFile.name}
                    </span>
                    <span className="font-mono text-slate-500 shrink-0">
                      {formatFileSize(selectedUploadFile.size)} · {selectedUploadFile.type || 'auto-detected'}
                    </span>
                  </div>
                )}

                {/* Upload Status Feedback */}
                {docUploadSuccess && (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1">{docUploadSuccess}</div>
                    <button
                      onClick={() => setDocUploadSuccess(null)}
                      className="text-emerald-600 hover:text-emerald-800 text-xs font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}

                {docUploadError && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1">{docUploadError}</div>
                    <button
                      onClick={() => setDocUploadError(null)}
                      className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>

              {/* Phase 2B: OCR global error banner */}
              {ocrError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="flex-1">{ocrError}</div>
                  <button
                    onClick={() => setOcrError(null)}
                    className="text-rose-600 hover:text-rose-800 text-xs font-bold"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Uploaded Documents List */}
              <ErrorBoundary label="Uploaded Dossier Records">
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-600 uppercase tracking-wider">
                    Uploaded Dossier Records
                  </div>

                  {isLoadingDocs ? (
                    <div className="p-4 text-center text-xs text-slate-500 flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                      <span>Loading documents from PostgreSQL...</span>
                    </div>
                  ) : studentDocuments.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 border border-dashed border-slate-200 rounded">
                      No synthetic documents uploaded yet for this student.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 border border-slate-200 rounded-md overflow-hidden">
                      {studentDocuments.map((doc) => {
                        if (!doc || !doc.id) return null;
                        const isExtracting = isExtractingDocId === doc.id;
                        const statusColor =
                          doc.processingStatus === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : doc.processingStatus === 'FAILED'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : doc.processingStatus === 'PROCESSING'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-blue-50 text-blue-700 border-blue-200';

                        return (
                          <div key={doc.id} className="p-3 bg-white divide-y divide-slate-100 text-xs hover:bg-slate-50/70 transition-colors">
                            {/* Row 1: file info + status badges + extract button */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2">
                              <div className="flex items-start sm:items-center gap-2 min-w-0">
                                {doc.mimeType === 'application/pdf' ? (
                                  <FileText className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 sm:mt-0" />
                                ) : (
                                  <FileImage className="w-4 h-4 text-blue-600 shrink-0 mt-0.5 sm:mt-0" />
                                )}
                                <div className="min-w-0">
                                  <div className="font-medium text-slate-900 truncate" title={doc.originalFilename || 'Document'}>
                                    {doc.originalFilename || 'Document'}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono flex flex-wrap items-center gap-x-1.5">
                                    <span>ID: {doc.id}</span>
                                    <span>·</span>
                                    <span>{formatFileSize(doc.fileSize)}</span>
                                    <span>·</span>
                                    <span>{formatDate(doc.uploadedAt)}</span>
                                    {doc.pageCount != null && <span>· {doc.pageCount}p</span>}
                                    {renderConfidence(doc.ocrConfidence)}
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-auto">
                                <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded border uppercase ${statusColor}`}>
                                  {doc.processingStatus}
                                </span>
                                <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-amber-50 text-amber-700 border border-amber-200 uppercase">
                                  {doc.reviewStatus}
                                </span>

                                <button
                                  onClick={() => handleDownloadDocument(doc)}
                                  disabled={currentUser?.role === 'REGULATORY_REVIEWER' && !currentUser?.canViewDocuments}
                                  className="flex items-center gap-1 px-2.5 py-1 min-h-[28px] text-[10px] font-semibold rounded border bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                  title={
                                    currentUser?.role === 'REGULATORY_REVIEWER' && !currentUser?.canViewDocuments
                                      ? 'Document inspection clearance required'
                                      : 'Download and inspect raw document file'
                                  }
                                >
                                  <Download className="w-3 h-3" />
                                  <span>Download</span>
                                </button>
                                {(doc.processingStatus === 'UPLOADED' || doc.processingStatus === 'FAILED') && (
                                  <button
                                    onClick={() => handleExtractText(doc.id)}
                                    disabled={!!isExtractingDocId}
                                    className="flex items-center gap-1 px-2.5 py-1 min-h-[28px] text-[10px] font-semibold rounded border bg-violet-50 text-violet-700 border-violet-200 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                    title={doc.processingStatus === 'FAILED' ? 'Retry text extraction' : 'Extract embedded text or run OCR'}
                                  >
                                    {isExtracting ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      <RotateCcw className="w-3 h-3" />
                                    )}
                                    <span>{isExtracting ? 'Extracting…' : doc.processingStatus === 'FAILED' ? 'Retry OCR' : 'Extract Text'}</span>
                                  </button>
                                )}
                                {doc.processingStatus === 'PROCESSING' && (
                                  <span className="flex items-center gap-1 px-2.5 py-1 text-[10px] font-semibold rounded border bg-amber-50 text-amber-700 border-amber-200">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    Processing…
                                  </span>
                                )}
                                {doc.processingStatus === 'COMPLETED' && (
                                  <>
                                    <button
                                      onClick={() => handleExtractText(doc.id)}
                                      disabled={!!isExtractingDocId || isComparingDocId === doc.id}
                                      className="flex items-center gap-1 px-2.5 py-1 min-h-[28px] text-[10px] font-semibold rounded border bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                      title="Re-run text extraction"
                                    >
                                      {isExtracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                                      <span>{isExtracting ? 'Extracting…' : 'Re-extract'}</span>
                                    </button>

                                    {doc.extractedText && (
                                      <button
                                        onClick={() => handleCompareDocument(doc.id)}
                                        disabled={isComparingDocId === doc.id || !!isExtractingDocId}
                                        className="flex items-center gap-1 px-2.5 py-1 min-h-[28px] text-[10px] font-semibold rounded border bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        title="Compare extracted candidate fields with linked student record in PostgreSQL"
                                      >
                                        {isComparingDocId === doc.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                                        ) : (
                                          <ShieldCheck className="w-3 h-3 text-blue-600" />
                                        )}
                                        <span>{isComparingDocId === doc.id ? 'Comparing…' : 'Compare with Record'}</span>
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Row 2: Extracted text panel */}
                            {doc.extractedText ? (
                              <div className="pt-2 space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold text-violet-800 uppercase tracking-wide">
                                    ⚠ Unverified OCR Output
                                  </span>
                                  {doc.extractedAt && (
                                    <span className="text-[9px] text-violet-500 font-mono">
                                      {formatDateTime(doc.extractedAt)}
                                    </span>
                                  )}
                                </div>
                                <pre className="text-[10px] text-slate-700 whitespace-pre-wrap break-words max-h-32 overflow-y-auto leading-relaxed font-mono bg-violet-50 border border-violet-200 rounded p-2">
                                  {doc.extractedText}
                                </pre>
                              </div>
                            ) : doc.processingStatus === 'COMPLETED' ? (
                              <div className="pt-2 text-[10px] text-slate-400 italic">
                                OCR extraction completed, but no text was detected in the document.
                              </div>
                            ) : null}
                            {doc.ocrError && !doc.extractedText && (
                              <div className="pt-2 rounded border border-rose-200 bg-rose-50 p-2 text-[10px] text-rose-700">
                                <span className="font-semibold">Extraction error: </span>{doc.ocrError}
                              </div>
                            )}

                            {/* Phase 2C: Comparison feedback message */}
                            {comparisonMessage && comparisonMessage.docId === doc.id && (
                              <div
                                className={`mt-2 p-2 rounded border text-[10px] flex items-center justify-between gap-2 ${
                                  comparisonMessage.type === 'error'
                                    ? 'bg-rose-50 border-rose-200 text-rose-800'
                                    : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                }`}
                              >
                                <span>{comparisonMessage.text}</span>
                                <button
                                  onClick={() => setComparisonMessage(null)}
                                  className="text-xs font-bold px-1 hover:opacity-75"
                                >
                                  ×
                                </button>
                              </div>
                            )}

                            {/* Phase 2C: Mismatch Findings Section */}
                            {documentFindings[doc.id] && documentFindings[doc.id].length > 0 && (
                              <div className="pt-2 space-y-2 border-t border-slate-100 mt-2">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                                  <div className="flex items-center gap-1.5">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                    <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                                      Discrepancies ({documentFindings[doc.id].filter((f) => f.status === 'OPEN').length} Open)
                                    </span>
                                  </div>
                                  <span className="text-[9px] text-amber-800 font-medium bg-amber-50 px-2 py-0.5 rounded border border-amber-200 self-start sm:self-auto">
                                    Automated Check · Human Review Required
                                  </span>
                                </div>

                                <div className="space-y-1.5">
                                  {documentFindings[doc.id].map((finding) => {
                                    const isResolved = finding.status === 'RESOLVED';
                                    const isDismissed = finding.status === 'DISMISSED';
                                    const badgeClass = isResolved
                                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                      : isDismissed
                                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                                      : finding.severity === 'HIGH'
                                      ? 'bg-rose-100 text-rose-800 border-rose-200'
                                      : 'bg-amber-100 text-amber-800 border-amber-200';

                                    const cardBg = isResolved
                                      ? 'bg-emerald-50/40 border-emerald-200'
                                      : isDismissed
                                      ? 'bg-slate-50 border-slate-200 opacity-75'
                                      : finding.severity === 'HIGH'
                                      ? 'bg-rose-50/60 border-rose-200'
                                      : 'bg-amber-50/60 border-amber-200';

                                    return (
                                      <div
                                        key={finding.id}
                                        className={`p-2.5 rounded border text-[11px] space-y-1.5 ${cardBg}`}
                                      >
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                          <div className="flex items-center gap-1.5">
                                            <span className="font-semibold text-slate-900">
                                              {finding.fieldLabel}
                                            </span>
                                            <span className={`px-1.5 py-0.2 text-[9px] font-bold rounded border uppercase ${badgeClass}`}>
                                              {finding.status}
                                            </span>
                                          </div>

                                          <div className="flex items-center gap-1.5 self-end sm:self-auto">
                                            {finding.status === 'OPEN' ? (
                                              <>
                                                <button
                                                  onClick={() => handleUpdateFindingStatus(finding.id, 'RESOLVED', doc.id)}
                                                  className="px-2.5 py-1 min-h-[28px] text-[10px] font-medium rounded bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 transition-colors shadow-2xs"
                                                  title="Mark finding as resolved"
                                                >
                                                  Resolve
                                                </button>
                                                <button
                                                  onClick={() => handleUpdateFindingStatus(finding.id, 'DISMISSED', doc.id)}
                                                  className="px-2.5 py-1 min-h-[28px] text-[10px] font-medium rounded bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 transition-colors shadow-2xs"
                                                  title="Dismiss finding as harmless"
                                                >
                                                  Dismiss
                                                </button>
                                              </>
                                            ) : (
                                              <button
                                                onClick={() => handleUpdateFindingStatus(finding.id, 'OPEN', doc.id)}
                                                className="flex items-center gap-1 px-2.5 py-1 min-h-[28px] text-[10px] font-medium rounded bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 transition-colors shadow-2xs"
                                                title="Reopen finding for review"
                                              >
                                                <RotateCcw className="w-2.5 h-2.5" />
                                                <span>Re-open</span>
                                              </button>
                                            )}
                                          </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] bg-white p-2 rounded border border-slate-200">
                                          <div>
                                            <span className="text-slate-400 font-medium block">
                                              Document Value (Unverified OCR):
                                            </span>
                                            <span className="font-mono font-bold text-rose-700 break-words">
                                              {finding.documentValue}
                                            </span>
                                          </div>
                                          <div>
                                            <span className="text-slate-400 font-medium block">
                                              Official Record Value (PostgreSQL):
                                            </span>
                                            <span className="font-mono font-bold text-emerald-700 break-words">
                                              {finding.databaseValue}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="text-[10px] text-slate-600 leading-tight">
                                          <span className="font-semibold text-slate-700">Audit Reason: </span>
                                          {finding.explanation}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </ErrorBoundary>
            </div>

            {/* Verification Status & Discrepancy Notes */}
            <div className="p-4 border border-slate-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">Current AICTE Compliance Status</span>
                <StatusBadge status={selectedStudent.validationStatus} />
              </div>

              {selectedStudent.discrepancyNote && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-amber-900 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-950">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Audit Discrepancy Note</span>
                  </div>
                  <p className="text-xs leading-normal">{selectedStudent.discrepancyNote}</p>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Administrator Audit Remarks
                </label>
                <textarea
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Enter remarks or resolution notes..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded text-xs text-slate-900 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  rows={2}
                />
              </div>

              {/* Action Buttons to mutate status */}
              <div className="pt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 border-t border-slate-100">
                {currentUser?.role === 'INSTITUTION_MEMBER' ? (
                  <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-700">Institution Member:</span> You may correct details or submit for review. Regulatory verification is recorded by AICTE Reviewers.
                    </div>
                    <button
                      onClick={() => handleUpdateStatus('REQUIRES_REVIEW')}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors text-xs shadow-2xs shrink-0"
                    >
                      <Upload className="w-3.5 h-3.5 shrink-0" />
                      <span>Submit for Review</span>
                    </button>
                  </div>
                ) : currentUser?.role === 'REGULATORY_REVIEWER' ? (
                  <>
                    <button
                      onClick={() => handleUpdateStatus('VALIDATED')}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-emerald-600 hover:bg-emerald-700 text-white rounded font-medium transition-colors text-xs shadow-2xs"
                    >
                      <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Approve & Validate</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('REQUIRES_REVIEW')}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-amber-600 hover:bg-amber-700 text-white rounded font-medium transition-colors text-xs shadow-2xs"
                    >
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                      <span>Flag For Review</span>
                    </button>
                    <button
                      onClick={() => handleUpdateStatus('REJECTED')}
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 min-h-[38px] bg-rose-600 hover:bg-rose-700 text-white rounded font-medium transition-colors text-xs shadow-2xs"
                    >
                      <XCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>Reject Record</span>
                    </button>
                  </>
                ) : (
                  <div className="text-xs text-slate-500 italic">
                    System Administrator session: Administrative oversight mode. Regulatory determinations are recorded by Reviewers.
                  </div>
                )}
              </div>
            </div>
          </div>
          </ErrorBoundary>
        </Modal>
      )}
    </div>
  );
};
