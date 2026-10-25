import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Sidebar } from './components/layout/Sidebar';
import { TopNav } from './components/layout/TopNav';
import { OverviewPage } from './components/pages/OverviewPage';
import { StudentRecordsPage } from './components/pages/StudentRecordsPage';
import { DataUploadPage } from './components/pages/DataUploadPage';
import { ValidationIssuesPage } from './components/pages/ValidationIssuesPage';
import { InstitutionsPage } from './components/pages/InstitutionsPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { SettingsPage } from './components/pages/SettingsPage';

const AppContent: React.FC = () => {
  const { activeTab } = useApp();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

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
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
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
                100% Synthetic Fictional Data · Designed for AICTE Technical Administration
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
