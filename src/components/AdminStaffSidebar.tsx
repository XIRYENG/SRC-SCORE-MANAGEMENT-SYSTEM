import React, { useState } from 'react';
import SidebarBrandHeader from './layout/SidebarBrandHeader';
import { SignOutConfirmDialog } from './auth/SignOutConfirmDialog';
import { 
  Shield, 
  Users, 
  RefreshCw, 
  BarChart3, 
  LogOut, 
  Settings, 
  Archive, 
  ChevronDown,
  LayoutDashboard,
  UploadCloud,
  LineChart,
  ShieldCheck,
  Sliders
} from 'lucide-react';
import { isAdmin, isAdminLike } from '../utils/roleUtils';
import type { RevieweeData } from '../types';
import { UserAvatar } from './UserAvatar';

export interface AdminStaffSidebarProps {
  currentUserProfile: RevieweeData;
  activeTab: string;
  onTabSelect: (tabKey: string) => void;
  onSyncScores: () => void;
  onLogout: () => void;
}

export const AdminStaffSidebar: React.FC<AdminStaffSidebarProps> = ({
  currentUserProfile,
  activeTab,
  onTabSelect,
  onSyncScores,
  onLogout
}) => {
  const adminMenuItems = [
    { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { key: "reviewees", label: "Reviewees", icon: Users },
    { key: "score-management", label: "Score Management", icon: BarChart3 },
    { key: "archives", label: "Archives", icon: Archive },
    { key: "analytics", label: "Analytics", icon: LineChart },
    { key: "activity-log", label: "Activity Log", icon: ShieldCheck, adminOnly: true },
    { key: "role-management", label: "Role Management", icon: Shield, adminOnly: true },
    { key: "grade-calculation", label: "Grade Weights", icon: Sliders, adminOnly: true },
    { key: "settings", label: "Settings", icon: Settings },
  ];

  const visibleMenuItems = adminMenuItems.filter((item) => {
    if (item.adminOnly) return isAdmin(currentUserProfile);
    return isAdminLike(currentUserProfile);
  });

  const fullName = `${currentUserProfile.first_name || 'Admin'} ${currentUserProfile.middle_name ? currentUserProfile.middle_name + ' ' : ''}${currentUserProfile.last_name || 'User'}`;

  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onLogout();
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setIsSigningOut(false);
      setShowSignOutModal(false);
    }
  };

  return (
    <>
      <SignOutConfirmDialog
        open={showSignOutModal}
        isSigningOut={isSigningOut}
        onCancel={() => setShowSignOutModal(false)}
        onConfirm={handleConfirmSignOut}
      />
      <aside className="hidden lg:flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white sticky top-0 z-30">
      <SidebarBrandHeader className="border-b border-slate-100" />

      {/* Profile Card */}
      <div className="mt-4">
        <div className="mx-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 shadow-sm hover:border-slate-300 transition-all duration-200">
          <div className="flex items-center gap-3">
            <UserAvatar 
              photoURL={currentUserProfile?.photo_url || currentUserProfile?.photoUrl} 
              altText={fullName} 
              size={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover border-2 border-slate-200 bg-white shadow-sm"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-black uppercase text-slate-900 leading-tight">
                {fullName}
              </p>
              <p className="truncate text-[11px] font-bold text-slate-400 mt-0.5">
                {currentUserProfile.seqId || "SRC-MEMBER"}
              </p>
            </div>

            <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
          </div>
        </div>
      </div>

      {/* Switch Portal Section */}
      <div className="px-4 pt-4 border-b border-slate-100 pb-4">
        <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400 leading-none">
          Switch Portal
        </p>

        <button className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-[12px] font-black text-slate-700 bg-slate-50 border border-slate-200/50 hover:bg-slate-100 transition-colors cursor-pointer">
          <span className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-[#2563EB]" />
            {isAdmin(currentUserProfile) ? "Admin" : "Staff"} Portal
          </span>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </button>
      </div>

      {/* Scrollable Menu Area */}
      <div className="mt-4 flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin">
        <p className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.25em] text-slate-400">
          Menu
        </p>
        <nav className="space-y-1">
          {visibleMenuItems.map((item) => (
            <button
              key={item.key}
              onClick={() => onTabSelect(item.key)}
              className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-bold transition-all cursor-pointer ${
                activeTab === item.key
                  ? "bg-[#020617] text-white shadow-md font-extrabold"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <item.icon
                className={`h-4 w-4 shrink-0 ${
                  activeTab === item.key ? "text-white" : "text-slate-400"
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bottom CTA Buttons */}
      <div className="px-4 py-3 border-t border-slate-100 flex flex-col gap-2 bg-slate-50/50">
        <button 
          onClick={onSyncScores}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/50 px-3 text-[11px] font-black uppercase tracking-wide text-emerald-700 hover:bg-emerald-100 transition-all cursor-pointer shadow-sm w-full"
        >
          <RefreshCw className="h-4 w-4" />
          Sync Scores
        </button>
        
        <button 
          onClick={() => setShowSignOutModal(true)}
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-200/50 hover:bg-red-100 text-red-700 px-3 text-[11px] font-black uppercase tracking-wide transition-all cursor-pointer shadow-sm w-full"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>

      {/* Footer Credit */}
      <div className="border-t border-slate-100 px-5 py-4 text-center bg-slate-50">
        <p className="text-[8px] font-black uppercase tracking-[0.25em] text-slate-400">
          Developed by
        </p>
        <p className="mt-0.5 text-[9px] font-black uppercase leading-tight text-slate-500">
          Ariel Orcia Pesalver, RCrim, MSCJ
        </p>
      </div>
    </aside>
    </>
  );
};
