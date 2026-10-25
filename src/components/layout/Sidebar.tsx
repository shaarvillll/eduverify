import React from 'react';
import {
  LayoutDashboard,
  Users,
  UploadCloud,
  AlertOctagon,
  Building2,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  CheckCircle,
  X,
} from 'lucide-react';
import { useApp, NavTab } from '../../context/AppContext';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isCollapsed,
  setIsCollapsed,
  mobileOpen,
  setMobileOpen,
}) => {
  const { activeTab, setActiveTab, stats } = useApp();

  const navItems: { id: NavTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'students', label: 'Student Records', icon: Users, badge: stats.totalStudents },
    { id: 'upload', label: 'Data Upload', icon: UploadCloud },
    { id: 'issues', label: 'Validation Issues', icon: AlertOctagon, badge: stats.openIssuesCount },
    { id: 'institutions', label: 'Institutions', icon: Building2 },
    { id: 'reports', label: 'Reports & Audit', icon: FileSpreadsheet },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelectTab = (tab: NavTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col bg-slate-900 border-r border-slate-800 text-slate-300 transition-all duration-200 select-none ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-800">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-blue-600 text-white shrink-0 shadow-xs">
              <ShieldCheck className="w-5 h-5" />
            </div>
            {(!isCollapsed || mobileOpen) && (
              <div className="flex flex-col min-w-0">
                <span className="text-base font-bold tracking-tight text-white truncate">
                  EduVerify
                </span>
                <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase truncate">
                  APAAR Student Registry
                </span>
              </div>
            )}
          </div>
          {/* Collapse Toggle for Desktop */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center w-7 h-7 text-slate-400 hover:text-white hover:bg-slate-800 rounded transition-colors"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
          {/* Mobile Close Button */}
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden flex items-center justify-center p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-md transition-colors min-w-[36px] min-h-[36px]"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Institution Badge */}
        {!isCollapsed && (
          <div className="px-4 py-2.5 mx-3 my-3 bg-slate-800/60 border border-slate-700/60 rounded text-xs">
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">
              Institutional Authority
            </div>
            <div className="text-white font-semibold truncate mt-0.5">
              AICTE Technical Cell
            </div>
            <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 mt-1">
              <CheckCircle className="w-3 h-3" />
              <span>Verification Node Online</span>
            </div>
          </div>
        )}

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleSelectTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-md text-sm font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                {!isCollapsed && (
                  <span className="truncate flex-1">{item.label}</span>
                )}
                {!isCollapsed && item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`ml-auto px-2 py-0.5 text-[11px] font-mono rounded tabular-nums ${
                      item.id === 'issues'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom Synthetic Disclaimer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/40 text-[11px] text-slate-400">
          {!isCollapsed ? (
            <div>
              <div className="flex items-center justify-between text-slate-400 font-medium">
                <span>Version 1.0-Demo</span>
                <span className="text-blue-400">AICTE Protocol</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                Fictional Synthetic Dataset
              </div>
            </div>
          ) : (
            <div className="text-center font-mono text-[10px] text-slate-500">
              DEMO
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
