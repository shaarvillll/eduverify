import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import {
  StudentRecord,
  Institution,
  ValidationIssue,
  NotificationItem,
  ValidationStatus,
  AuthUser,
  UserRole,
} from '../types';
import {
  INITIAL_INSTITUTIONS,
  INITIAL_STUDENTS,
  INITIAL_VALIDATION_ISSUES,
  INITIAL_NOTIFICATIONS,
} from '../data/syntheticData';
import { API_BASE_URL } from '../config';

export type NavTab =
  | 'overview'
  | 'students'
  | 'upload'
  | 'issues'
  | 'institutions'
  | 'reports'
  | 'settings'
  | 'users'
  | 'audit-logs'
  | 'system-health';

export interface DemoAccount {
  email: string;
  label: string;
  role: UserRole;
  institutionId?: string;
  description: string;
  badge: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    email: 'inst1@nitdelhi.ac.in',
    label: 'NIT Delhi Member',
    role: 'INSTITUTION_MEMBER',
    institutionId: 'DEMO-INST-001',
    description: 'Prof. Rajesh Sharma (Restricted strictly to NIT Delhi)',
    badge: 'Institution Member 1',
  },
  {
    email: 'inst2@mctar.ac.in',
    label: 'Maharashtra Tech Member',
    role: 'INSTITUTION_MEMBER',
    institutionId: 'DEMO-INST-002',
    description: 'Dr. Sunita Deshmukh (Restricted strictly to Maharashtra Tech)',
    badge: 'Institution Member 2',
  },
  {
    email: 'reviewer@aicte-india.org',
    label: 'Regulatory Reviewer (Standard)',
    role: 'REGULATORY_REVIEWER',
    description: 'Dr. Arvind Swaminathan (Reviews across institutions; doc clearance restricted)',
    badge: 'Regulatory Reviewer',
  },
  {
    email: 'reviewer.auth@aicte-india.org',
    label: 'Regulatory Reviewer (Authorized Docs)',
    role: 'REGULATORY_REVIEWER',
    description: 'Dr. Kavita Nair (Authorized for student document inspection)',
    badge: 'Authorized Reviewer',
  },
  {
    email: 'admin@aicte-india.org',
    label: 'System Administrator',
    role: 'SYSTEM_ADMIN',
    description: 'Vikramaditya Verma (Manages users, institutions, audit logs, system health)',
    badge: 'System Administrator',
  },
];

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
  currentUser: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password?: string) => Promise<void>;
  logout: () => Promise<void>;
  switchRoleDemo: (email: string) => Promise<void>;
  fetchWithAuth: (url: string, init?: RequestInit) => Promise<Response>;
  refreshAllData: (authToken?: string) => Promise<void>;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [students, setStudents] = useState<StudentRecord[]>(INITIAL_STUDENTS);
  const [institutions, setInstitutions] = useState<Institution[]>(INITIAL_INSTITUTIONS);
  const [issues, setIssues] = useState<ValidationIssue[]>(INITIAL_VALIDATION_ISSUES);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('eduverify_token'));
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  const fetchWithAuth = useCallback(
    async (url: string, init: RequestInit = {}): Promise<Response> => {
      const activeToken = token || localStorage.getItem('eduverify_token');
      const headers = new Headers(init.headers || {});
      if (activeToken) {
        headers.set('Authorization', `Bearer ${activeToken}`);
      }
      return fetch(url, { ...init, headers });
    },
    [token]
  );

  const refreshAllData = useCallback(
    async (authToken?: string) => {
      const activeToken = authToken || token || localStorage.getItem('eduverify_token');
      if (!activeToken) return;

      const authHeaders = { Authorization: `Bearer ${activeToken}` };

      try {
        const [stuRes, instRes, issuesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/api/students`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/api/institutions`, { headers: authHeaders }),
          fetch(`${API_BASE_URL}/api/issues`, { headers: authHeaders }),
        ]);

        if (stuRes.ok) {
          const stuData = await stuRes.json();
          setStudents(stuData);
        }
        if (instRes.ok) {
          const instData = await instRes.json();
          setInstitutions(instData);
        }
        if (issuesRes.ok) {
          const issuesData = await issuesRes.json();
          setIssues(issuesData);
        }
      } catch (err) {
        console.error('Error refreshing live data with auth:', err);
      }
    },
    [token]
  );

  const login = async (email: string, password = 'Password123!') => {
    const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Login failed (HTTP ${res.status})`);
    }

    const data = await res.json();
    setToken(data.token);
    setCurrentUser(data.user);
    localStorage.setItem('eduverify_token', data.token);

    // Switch default active tab based on role
    if (data.user.role === 'SYSTEM_ADMIN') {
      setActiveTab('system-health');
    } else {
      setActiveTab('overview');
    }

    const newNotif: NotificationItem = {
      id: `NOTIF-${Date.now()}`,
      title: 'Authenticated Session Established',
      message: `Signed in as ${data.user.fullName} (${data.user.role.replace('_', ' ')}).`,
      timestamp: 'Just now',
      type: 'SUCCESS',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    await refreshAllData(data.token);
  };

  const logout = async () => {
    try {
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch (e) {
      console.warn('Logout notification error:', e);
    }
    setToken(null);
    setCurrentUser(null);
    localStorage.removeItem('eduverify_token');
    setStudents([]);
    setIssues([]);
    setActiveTab('overview');
  };

  const switchRoleDemo = async (email: string) => {
    await login(email, 'Password123!');
  };

  // Check initial authentication session
  useEffect(() => {
    const storedToken = localStorage.getItem('eduverify_token');
    if (storedToken) {
      fetch(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` },
      })
        .then((res) => (res.ok ? res.json() : Promise.reject('Token invalid')))
        .then((user: AuthUser) => {
          setToken(storedToken);
          setCurrentUser(user);
          refreshAllData(storedToken);
          setIsLoadingAuth(false);
        })
        .catch(() => {
          localStorage.removeItem('eduverify_token');
          setToken(null);
          setCurrentUser(null);
          setIsLoadingAuth(false);
        });
    } else {
      setIsLoadingAuth(false);
    }
  }, []);

  const triggerVerificationScan = async (): Promise<{ detectedCount: number }> => {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/verification/scan`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `Scan failed (HTTP ${res.status})`);
    }
    const scanResult = await res.json();
    await refreshAllData();

    const newNotif: NotificationItem = {
      id: `NOTIF-${Date.now()}`,
      title: 'Audit Scan Synchronized',
      message: `Database verification scan completed. ${scanResult.detectedCount} discrepancy issues synchronized with PostgreSQL.`,
      timestamp: 'Just now',
      type: 'INFO',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

    return { detectedCount: scanResult.detectedCount };
  };

  const resolveIssue = async (issueId: string, resolution: 'RESOLVED' | 'DISMISSED' | 'OPEN') => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/issues/${issueId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: resolution }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update issue status');
    }

    const data = await response.json();
    const updatedIssue = data.issue as ValidationIssue;
    const updatedStudent = data.student as StudentRecord | null;

    setIssues((prev) => prev.map((iss) => (iss.id === issueId ? updatedIssue : iss)));

    if (updatedStudent) {
      setStudents((prev) =>
        prev.map((s) => (s.id === updatedStudent.id ? { ...s, ...updatedStudent } : s))
      );
      setSelectedStudent((prev) =>
        prev && prev.id === updatedStudent.id ? { ...prev, ...updatedStudent } : prev
      );
    }
  };

  const updateStudentStatus = async (
    studentId: string,
    status: ValidationStatus,
    note?: string
  ) => {
    const response = await fetchWithAuth(
      `${API_BASE_URL}/api/students/${studentId}/status`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          validationStatus: status,
          discrepancyNote: note,
        }),
      }
    );

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || 'Failed to update student status');
    }

    const data = await response.json();
    const updatedStudent = data.student as StudentRecord;

    setStudents((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, ...updatedStudent } : student
      )
    );

    setSelectedStudent((prev) =>
      prev && prev.id === studentId ? { ...prev, ...updatedStudent } : prev
    );
  };

  const importStudentBatch = async (newStudents: StudentRecord[]): Promise<StudentRecord[]> => {
    const response = await fetchWithAuth(`${API_BASE_URL}/api/students/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ students: newStudents }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.message || `Failed to commit batch to server (HTTP ${response.status})`;
      throw new Error(message);
    }

    const data = await response.json();
    const confirmedStudents: StudentRecord[] = data.students || newStudents;

    await refreshAllData();

    const newNotif: NotificationItem = {
      id: `NOTIF-${Date.now()}`,
      title: 'Batch Ingestion Committed',
      message: `Successfully imported ${confirmedStudents.length} student records into PostgreSQL.`,
      timestamp: 'Just now',
      type: 'SUCCESS',
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);

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
    await refreshAllData();
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
      inst.programmes?.forEach((prog) => {
        totalIntakeSeats += prog.approvedIntake || 0;
        reportedIntakeSeats += prog.reportedEnrolment || 0;
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
        currentUser,
        token,
        isAuthenticated: Boolean(currentUser && token),
        isLoadingAuth,
        login,
        logout,
        switchRoleDemo,
        fetchWithAuth,
        refreshAllData,
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
