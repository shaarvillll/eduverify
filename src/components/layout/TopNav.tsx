import React, { useState, useRef, useEffect } from 'react';
import {
  Menu,
  Search,
  Bell,
  RotateCcw,
  CheckCheck,
  ShieldCheck,
  User,
  Info,
  LogOut,
  ChevronDown,
  Building2,
  Shield,
  Key,
  Check,
} from 'lucide-react';
import { useApp, DEMO_ACCOUNTS } from '../../context/AppContext';

interface TopNavProps {
  onToggleMobileMenu: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleMobileMenu }) => {
  const {
    activeTab,
    setActiveTab,
    searchQuery,
    setSearchQuery,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    resetToDemoDefaults,
    currentUser,
    switchRoleDemo,
    logout,
    login,
  } = useApp();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);
  const [showCustomLoginModal, setShowCustomLoginModal] = useState(false);
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('Password123!');
  const [customLoginError, setCustomLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const roleSwitcherRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
      if (roleSwitcherRef.current && !roleSwitcherRef.current.contains(e.target as Node)) {
        setShowRoleSwitcher(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab !== 'students') {
      setActiveTab('students');
    }
  };

  const handleCustomLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setCustomLoginError(null);
    try {
      await login(customEmail.trim(), customPassword);
      setShowCustomLoginModal(false);
      setCustomEmail('');
    } catch (err: any) {
      setCustomLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const getPageTitle = (short = false) => {
    switch (activeTab) {
      case 'overview':
        return short ? 'Overview' : 'System Overview & Executive Dashboard';
      case 'students':
        return short ? 'Student Records' : 'Student Registry & APAAR Records';
      case 'upload':
        return short ? 'Batch Upload' : 'Batch Data Upload & CSV Verification';
      case 'issues':
        return short ? 'Validation Issues' : 'Intake & Data Validation Discrepancies';
      case 'institutions':
        return short ? 'Institutions' : 'Approved Institutions & Intake Capacities';
      case 'reports':
        return short ? 'Reports & Audit' : 'Compliance Analytics & Regulatory Reports';
      case 'settings':
        return short ? 'Settings' : 'Portal Settings & Demonstration Config';
      case 'system-health':
        return short ? 'System Health' : 'System Health & Operational Telemetry';
      case 'users':
        return short ? 'User Management' : 'User Accounts & Permission Clearance';
      case 'audit-logs':
        return short ? 'Audit Logs' : 'Immutable Security Audit Trail';
      default:
        return 'EduVerify';
    }
  };

  const getRoleBadgeStyle = () => {
    if (currentUser?.role === 'INSTITUTION_MEMBER') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    if (currentUser?.role === 'REGULATORY_REVIEWER') {
      return 'bg-purple-50 text-purple-700 border-purple-200';
    }
    return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-3 sm:px-4 md:px-6 bg-white border-b border-slate-200">
      {/* Left Zone: Mobile toggle + Breadcrumb / Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={onToggleMobileMenu}
          className="p-2 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden rounded-md min-w-[36px] min-h-[36px] flex items-center justify-center shrink-0"
          aria-label="Open mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex flex-col min-w-0">
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-medium truncate">
            <span>EduVerify</span>
            <span>/</span>
            <span className="capitalize">{activeTab.replace('-', ' ')}</span>
          </div>
          <h1 className="text-sm md:text-base font-semibold text-slate-900 truncate">
            <span className="sm:hidden">{getPageTitle(true)}</span>
            <span className="hidden sm:inline">{getPageTitle(false)}</span>
          </h1>
        </div>
      </div>

      {/* Center Zone: Quick Search Field */}
      <div className="hidden md:flex items-center flex-1 max-w-xs lg:max-w-md mx-4">
        <form onSubmit={handleSearchSubmit} className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by student name, ID, or masked APAAR (press Enter)..."
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-md focus:outline-hidden focus:ring-1 focus:ring-blue-500 focus:bg-white text-slate-900 placeholder:text-slate-400 transition-all"
          />
        </form>
      </div>

      {/* Right Zone: Role Switcher, Reset, Notifications, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Quick Role Switcher Pill */}
        <div className="relative" ref={roleSwitcherRef}>
          <button
            onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-all cursor-pointer ${getRoleBadgeStyle()} hover:shadow-xs`}
            title="Click to switch role or tenant account"
          >
            <Shield className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate max-w-[140px] sm:max-w-[200px]">
              {currentUser?.role === 'INSTITUTION_MEMBER'
                ? currentUser.institutionId === 'DEMO-INST-001'
                  ? 'NIT Delhi (Inst 1)'
                  : 'Maharashtra Tech (Inst 2)'
                : currentUser?.role === 'REGULATORY_REVIEWER'
                ? currentUser.canViewDocuments
                  ? 'Reviewer (Authorized)'
                  : 'Regulatory Reviewer'
                : 'System Administrator'}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0 opacity-70" />
          </button>

          {showRoleSwitcher && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-50 text-xs">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Switch Role / Test Account</div>
                  <div className="text-[11px] text-slate-500">1-click switch between multi-tenant test roles</div>
                </div>
                <button
                  onClick={() => {
                    setShowRoleSwitcher(false);
                    setShowCustomLoginModal(true);
                  }}
                  className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold"
                >
                  Custom Login
                </button>
              </div>

              <div className="py-1 space-y-1 max-h-80 overflow-y-auto">
                {DEMO_ACCOUNTS.map((acc) => {
                  const isSelected = currentUser?.email === acc.email;
                  return (
                    <button
                      key={acc.email}
                      onClick={async () => {
                        await switchRoleDemo(acc.email);
                        setShowRoleSwitcher(false);
                      }}
                      className={`w-full text-left p-2.5 rounded-md flex items-start gap-2.5 transition-colors ${
                        isSelected
                          ? 'bg-blue-50 border border-blue-200 text-blue-900'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="mt-0.5 shrink-0">
                        {isSelected ? (
                          <Check className="w-4 h-4 text-blue-600" />
                        ) : (
                          <div className="w-4 h-4 rounded-full border border-slate-300" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-900">{acc.label}</span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-600">
                            {acc.badge}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">{acc.description}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">{acc.email}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Demo State Reset Button */}
        <button
          onClick={() => setShowResetConfirm(true)}
          className="flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded border border-slate-200 transition-colors min-w-[36px] min-h-[36px] justify-center"
          title="Reset demonstration state to original seed data"
          aria-label="Reset demonstration state"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="View notifications"
            className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-600 rounded-full ring-2 ring-white" />
            )}
          </button>

          {showNotifications && (
            <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-96 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden z-50 max-h-[80vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-900">Security & Operational Logs</span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 text-[10px] font-mono bg-blue-100 text-blue-700 rounded">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={markAllNotificationsAsRead}
                    className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-500">
                    No new notifications.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => markNotificationAsRead(notif.id)}
                      className={`p-3 text-xs transition-colors cursor-pointer ${
                        notif.read ? 'bg-white opacity-75' : 'bg-blue-50/40 hover:bg-blue-50/70'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-900">{notif.title}</div>
                        <span className="text-[10px] text-slate-600 font-mono shrink-0">
                          {notif.timestamp}
                        </span>
                      </div>
                      <p className="text-slate-600 mt-1 leading-normal">{notif.message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Popover */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            aria-label="User profile"
            className="flex items-center gap-2 p-1 sm:p-1.5 rounded-md hover:bg-slate-100 transition-colors min-w-[36px] min-h-[36px]"
          >
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-semibold shrink-0">
              {currentUser?.fullName ? getInitials(currentUser.fullName) : 'EV'}
            </div>
            <div className="hidden md:flex flex-col text-left">
              <span className="text-xs font-semibold text-slate-900 leading-tight truncate max-w-[140px]">
                {currentUser?.fullName || 'Authenticated User'}
              </span>
              <span className="text-[10px] text-slate-600 truncate max-w-[140px]">
                {currentUser?.institutionName || currentUser?.role?.replace('_', ' ') || 'AICTE Protocol'}
              </span>
            </div>
          </button>

          {showProfileMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 text-xs text-slate-700 z-50">
              <div className="px-3.5 py-2.5 border-b border-slate-100">
                <div className="font-semibold text-slate-900">{currentUser?.fullName}</div>
                <div className="text-[11px] text-slate-500 truncate font-mono">{currentUser?.email}</div>
                <div className="mt-2 flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Shield className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Role: <strong className="text-slate-900">{currentUser?.role.replace('_', ' ')}</strong></span>
                  </div>
                  {currentUser?.institutionName && (
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{currentUser.institutionName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-[10px]">
                    <ShieldCheck className={`w-3.5 h-3.5 ${currentUser?.canViewDocuments ? 'text-emerald-600' : 'text-slate-400'}`} />
                    <span>Document Clearance: <strong>{currentUser?.canViewDocuments ? 'Authorized' : 'Restricted'}</strong></span>
                  </div>
                </div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => {
                    setActiveTab('settings');
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Portal Settings</span>
                </button>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    setShowRoleSwitcher(true);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2 text-slate-700"
                >
                  <Key className="w-3.5 h-3.5 text-slate-400" />
                  <span>Switch Role / Account</span>
                </button>

                <div className="my-1 border-t border-slate-100" />

                <button
                  onClick={() => {
                    logout();
                    setShowProfileMenu(false);
                  }}
                  className="w-full text-left px-3.5 py-2 hover:bg-rose-50 flex items-center gap-2 text-rose-700"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Custom Login */}
      {showCustomLoginModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200 p-6 space-y-4">
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-600" />
              <span>Sign In with Custom Account</span>
            </h4>

            {customLoginError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                {customLoginError}
              </div>
            )}

            <form onSubmit={handleCustomLogin} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="name@institution.ac.in"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCustomLoginModal(false)}
                  className="px-3 py-1.5 font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="px-4 py-1.5 font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                >
                  {isLoggingIn ? 'Authenticating...' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demo Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-xl border border-slate-200 p-5">
            <h4 className="text-sm font-semibold text-slate-900">Synchronize Live Data?</h4>
            <p className="text-xs text-slate-600 mt-1.5">
              This will re-synchronize student records, institutions, and validation issues from PostgreSQL for your authenticated session.
            </p>
            <div className="flex items-center justify-end gap-2 mt-4">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 rounded border border-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  resetToDemoDefaults();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
              >
                Confirm Synchronize
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
