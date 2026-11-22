'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { PageHeader } from '@/components/admin/page-header';
import { ConfirmDialog } from '@/components/admin/confirm-dialog';
import { ShieldAlert, GraduationCap, UserCheck, Loader2, RefreshCw } from 'lucide-react';

interface ClerkUserData {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  imageUrl: string;
  role: 'admin' | 'teacher' | 'student';
  createdAt: number;
}

export default function AdminRolesPage() {
  const [users, setUsers] = useState<ClerkUserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Confirmation modal state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ userId: string; email: string; newRole: 'admin' | 'teacher' | 'student' } | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/roles');
      if (!res.ok) throw new Error(`HTTP ${res.status}: Failed to fetch roles`);
      const data = await res.json();
      setUsers(data.users || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleSelect = (userId: string, email: string, newRole: 'admin' | 'teacher' | 'student') => {
    setPendingChange({ userId, email, newRole });
    setConfirmOpen(true);
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingChange) return;
    const { userId, newRole } = pendingChange;
    setUpdatingId(userId);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, role: newRole }),
      });
      if (!res.ok) throw new Error('Failed to update role');

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Error updating user role');
    } finally {
      setUpdatingId(null);
      setPendingChange(null);
    }
  };

  const roleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            <ShieldAlert className="w-3 h-3" /> Admin
          </span>
        );
      case 'teacher':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
            <GraduationCap className="w-3 h-3" /> Teacher (Faculty)
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
            <UserCheck className="w-3 h-3" /> Student
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role-Based Access Control (RBAC)"
        description="Manage platform authorization roles stored in Clerk user metadata. Admin, Teacher (Faculty), and Student."
        primaryAction={
          <button
            type="button"
            onClick={fetchUsers}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        }
      />

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
            <p className="text-sm">Loading users from Clerk directory…</p>
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            No registered Clerk users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-200">
              <thead className="bg-slate-950/60 text-xs font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800">
                <tr>
                  <th className="py-3.5 px-4">User</th>
                  <th className="py-3.5 px-4">Current Role</th>
                  <th className="py-3.5 px-4">Change Role</th>
                  <th className="py-3.5 px-4">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {users.map((u) => {
                  const isBusy = updatingId === u.id;
                  const fullName = `${u.firstName} ${u.lastName}`.trim() || 'No Name Provided';

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          {u.imageUrl ? (
                            <Image
                              src={u.imageUrl}
                              alt={fullName}
                              width={36}
                              height={36}
                              className="w-9 h-9 rounded-full object-cover border border-slate-700"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-bold text-xs border border-slate-700">
                              {fullName[0]}
                            </div>
                          )}
                          <div>
                            <div className="font-semibold text-white">{fullName}</div>
                            <div className="text-xs text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">{roleBadge(u.role)}</td>
                      <td className="py-3.5 px-4">
                        <select
                          disabled={isBusy}
                          value={u.role}
                          onChange={(e) =>
                            handleRoleSelect(u.id, u.email, e.target.value as 'admin' | 'teacher' | 'student')
                          }
                          className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 text-xs font-semibold focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                        >
                          <option value="student">Student (Default)</option>
                          <option value="teacher">Teacher (Faculty)</option>
                          <option value="admin">Administrator</option>
                        </select>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-400">
                        {new Date(u.createdAt).toLocaleDateString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Confirm Role Change"
        description={`Are you sure you want to change the authorization role for ${pendingChange?.email} to "${pendingChange?.newRole?.toUpperCase()}"?`}
        confirmText="Update Role"
        variant={pendingChange?.newRole === 'admin' ? 'danger' : 'primary'}
        onConfirm={handleConfirmRoleChange}
      />
    </div>
  );
}
