import React, { useState, useRef } from "react";
import {
  Bell,
  CalendarDays,
  Check,
  Link,
  LogOut,
  Menu,
  Pencil,
  RotateCcw,
  UserCircle,
  X,
  ChevronDown,
} from "lucide-react";
import { NotificationBell } from './NotificationBell';
import { type Firestore } from 'firebase/firestore';
import type { Notification } from '../types';
import { UserAvatar } from './UserAvatar';
import { PortalBottomMenu, type PortalBottomMenuItem } from './ui/portal-bottom-menu';

import { motion, AnimatePresence } from 'motion/react';
import SidebarBrandHeader from "./layout/SidebarBrandHeader";
import { MessengerIcon } from "./MessengerIcon";
import { FacebookIcon } from "./FacebookIcon";
import { SignOutConfirmDialog } from "./auth/SignOutConfirmDialog";


type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
};

const DesktopSidebar = React.memo(({
  activeTab,
  onTabChange,
  navItems,
  onLogout,
  onRequestSignOut,
  role,
  idNumber,
  roleDetail,
  photoURL,
}: {
  activeTab: string;
  onTabChange: (key: string) => void;
  navItems: NavItem[];
  onLogout: () => void;
  onRequestSignOut?: () => void;
  role: "Admin" | "Staff" | "Reviewee";
  idNumber?: string | null;
  roleDetail?: string;
  photoURL?: string | null;
}) => {
  return (
    <aside className="hidden w-[280px] shrink-0 border-r border-slate-200 bg-white lg:flex lg:flex-col h-full overflow-hidden">
      <div className="p-6 pb-2">
        <div className="flex flex-col items-center text-center">
          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full border border-slate-50 shadow-sm mb-4">
            <img src="/logo.svg" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-black leading-tight text-[#1E293B] uppercase">
              Samaritan Review Center
            </h2>
            <p className="mt-1 text-[11px] font-black text-[#007C89] uppercase tracking-[0.2em]">
              GRTMNDS
            </p>
          </div>
        </div>

        {/* Profile Card */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/50 p-3">
          <div className="flex items-center gap-3 min-w-0">
            <UserAvatar 
              photoURL={photoURL} 
              altText={roleDetail || role} 
              size={32} 
              className="h-8 w-8 rounded-full border border-white shadow-sm" 
            />
            <div className="min-w-0">
              <p className="truncate text-[11px] font-black text-slate-900 uppercase">
                {roleDetail || role}
              </p>
              <p className="text-[10px] font-bold text-slate-400">
                {idNumber || 'No ID'}
              </p>
            </div>
          </div>
          <ChevronDown size={14} className="text-slate-400" />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 custom-scrollbar">
        <div className="space-y-4">
          <div>
            <p className="mb-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Menu
            </p>
            <nav className="space-y-0.5">
              {navItems.map((item) => {
                const active = activeTab === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onTabChange(item.key)}
                    className={`flex h-10 w-full items-center gap-3 rounded-lg px-3 transition-all ${
                      active
                        ? "bg-[#1A1C1E] text-white shadow-md"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <span className={`shrink-0 ${active ? "text-white" : "text-slate-400"}`}>
                      {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement<any>, { size: 18 }) : item.icon}
                    </span>
                    <span className="truncate text-xs font-normal whitespace-nowrap">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      <div className="mt-auto shrink-0 p-4 border-t border-slate-100">
        <div className="mb-4 rounded-[1.25rem] bg-teal-50 p-4 border border-teal-100">
          <p className="text-[10px] font-black text-slate-900">
            Need assistance?
          </p>
          <a 
            href="https://www.facebook.com/profile.php?id=61566509220782"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-[#007C89] px-3 py-2.5 text-[10px] font-black text-white hover:bg-teal-700 transition-colors"
          >
            <FacebookIcon className="w-4 h-4 shrink-0" />
            Contact Support
          </a>
        </div>
        <button
          onClick={() => onRequestSignOut ? onRequestSignOut() : onLogout()}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
});

const DEFAULT_MESSENGER_LINK = "https://www.messenger.com/j/AbaK9Q9EUN0N4VmQ/?send_source=gc%3Acopy_invite_link_c";


export function PortalLayout({
  title,
  subtitle,
  role,
  roleDetail,
  activeTab,
  onTabChange,
  navItems,
  footerItems,
  onLogout,
  notificationCount = 0,
  notifications = [],
  db,
  seqId,
  idNumber,
  photoURL,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  role: "Admin" | "Staff" | "Reviewee";
  roleDetail?: string;
  activeTab: string;
  onTabChange: (key: string) => void;
  navItems: NavItem[];
  footerItems?: NavItem[];
  onLogout: () => void;
  notificationCount?: number;
  notifications?: Notification[];
  db?: Firestore;
  seqId?: string;
  idNumber?: string | null;
  photoURL?: string | null;
  children: React.ReactNode;
}) {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Messenger Group Chat Link & Edit state
  const [messengerLink, setMessengerLink] = useState(() => {
    return localStorage.getItem("messenger_groupchat_link") || DEFAULT_MESSENGER_LINK;
  });
  const [showMessengerModal, setShowMessengerModal] = useState(false);
  const [editLinkValue, setEditLinkValue] = useState(messengerLink);
  const [linkSavedToast, setLinkSavedToast] = useState(false);

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef<boolean>(false);

  const startPressTimer = () => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        try { window.navigator.vibrate(50); } catch (e) {}
      }
      setEditLinkValue(messengerLink);
      setShowMessengerModal(true);
    }, 500);
  };

  const cancelPressTimer = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessengerClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      isLongPressRef.current = false;
    }
  };

  const handleMessengerContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setEditLinkValue(messengerLink);
    setShowMessengerModal(true);
  };

  const handleConfirmSignOut = async () => {
    setIsSigningOut(true);
    try {
      await onLogout();
    } catch (err) {
      console.error("Sign out error:", err);
      alert("Unable to sign out. Please try again.");
    } finally {
      setIsSigningOut(false);
      setShowSignOutModal(false);
    }
  };

  const today = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  const handleNavClick = React.useCallback((key: string) => {
    onTabChange(key);
    setIsMobileSidebarOpen(false);
  }, [onTabChange]);

  // Body scroll lock
  React.useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    if (isMobileSidebarOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = previousOverflow;
    }
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileSidebarOpen]);

  // Close on route change (assuming activeTab changes with route)
  React.useEffect(() => {
    setIsMobileSidebarOpen(false);
  }, [activeTab]);

  const mobileNavItems = footerItems || navItems;

  const getInitials = (name?: string) => {
    if (!name || name === "Super Admin" || name === "Staff Member" || name === "Reviewee") return "";
    const parts = name.split(" ").filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const initials = getInitials(roleDetail);

  return (
    <div className="h-[100dvh] w-full bg-[#F8FAFC] text-slate-900 overflow-hidden relative">
      <div className="flex h-full w-full overflow-hidden bg-[#F8FAFC]">
        {/* Desktop Sidebar */}
        <DesktopSidebar
          activeTab={activeTab}
          onTabChange={handleNavClick}
          navItems={navItems}
          onLogout={onLogout}
          onRequestSignOut={() => setShowSignOutModal(true)}
          role={role}
          idNumber={idNumber}
          roleDetail={roleDetail}
          photoURL={photoURL}
        />

        {/* Mobile Header */}
        <div className="flex w-full min-w-0 flex-1 flex-col h-full overflow-hidden">
          {/* Top Mobile/Desktop Header */}
          <header className="sticky top-0 z-40 flex h-auto min-h-[64px] items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md lg:h-20 lg:px-8 shrink-0">
            {/* Mobile Left */}
            <div className="flex items-center gap-3 lg:hidden min-w-0 flex-1">
              <button
                onClick={() => setIsMobileSidebarOpen(true)}
                aria-label="Open navigation menu"
                aria-expanded={isMobileSidebarOpen}
                aria-controls="mobile-sidebar"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-slate-900"
              >
                <Menu size={20} />
              </button>
              <div className="flex flex-col min-w-0">
                <h1 className="truncate text-sm font-bold tracking-tight">{title}</h1>
                {role === "Reviewee" && seqId && (
                  <span className="truncate text-xs font-medium text-slate-500 mt-0.5">ID: {seqId}</span>
                )}
              </div>
            </div>

            {/* Desktop Left */}
            <div className="hidden lg:block">
               <h1 className="text-2xl font-black tracking-tight">{title}</h1>
               {role === "Reviewee" && seqId && (
                 <div className="text-sm font-bold text-slate-500 mt-1">ID: {seqId}</div>
               )}
               <div className="text-sm font-medium text-slate-500">{subtitle}</div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 lg:gap-4 shrink-0">
              <div className="hidden items-center gap-2 rounded-2xl bg-slate-100 px-4 py-2 lg:flex">
                <CalendarDays size={16} className="text-slate-400" />
                <span className="text-xs font-black text-slate-600">{today}</span>
              </div>

              <div className="relative group">
                <a
                  href={messengerLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onTouchStart={startPressTimer}
                  onTouchEnd={cancelPressTimer}
                  onTouchMove={cancelPressTimer}
                  onMouseDown={(e) => { if (e.button === 0) startPressTimer(); }}
                  onMouseUp={cancelPressTimer}
                  onMouseLeave={cancelPressTimer}
                  onClick={handleMessengerClick}
                  onContextMenu={handleMessengerContextMenu}
                  className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors select-none"
                  title="Open Messenger (Long press or right-click to edit link)"
                >
                  <MessengerIcon className="w-5 h-5 pointer-events-none" />
                  <span 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditLinkValue(messengerLink);
                      setShowMessengerModal(true);
                    }}
                    className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-teal-600 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-sm text-[9px] cursor-pointer"
                    title="Edit Messenger link"
                  >
                    <Pencil size={9} />
                  </span>
                </a>
              </div>

              <div className="relative">
                {db ? (
                  <NotificationBell notifications={notifications} db={db} />
                ) : (
                  <>
                    <button className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 hover:bg-slate-100">
                      <Bell size={20} />
                    </button>
                    {notificationCount > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-4 ring-white">
                        {notificationCount}
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-1 pr-3 lg:p-1.5 lg:pr-4">
                <UserAvatar 
                  photoURL={photoURL} 
                  altText={roleDetail || role} 
                  size={36} 
                  className="h-8 w-8 lg:h-9 lg:w-9 rounded-xl object-cover border border-slate-100 bg-white shadow-sm" 
                />
                <div className="hidden lg:block">
                  <p className="text-xs font-black leading-none uppercase">
                    {roleDetail || role}
                  </p>
                  <p className="mt-1 text-[10px] font-bold text-slate-400">
                    {idNumber || (role === "Admin" ? "Super Admin" : role)}
                  </p>
                </div>
              </div>
            </div>
          </header>

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto scroll-smooth px-4 pb-[calc(92px+env(safe-area-inset-bottom))] pt-6 lg:px-8 lg:pb-12">
            {activeTab === 'notifications' ? (
              <div className="space-y-4 max-w-2xl mx-auto">
                <h2 className="text-xl font-black text-slate-900">Notifications</h2>
                {notifications.length === 0 ? (
                  <div className="p-8 text-center bg-white rounded-2xl border border-slate-200">
                    <Bell className="mx-auto h-8 w-8 text-slate-300 mb-3" />
                    <p className="text-sm font-medium text-slate-500">No notifications yet.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    {notifications.map((n) => (
                      <div key={n.id} className={`p-4 border-b border-slate-100 last:border-b-0 ${n.isRead ? 'bg-slate-50/50' : 'bg-white'}`}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1 pr-4">
                            <h4 className="font-bold text-sm text-slate-900">{n.title}</h4>
                            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                          </div>
                          {!n.isRead && db && (
                            <button
                              onClick={async () => {
                                try {
                                  const { updateDoc, doc, serverTimestamp } = await import('firebase/firestore');
                                  await updateDoc(doc(db, 'notifications', n.id), {
                                    isRead: true,
                                    readAt: serverTimestamp(),
                                  });
                                } catch (error) {
                                  console.error('Error marking notification as read:', error);
                                }
                              }}
                              className="shrink-0 p-1.5 text-teal-600 bg-teal-50 hover:bg-teal-100 rounded-xl transition-colors"
                              title="Mark as read"
                            >
                              <Check size={16} strokeWidth={3} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              children
            )}
          </main>

          {/* Mobile Bottom Navigation */}
          <div className="lg:hidden">
            <PortalBottomMenu
              items={mobileNavItems.map(item => ({
                id: item.key,
                label: item.label,
                icon: item.icon,
                badgeCount: item.key === 'notifications' ? notificationCount : undefined,
              }))}
              activeId={activeTab}
              onSelect={(id) => {
                if (id === 'menu') {
                  setIsMobileSidebarOpen(true);
                } else {
                  handleNavClick(id);
                }
              }}
            />
          </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      <AnimatePresence>
        {isMobileSidebarOpen && (
          <div className="fixed inset-0 z-[1000] lg:hidden">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/45 backdrop-blur-sm transition-opacity"
              onClick={() => setIsMobileSidebarOpen(false)}
              aria-hidden="true"
            />
            <motion.aside 
              id="mobile-sidebar"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 h-full w-[280px] max-w-[85%] bg-white shadow-2xl flex flex-col z-[1001]"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <div className="p-5 pb-2">
                <div className="flex flex-col items-center text-center">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-50 shadow-sm mb-3">
                    <img src="/logo.svg" alt="Logo" className="h-full w-full object-contain" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[11px] font-black leading-tight text-[#1E293B] uppercase">
                      Samaritan Review Center
                    </h2>
                    <p className="mt-1 text-[9px] font-black text-[#007C89] uppercase tracking-[0.2em]">
                      GRTMNDS
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/50 p-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar 
                      photoURL={photoURL} 
                      altText={roleDetail || role} 
                      size={28} 
                      className="h-7 w-7 rounded-full border border-white shadow-sm" 
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black text-slate-900 uppercase">
                        {roleDetail || role}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400">
                        {idNumber || 'No ID'}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={12} className="text-slate-400" />
                </div>
              </div>

              <nav className="flex-1 min-h-0 overflow-y-auto p-3 pt-4 space-y-4">
                <div>
                  <p className="mb-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Menu
                  </p>
                  <div className="space-y-0.5">
                    {navItems.map((item) => {
                      const active = activeTab === item.key;
                      return (
                        <button
                          key={item.key}
                          onClick={() => handleNavClick(item.key)}
                          className={`flex h-10 items-center gap-3 w-full rounded-lg px-3 transition-all ${
                            active
                              ? "bg-[#1A1C1E] text-white shadow-lg"
                              : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
                          }`}
                        >
                          <span className={`shrink-0 ${active ? "text-white" : "text-slate-400"}`}>
                            {React.isValidElement(item.icon) ? React.cloneElement(item.icon as React.ReactElement<any>, { size: 18 }) : item.icon}
                          </span>
                          <span className="truncate text-xs font-normal whitespace-nowrap">
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </nav>

              <div className="mobile-sidebar-footer flex-shrink-0 space-y-2 p-4 border-t border-black/5 bg-white">
                <div className="mb-2 rounded-xl bg-teal-50 p-3 border border-teal-100">
                  <a 
                    href="https://www.facebook.com/profile.php?id=61566509220782"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#007C89] px-3 py-2 text-[10px] font-black text-white"
                  >
                    <FacebookIcon className="w-3.5 h-3.5" />
                    Contact Support
                  </a>
                </div>
                <button
                  onClick={() => {
                    setIsMobileSidebarOpen(false);
                    setShowSignOutModal(true);
                  }}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors px-4 py-2.5 text-xs font-bold text-rose-600"
                >
                  <LogOut size={16} />
                  Sign Out
                </button>
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <SignOutConfirmDialog
        open={showSignOutModal}
        isSigningOut={isSigningOut}
        onCancel={() => setShowSignOutModal(false)}
        onConfirm={handleConfirmSignOut}
      />

      {/* Edit Messenger Link Modal */}
      {showMessengerModal && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <MessengerIcon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Edit Messenger Link</h3>
                  <p className="text-xs text-slate-500 font-medium">Set your custom group chat link</p>
                </div>
              </div>
              <button
                onClick={() => setShowMessengerModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Link size={14} className="text-teal-600" />
                Messenger Group Chat URL
              </label>
              <input
                type="url"
                value={editLinkValue}
                onChange={(e) => setEditLinkValue(e.target.value)}
                placeholder="https://www.messenger.com/j/..."
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                autoFocus
              />
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Paste the invite link or URL of your Facebook Messenger group chat.
              </p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setEditLinkValue(DEFAULT_MESSENGER_LINK);
                }}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <RotateCcw size={13} />
                Reset Default
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowMessengerModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const trimmed = editLinkValue.trim();
                    if (trimmed) {
                      setMessengerLink(trimmed);
                      localStorage.setItem("messenger_groupchat_link", trimmed);
                      setShowMessengerModal(false);
                      setLinkSavedToast(true);
                      setTimeout(() => setLinkSavedToast(false), 3000);
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-xs font-bold text-white hover:bg-teal-700 shadow-md shadow-teal-900/10 transition-colors"
                >
                  <Check size={14} />
                  Save Link
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast Notification */}
      {linkSavedToast && (
        <div className="fixed bottom-6 right-6 z-[130] flex items-center gap-2.5 rounded-xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl animate-bounce">
          <Check size={16} className="text-teal-400" />
          <span>Messenger group chat link updated successfully!</span>
        </div>
      )}
    </div>
  );
}
