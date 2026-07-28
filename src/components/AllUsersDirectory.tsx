import React, { useState, useMemo } from 'react';
import { Users, Search, Shield, UserCheck, Mail, Building2, MapPin, CheckCircle2, Filter, Wrench, Trash2 } from 'lucide-react';
import { getUserRole } from '../utils/roleUtils';
import { normalizeNameForComparison } from '../utils/nameNormalization';
import { resolveCanonicalUserIdentity, isValidUserRecord, formatMiddleName, compareUsersAlphabetically, formatFormalName } from '../services/userIdentityResolver';
import { SimpleTable } from './DashboardKit';
import { RepairEmailModal } from './RepairEmailModal';
import { UserAvatar } from './UserAvatar';

interface AllUsersDirectoryProps {
  users: any[];
  loading: boolean;
  onEditUser: (user: any) => void;
  onDeleteUser?: (user: any) => void;
  currentUser?: any;
}

export const AllUsersDirectory: React.FC<AllUsersDirectoryProps> = ({ users, loading, onEditUser, onDeleteUser, currentUser }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [isRepairModalOpen, setIsRepairModalOpen] = useState(false);

  const loggedInRole = getUserRole(currentUser);
  const isStaffLoggedIn = loggedInRole === 'Staff';
  const isAdminLoggedIn = loggedInRole === 'Admin';

  const filteredUsers = useMemo(() => {
    const list = users.filter((u) => {
      const status = String(u.accountStatus || u.status || '').toLowerCase();
      if (status === 'merged' || status === 'deleted' || u.isDeleted || u.deleted) {
        return false;
      }
      if (!isValidUserRecord(u)) {
        return false;
      }
      const role = getUserRole(u);
      if (roleFilter !== 'all' && role.toLowerCase() !== roleFilter.toLowerCase()) {
        return false;
      }
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      const canonical = resolveCanonicalUserIdentity(u);

      const matchesName = canonical.fullName.toLowerCase().includes(q) || canonical.firstName.toLowerCase().includes(q) || canonical.lastName.toLowerCase().includes(q);
      const email = canonical.email.toLowerCase();
      const seqId = canonical.idNumber.toLowerCase();
      const school = canonical.school.toLowerCase();
      return matchesName || email.includes(q) || seqId.includes(q) || school.includes(q);
    });

    return [...list].sort(compareUsersAlphabetically);
  }, [users, searchQuery, roleFilter]);

  const rows = filteredUsers.map((u) => {
    const role = getUserRole(u);
    const canonical = resolveCanonicalUserIdentity(u);
    const name = formatFormalName(canonical);
    const email = canonical.email || 'No email';
    const seqId = canonical.idNumber || u.doc_id || '—';
    const school = canonical.school || '—';
    const status = u.accountStatus || u.status || 'Active';

    let roleBadgeColor = 'bg-teal-50 text-teal-700 border-teal-200';
    if (role === 'Admin') roleBadgeColor = 'bg-purple-50 text-purple-700 border-purple-200';
    else if (role === 'Staff') roleBadgeColor = 'bg-blue-50 text-blue-700 border-blue-200';

    return {
      originalUser: u,
      id: u.uid || u.doc_id || seqId,
      name,
      email,
      seqId,
      school,
      role,
      status,
      roleBadgeColor,
    };
  });

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="text-teal-600" size={22} /> All System Users Directory
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Viewing all registered accounts across Admin, Staff, and Reviewee roles ({users.length} total users).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Search Bar */}
          <div className="relative flex-1 sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, email, ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:bg-white focus:border-teal-500 outline-none transition-all"
            />
          </div>

          {/* Role Filter */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl">
            {['all', 'admin', 'staff', 'reviewee'].map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                  roleFilter === r
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {isAdminLoggedIn && (
            <button
              onClick={() => setIsRepairModalOpen(true)}
              className="px-4 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 shadow-sm"
            >
              <Wrench size={14} /> Repair Email Links
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-sm overflow-hidden">
        <SimpleTable
          compact
          loading={loading}
          emptyLabel="No users found matching your search or filter."
          rows={rows}
          columns={[
            {
              key: 'role',
              header: 'Role',
              render: (r) => (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${r.roleBadgeColor}`}>
                  {r.role}
                </span>
              ),
            },
            {
              key: 'seqId',
              header: 'ID Number',
              render: (r) => <span className="font-mono text-xs font-bold text-slate-700">{r.seqId}</span>,
            },
            {
              key: 'name',
              header: 'Name',
              render: (r) => <span className="font-bold text-slate-900">{r.name}</span>,
            },
            {
              key: 'email',
              header: 'Email Address',
              render: (r) => (
                <span className="text-xs font-medium text-slate-600 flex items-center gap-1.5">
                  <Mail size={12} className="text-teal-600 shrink-0" />
                  {r.email}
                </span>
              ),
            },
            {
              key: 'school',
              header: 'School',
              render: (r) => <span className="text-xs font-medium text-slate-600">{r.school}</span>,
            },
            {
              key: 'actions',
              header: 'Actions',
              render: (r) => {
                const canEdit = !isStaffLoggedIn || r.role === 'Reviewee';
                if (!canEdit) {
                  return (
                    <span
                      title="Staff members can only edit Reviewee accounts"
                      className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/80"
                    >
                      No Access
                    </span>
                  );
                }
                return (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onEditUser(r.originalUser)}
                      className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all cursor-pointer"
                    >
                      Edit
                    </button>
                    {isAdminLoggedIn && onDeleteUser && (
                      <button
                        type="button"
                        onClick={() => onDeleteUser(r.originalUser)}
                        className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all cursor-pointer border border-rose-100 flex items-center gap-1 font-extrabold text-xs"
                        title={r.originalUser.uid === currentUser?.uid ? "You cannot delete your own active admin account" : `Delete ${r.name}`}
                        aria-label={`Delete ${r.name}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                );
              },
            },
          ]}
        />
      </div>
      <RepairEmailModal isOpen={isRepairModalOpen} onClose={() => setIsRepairModalOpen(false)} />
    </div>
  );
};
