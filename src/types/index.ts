export type ValidationStatus = 'VALIDATED' | 'REQUIRES_REVIEW' | 'REJECTED' | 'PENDING';

export type IssueType = 'DUPLICATE_RECORD' | 'MISSING_FIELD' | 'INVALID_FORMAT' | 'INTAKE_DISCREPANCY';

export type IssueSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface StudentRecord {
  id: string; // e.g. DEMO-STU-001
  apaarTestId: string; // e.g. 9182-3746-5120 (synthetic test value)
  fullName: string;
  gender?: 'Female' | 'Male' | 'Other' | string;
  dob?: string;
  category?: 'General' | 'OBC-NCL' | 'SC' | 'ST' | 'EWS' | string;
  institutionId?: string; // e.g. DEMO-INST-001
  institutionName?: string;
  programmeId?: string;
  programmeName?: string;
  academicYear?: string; // e.g. '2024-2025'
  semester?: number | null;
  admissionQuota?: 'State Merit' | 'All India AICTE' | 'Management' | 'Lateral Entry' | string;
  validationStatus: ValidationStatus;
  discrepancyNote?: string;
  lastUpdated: string;
}

export interface ProgrammeIntake {
  programmeId: string;
  programmeName: string;
  degreeType: 'B.Tech' | 'M.Tech' | 'MCA' | 'Diploma';
  approvedIntake: number;
  reportedEnrolment: number;
  activeBatches: number;
  intakeStatus: 'COMPLIANT' | 'OVER_INTAKE' | 'VACANCY_WARNING';
}

export interface Institution {
  id: string; // e.g. DEMO-INST-001
  aicteCode: string;
  name: string;
  state: string;
  city: string;
  type: 'Government Autonomous' | 'Government Aided' | 'Self-Financing Technical';
  establishedYear: number;
  contactEmail: string;
  programmes: ProgrammeIntake[];
}

export interface ValidationIssue {
  id: string;
  recordId: string;
  studentName: string;
  apaarTestId: string;
  institutionId: string;
  institutionName: string;
  programmeName: string;
  issueType: IssueType;
  severity: IssueSeverity;
  reason: string;
  recommendedAction: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED';
  detectedAt: string;
}

export interface ParsedCSVRow {
  rowNumber: number;
  studentId: string;
  apaarTestId: string;
  fullName: string;
  gender: string;
  institutionCode: string;
  programmeName: string;
  academicYear: string;
  admissionQuota?: string;
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixRecommendation?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'INFO' | 'WARNING' | 'ALERT' | 'SUCCESS';
  read: boolean;
}

export interface StudentDocument {
  id: string;
  studentId: string;
  originalFilename: string;
  mimeType: string;
  fileExtension: string;
  fileSize: number;
  storageKey: string;
  uploadedAt: string;
  processingStatus: 'UPLOADED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | string;
  reviewStatus: 'PENDING' | 'VERIFIED' | 'REJECTED' | string;
  createdAt: string;
  updatedAt: string;
  // Phase 2B: OCR / text extraction fields
  extractedText?: string | null;
  extractedAt?: string | null;
  pageCount?: number | null;
  ocrConfidence?: number | string | null;
  ocrError?: string | null;
}

// Phase 2C: Document Mismatch Detection Findings
export interface DocumentCandidateField {
  fieldName: string;
  fieldLabel: string;
  dbField: string;
  findingType: string;
  severity: string;
  documentValue: string;
  rawEvidence?: string;
  status: 'EXTRACTED' | 'NOT_EXTRACTED';
}

export interface DocumentMismatchFinding {
  id: string;
  documentId: string;
  studentId: string;
  fieldName: string;
  fieldLabel: string;
  documentValue: string;
  databaseValue: string;
  rawEvidence?: string;
  findingType: string;
  severity: 'HIGH' | 'WARNING' | 'INFO' | string;
  explanation: string;
  status: 'OPEN' | 'RESOLVED' | 'DISMISSED' | string;
  createdAt: string;
  updatedAt: string;
}

// Authentication & Role-Based Access Control Types
export type UserRole = 'INSTITUTION_MEMBER' | 'REGULATORY_REVIEWER' | 'SYSTEM_ADMIN';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  institutionId: string | null;
  institutionName: string | null;
  canViewDocuments: boolean;
  lastLoginAt?: string;
  isActive?: boolean;
}

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  userEmail: string;
  role: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  institutionId?: string | null;
  details?: Record<string, any>;
  ipAddress?: string | null;
  createdAt: string;
}

export interface SystemHealthMetrics {
  status: string;
  uptimeSeconds: number;
  timestamp: string;
  nodeVersion: string;
  platform: string;
  memory: {
    rss: number;
    heapTotal: number;
    heapUsed: number;
    external?: number;
  };
  database: {
    connected: boolean;
    totalConnections: number;
    idleConnections: number;
    waitingClients: number;
  };
  recordCounts: {
    users: number;
    auditLogs: number;
    institutions: number;
    students: number;
    studentDocuments: number;
    validationIssues: number;
    documentMismatchFindings: number;
  };
  storage: {
    isolatedDir: boolean;
    filesOnDisk: number;
    totalSizeBytes: number;
  };
}

