import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { LoginPage } from './components/pages/LoginPage';
import { OverviewPage } from './components/pages/OverviewPage';
import { StudentRecordsPage } from './components/pages/StudentRecordsPage';
import { DataUploadPage } from './components/pages/DataUploadPage';
import { ValidationIssuesPage } from './components/pages/ValidationIssuesPage';
import { InstitutionsPage } from './components/pages/InstitutionsPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { SettingsPage } from './components/pages/SettingsPage';
import { SystemHealthPage } from './components/pages/SystemHealthPage';
import { UserManagementPage } from './components/pages/UserManagementPage';
import { AuditLogsPage } from './components/pages/AuditLogsPage';

const AppContent: React.FC = () => {
  const { activeTab, currentUser, isLoadingAuth } = useApp();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-slate-50 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Validating EduVerify session...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginPage />;
  }

  const renderActiveView = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewPage />;
      case 'students':
        return <StudentRecordsPage />;
      case 'upload':
        return <DataUploadPage />;
      case 'issues':
        return <ValidationIssuesPage />;
      case 'institutions':
        return <InstitutionsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'system-health':
        return <SystemHealthPage />;
      case 'users':
        return <UserManagementPage />;
      case 'audit-logs':
        return <AuditLogsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans">
      {/* Sidebar Navigation */}
      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header */}
        <TopNav onToggleMobileMenu={() => setMobileOpen(true)} />

        {/* Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto">
            {renderActiveView()}
          </div>

          {/* Footer Note */}
          <footer className="mt-12 pt-6 border-t border-slate-200 text-center text-xs text-slate-500 max-w-7xl mx-auto pb-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">EduVerify</span>
                <span>—</span>
                <span>AICTE-Approved Institutional Student Registry Prototype</span>
              </div>
              <div className="text-[11px] text-slate-500">
                Logged in as <strong className="text-slate-700">{currentUser?.email || 'Authenticated User'}</strong> ({currentUser?.role?.replace('_', ' ') || 'Role'}) · 100% Synthetic Fictional Data
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
