import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import {
  StudentRecord,
  Institution,
  ValidationIssue,
  NotificationItem,
  ValidationStatus,
} from '../types';
import {
  INITIAL_INSTITUTIONS,
  INITIAL_STUDENTS,
  INITIAL_VALIDATION_ISSUES,
  INITIAL_NOTIFICATIONS,
} from '../data/syntheticData';

export type NavTab =
  | 'overview'
  | 'students'
  | 'upload'
  | 'issues'
  | 'institutions'
  | 'reports'
  | 'settings';

interface AppContextType {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  students: StudentRecord[];
  institutions: Institution[];
  issues: ValidationIssue[];
  notifications: NotificationItem[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedStudent: StudentRecord | null;
  setSelectedStudent: (student: StudentRecord | null) => void;
  resolveIssue: (issueId: string, resolution: 'RESOLVED' | 'DISMISSED' | 'OPEN') => Promise<void>;
  triggerVerificationScan: () => Promise<{ detectedCount: number }>;
  updateStudentStatus: (studentId: string, status: ValidationStatus, note?: string) => Promise<void>;
  importStudentBatch: (newStudents: StudentRecord[]) => Promise<StudentRecord[]>;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  resetToDemoDefaults: () => void;
  stats: {
    totalStudents: number;
    validatedStudents: number;
    reviewRequiredStudents: number;
    rejectedStudents: number;
    pendingStudents: number;
    totalInstitutions: number;
    openIssuesCount: number;
    totalIntakeSeats: number;
    reportedIntakeSeats: number;
  };
}

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [institutions, setInstitutions] = useState<Institution[]>(INITIAL_INSTITUTIONS);
  const [issues, setIssues] = useState<ValidationIssue[]>(INITIAL_VALIDATION_ISSUES);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  // Fetch initial live data from PostgreSQL backed endpoints
  useEffect(() => {
    // 1. Fetch Students
    fetch(`${API_BASE_URL}/api/students`)
      .then((res) => (res.ok ? res.json() : Promise.reject('Failed to fetch students')))
      .then((data: StudentRecord[]) => setStudents(data))
      .catch((err) => console.error('Error loading students from backend:', err));

    // 2. Fetch Institutions (with live database capacity aggregation)
    fetch(`${API_BASE_URL}/api/institutions`)
      .then((res) => (res.ok ? res.json() : Promise.reject('Failed to fetch institutions')))
      .then((data: Institution[]) => setInstitutions(data))
      .catch((err) => console.error('Error loading institutions from backend:', err));

    // 3. Fetch Validation Issues (persisted in PostgreSQL)
    fetch(`${API_BASE_URL}/api/issues`)
      .then((res) => (res.ok ? res.json() : Promise.reject('Failed to fetch issues')))
      .then((data: ValidationIssue[]) => setIssues(data))
      .catch((err) => console.error('Error loading validation issues from backend:', err));
  }, []);

  const triggerVerificationScan = async (): Promise<{ detectedCount: number }> => {
    const res = await fetch(`${API_BASE_URL}/api/verification/scan`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Scan failed (HTTP ${res.status})`);
    }
    const scanResult = await res.json();
    // Re-fetch all live data after a successful scan
    const [issuesRes, stuRes, instRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/issues`),
      fetch(`${API_BASE_URL}/api/students`),
      fetch(`${API_BASE_URL}/api/institutions`),
    ]);
    if (!issuesRes.ok) {
      throw new Error(`Failed to refresh validation issues (HTTP ${issuesRes.status})`);
    }
    const freshIssues = await issuesRes.json();
    setIssues(freshIssues);

    if (stuRes.ok) setStudents(await stuRes.json());
    if (instRes.ok) setInstitutions(await instRes.json());

    // Add info notification
    const newNotif: NotificationItem = {
      id: `NOTIF-${Date.now()}`,
      title: 'Audit Scan Synchronized',
      message: `Database verification scan completed. ${scanResult.detectedCount ?? freshIssues.length} discrepancy issues synchronized with PostgreSQL.`,
      timestamp: 'Just now',
      type: 'INFO',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    return { detectedCount: scanResult.detectedCount ?? freshIssues.length };
  };

  const resolveIssue = async (issueId: string, resolution: 'RESOLVED' | 'DISMISSED' | 'OPEN') => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/issues/${issueId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: resolution }),
      });

      if (!response.ok) {
        throw new Error('Failed to update issue status');
      }

      const data = await response.json();
      const updatedIssue = data.issue as ValidationIssue;
      const updatedStudent = data.student as StudentRecord | null;

      // Update issue state with server-persisted row
      setIssues((prev) =>
        prev.map((iss) => (iss.id === issueId ? updatedIssue : iss))
      );

      // If associated student's validation status was updated, persist into students state
      if (updatedStudent) {
        setStudents((prev) =>
          prev.map((s) => (s.id === updatedStudent.id ? { ...s, ...updatedStudent } : s))
        );
        setSelectedStudent((prev) =>
          prev && prev.id === updatedStudent.id ? { ...prev, ...updatedStudent } : prev
        );
      }
    } catch (error) {
      console.error('Error updating issue status:', error);
      alert('Could not update issue status on server. Please try again.');
    }
  };

  
