import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Shield,
  Building2,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuthUser, UserRole } from '../../types';
import { API_BASE_URL } from '../../config';

export const UserManagementPage: React.FC = () => {
  const { fetchWithAuth, currentUser } = useApp();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New user form modal state
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newEmail, setNewEmail] = useState<string>('');
  const [newFullName, setNewFullName] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('Password123!');
  const [newRole, setNewRole] = useState<UserRole>('INSTITUTION_MEMBER');
  const [newInstitutionId, setNewInstitutionId] = useState<string>('DEMO-INST-001');
  const [newCanViewDocs, setNewCanViewDocs] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`);
      if (!res.ok) {
        throw new Error(`Failed to load users (HTTP ${res.status})`);
      }
      const data: AuthUser[] = await res.json();
      setUsers(data);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message || 'Error fetching user accounts' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleToggleActive = async (user: AuthUser) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update user status');
      }

      const updated = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: updated.user.isActive } : u)));
      setStatusMessage({
        type: 'success',
        text: `Account '${user.email}' is now ${updated.user.isActive ? 'Active' : 'Deactivated'}.`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleToggleDocClearance = async (user: AuthUser) => {
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canViewDocuments: !user.canViewDocuments }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update document clearance');
      }

      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, canViewDocuments: updated.user.canViewDocuments } : u))
      );
      setStatusMessage({
        type: 'success',
        text: `Document clearance for '${user.email}' updated to ${
          updated.user.canViewDocuments ? 'GRANTED' : 'REVOKED'
        }.`,
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
      setTimeout(() => setStatusMessage(null), 5000);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          fullName: newFullName,
          role: newRole,
          institutionId: newRole === 'INSTITUTION_MEMBER' ? newInstitutionId : null,
          canViewDocuments: newCanViewDocs,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create user account');
      }

      const created = await res.json();
      setUsers((prev) => [...prev, created.user]);
      setShowCreateModal(false);
      setNewEmail('');
      setNewFullName('');
      setStatusMessage({ type: 'success', text: `User account '${created.user.email}' created successfully.` });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (roleFilter !== 'ALL' && u.role !== roleFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        u.email.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        (u.institutionName && u.institutionName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white border border-slate-200 rounded-lg shadow-2xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span>User Accounts & Permission Clearance</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Manage authenticated accounts, assign institution isolation, control regulatory review clearance, and grant document inspection privileges.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadUsers}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors shadow-2xs"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create User Account</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          className={`p-3.5 rounded-lg text-xs flex items-center gap-2 ${
            statusMessage.type === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border border-rose-200 text-rose-800'
          }`}
        >
          {statusMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3.5 border border-slate-200 rounded-lg shadow-2xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search users by name, email, or institution..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full sm:w-auto text-xs border border-slate-200 rounded-md px-2.5 py-1.5 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="ALL">All Roles</option>
            <option value="INSTITUTION_MEMBER">Institution Member</option>
            <option value="REGULATORY_REVIEWER">Regulatory Reviewer</option>
            <option value="SYSTEM_ADMIN">System Administrator</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-slate-200 rounded-lg shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="py-3 px-4">User Identity</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Institution Scoping</th>
                <th className="py-3 px-4">Document Clearance</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No user accounts match your search filters.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const isCurrent = user.id === currentUser?.id;
                  return (
                    <tr key={user.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Name & Email */}
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{user.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">{user.email}</div>
                        {isCurrent && (
                          <span className="inline-block mt-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-blue-100 text-blue-700">
                            Current Session
                          </span>
                        )}
                      </td>

                      {/* Role */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            user.role === 'INSTITUTION_MEMBER'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : user.role === 'REGULATORY_REVIEWER'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          <Shield className="w-3 h-3" />
                          <span>{user.role.replace('_', ' ')}</span>
                        </span>
                      </td>

                      {/* Institution */}
                      <td className="py-3 px-4">
                        {user.role === 'INSTITUTION_MEMBER' ? (
                          <div>
                            <div className="font-medium text-slate-800 flex items-center gap-1.5">
                              <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[200px]" title={user.institutionName || user.institutionId || ''}>
                                {user.institutionName || user.institutionId}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-400">{user.institutionId}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Central Regulatory Node (All Institutions)</span>
                        )}
                      </td>

                      {/* Document Clearance */}
                      <td className="py-3 px-4">
                        <button
                          onClick={() => handleToggleDocClearance(user)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
                            user.canViewDocuments
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
                          }`}
                          title="Click to toggle document clearance"
                        >
                          {user.canViewDocuments ? (
                            <>
                              <Eye className="w-3 h-3 text-emerald-600" />
                              <span>Authorized</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-400" />
                              <span>Restricted</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Active Status */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                            user.isActive !== false
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {user.isActive !== false ? (
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <XCircle className="w-3 h-3 text-rose-600" />
                          )}
                          <span>{user.isActive !== false ? 'Active' : 'Deactivated'}</span>
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleToggleActive(user)}
                          disabled={isCurrent}
                          className={`px-2.5 py-1 text-xs font-semibold rounded border transition-colors ${
                            user.isActive !== false
                              ? 'text-rose-700 bg-rose-50 border-rose-200 hover:bg-rose-100'
                              : 'text-emerald-700 bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                          } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                          {user.isActive !== false ? 'Deactivate' : 'Activate'}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Create User */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-600" />
              <span>Create New User Account</span>
            </h3>

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Legal Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. Priya Sundaram"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Institutional Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. registrar@example.ac.in"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Temporary Password</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded focus:ring-1 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Assigned Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-500"
                >
                  <option value="INSTITUTION_MEMBER">Institution Member (Own Institution Only)</option>
                  <option value="REGULATORY_REVIEWER">Regulatory Reviewer (Multi-Institution Review)</option>
                  <option value="SYSTEM_ADMIN">System Administrator (Full Administration)</option>
                </select>
              </div>

              {newRole === 'INSTITUTION_MEMBER' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Institution Scoping</label>
                  <select
                    value={newInstitutionId}
                    onChange={(e) => setNewInstitutionId(e.target.value)}
                    className="w-full px-3 py-1.5 border border-slate-200 rounded bg-white focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="DEMO-INST-001">DEMO-INST-001: NIT & Engineering, New Delhi</option>
                    <option value="DEMO-INST-002">DEMO-INST-002: Maharashtra College of Tech, Pune</option>
                    <option value="DEMO-INST-003">DEMO-INST-003: Karnataka Inst of Adv Tech, BLR</option>
                    <option value="DEMO-INST-004">DEMO-INST-004: Tamil Nadu College of Eng, CBE</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="canViewDocsCheck"
                  checked={newCanViewDocs}
                  onChange={(e) => setNewCanViewDocs(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300"
                />
                <label htmlFor="canViewDocsCheck" className="text-slate-700 cursor-pointer">
                  Grant Document Inspection Clearance (Required to inspect sensitive document vault)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Creating...' : 'Provision User Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