const updateStudentStatus = async (
  studentId: string,
  status: ValidationStatus,
  note?: string
) => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/students/${studentId}/status`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          validationStatus: status,
          discrepancyNote: note,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to update student status');
    }

    const data = await response.json();
    const updatedStudent = data.student as StudentRecord;

    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId
          ? { ...student, ...updatedStudent }
          : student
      )
    );

    setSelectedStudent((prev) =>
      prev && prev.id === studentId
        ? { ...prev, ...updatedStudent }
        : prev
    );

    console.log('Student status updated successfully');
  } catch (error) {
    console.error('Error updating student status:', error);
    alert('Could not update student status. Please try again.');
  }
};

  const importStudentBatch = async (newStudents: StudentRecord[]): Promise<StudentRecord[]> => {
    const response = await fetch(`${API_BASE_URL}/api/students/batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ students: newStudents }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `Failed to commit batch to server (HTTP ${response.status})`;
      throw new Error(message);
    }

    const data = await response.json();
    const confirmedStudents: StudentRecord[] = data.students || newStudents;

    // Only update state after confirmed server success
    setStudents((prev) => {
      const existingIds = new Set(prev.map((s) => s.id));
      const fresh = confirmedStudents.filter((s) => !existingIds.has(s.id));
      return [...fresh, ...prev];
    });

    // Add success notification
    const newNotif: NotificationItem = {
      id: `NOTIF-${Date.now()}`,
      title: 'Batch Ingestion Committed',
      message: `Successfully imported ${confirmedStudents.length} student records into PostgreSQL.`,
      timestamp: 'Just now',
      type: 'SUCCESS',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    // Automatically refresh issues and institutions because batch import triggers a verification scan in PostgreSQL
    try {
      const [issuesRes, instRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/issues`),
        fetch(`${API_BASE_URL}/api/institutions`),
      ]);
      if (issuesRes.ok) setIssues(await issuesRes.json());
      if (instRes.ok) setInstitutions(await instRes.json());
    } catch (refreshErr) {
      console.warn('Post-import refresh warning:', refreshErr);
    }

    return confirmedStudents;
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllNotificationsAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const resetToDemoDefaults = async () => {
    try {
      const [stuRes, instRes, issuesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/students`),
        fetch(`${API_BASE_URL}/api/institutions`),
        fetch(`${API_BASE_URL}/api/issues`),
      ]);
      if (stuRes.ok) setStudents(await stuRes.json());
      if (instRes.ok) setInstitutions(await instRes.json());
      if (issuesRes.ok) setIssues(await issuesRes.json());
    } catch {
      setStudents(INITIAL_STUDENTS);
      setInstitutions(INITIAL_INSTITUTIONS);
      setIssues(INITIAL_VALIDATION_ISSUES);
    }
    setNotifications(INITIAL_NOTIFICATIONS);
    setSearchQuery('');
    setSelectedStudent(null);
  };

  const stats = useMemo(() => {
    const totalStudents = students.length;
    const validatedStudents = students.filter((s) => s.validationStatus === 'VALIDATED').length;
    const reviewRequiredStudents = students.filter(
      (s) => s.validationStatus === 'REQUIRES_REVIEW'
    ).length;
    const rejectedStudents = students.filter((s) => s.validationStatus === 'REJECTED').length;
    const pendingStudents = students.filter((s) => s.validationStatus === 'PENDING').length;
    const totalInstitutions = institutions.length;
    const openIssuesCount = issues.filter((i) => i.status === 'OPEN').length;

    let totalIntakeSeats = 0;
    let reportedIntakeSeats = 0;
    institutions.forEach((inst) => {
      inst.programmes.forEach((prog) => {
        totalIntakeSeats += prog.approvedIntake;
        reportedIntakeSeats += prog.reportedEnrolment;
      });
    });

    return {
      totalStudents,
      validatedStudents,
      reviewRequiredStudents,
      rejectedStudents,
      pendingStudents,
      totalInstitutions,
      openIssuesCount,
      totalIntakeSeats,
      reportedIntakeSeats,
    };
  }, [students, institutions, issues]);

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        students,
        institutions,
        issues,
        notifications,
        searchQuery,
        setSearchQuery,
        selectedStudent,
        setSelectedStudent,
        resolveIssue,
        triggerVerificationScan,
        updateStudentStatus,
        importStudentBatch,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        resetToDemoDefaults,
        stats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
