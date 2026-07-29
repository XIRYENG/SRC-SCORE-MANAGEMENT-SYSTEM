import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Bug } from 'lucide-react';
import { AuthPage } from './components/AuthPage';
import { SuccessPage } from './components/SuccessPage';
import { RevieweePortal } from './components/RevieweePortal';
import { AdminPortal } from './components/AdminPortal';
import { StaffPortal } from './components/StaffPortal';
import { SyncModal } from './components/SyncModal';
import { FirebaseDiagnosticPanel } from './components/FirebaseDiagnosticPanel';
import { getUserRole, isAdmin, isStaff, isAdminLike } from './utils/roleUtils';
import { initAuth, logout } from './utils/auth';
import { firebaseConfigured, getFirebaseConfig } from './utils/firebase';
import type { RevieweeData } from './types';

export default function App() {
  const [view, setView] = useState<'form' | 'success' | 'portal'>('form');
  const [enrollmentData, setEnrollmentData] = useState<RevieweeData | null>(null);
  const [lastGeneratedId, setLastGeneratedId] = useState<string | null>(null);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState(false);
  const [syncModalTab, setSyncModalTab] = useState<'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity'>('details');
  const [syncModalSection, setSyncModalSection] = useState<'main' | 'search' | 'duplicates' | 'mapping'>('main');
  const [syncModalFolderId, setSyncModalFolderId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [syncProgress, setSyncProgress] = useState<number | undefined>(undefined);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [backgroundTasks, setBackgroundTasks] = useState<any[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('admin') === 'true') {
      const url = new URL(window.location.href);
      url.searchParams.delete('admin');
      window.history.replaceState({}, document.title, url.pathname);
    }

    const checkPath = () => {
      const normalizedPath = decodeURIComponent(window.location.pathname).toLowerCase();
      
      // GUARD 1: UNAUTHENTICATED USER ACCESS PROTECTION
      if (!enrollmentData) {
        setIsSyncModalOpen(false);
        if (
          normalizedPath.startsWith('/syncsettings') || 
          normalizedPath.startsWith('/admin') || 
          normalizedPath.startsWith('/staff') || 
          normalizedPath.startsWith('/reviewee')
        ) {
          window.history.replaceState({}, '', '/login');
        }
        return;
      }

      // GUARD 2: AUTHENTICATED USER ROLE PERMISSIONS
      const userIsAdmin = isAdmin(enrollmentData);
      const userIsStaff = isStaff(enrollmentData);

      if (normalizedPath.startsWith('/syncsettings')) {
        if (!userIsAdmin && !userIsStaff) {
          setIsSyncModalOpen(false);
          window.history.replaceState({}, '', '/reviewee/dashboard');
          return;
        }

        setIsSyncModalOpen(true);
        let section: 'main' | 'search' | 'duplicates' | 'mapping' = 'main';
        let tab: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity' = 'details';

        if (normalizedPath.includes('duplicates') || normalizedPath.includes('duplicate-analysis')) {
          section = 'duplicates';
        } else if (normalizedPath.includes('school-mapping')) {
          section = 'mapping';
        } else if (
          normalizedPath.includes('search-database') ||
          normalizedPath.includes('scores') ||
          normalizedPath.includes('archived') ||
          normalizedPath.includes('leaderboard') ||
          normalizedPath.includes('activity')
        ) {
          section = 'search';

          if (normalizedPath.includes('scores')) tab = 'scores';
          else if (normalizedPath.includes('archived')) tab = 'archived';
          else if (normalizedPath.includes('leaderboard')) tab = 'leaderboard';
          else if (normalizedPath.includes('activity')) tab = 'activity';
          else tab = 'details';
        }

        setSyncModalSection(section);
        setSyncModalTab(tab);
        return;
      } else {
        setIsSyncModalOpen(false);
      }

      if (normalizedPath.startsWith('/admin')) {
        if (!userIsAdmin) {
          if (userIsStaff) {
            window.history.replaceState({}, '', '/staff/dashboard');
          } else {
            window.history.replaceState({}, '', '/reviewee/dashboard');
          }
          return;
        }
      }

      if (normalizedPath.startsWith('/staff')) {
        if (!userIsStaff && !userIsAdmin) {
          window.history.replaceState({}, '', '/reviewee/dashboard');
          return;
        }
      }
    };

    checkPath();

    window.addEventListener('popstate', checkPath);
    return () => {
      window.removeEventListener('popstate', checkPath);
    };
  }, [enrollmentData]);

  const openSyncModal = (section: 'main' | 'search' | 'duplicates' | 'mapping' = 'main', tab: 'details' | 'scores' | 'import_scores' | 'archived' | 'leaderboard' | 'activity' = 'details', folderId?: string) => {
    let url = '/syncsettings';
    if (section === 'search') {
      url += `/search-database/${tab}`;
    } else if (section === 'duplicates') {
      url += '/duplicates';
    } else if (section === 'mapping') {
      url += '/school-mapping';
    }
    window.history.pushState({}, '', url);
    setSyncModalSection(section);
    setSyncModalTab(tab);
    setSyncModalFolderId(folderId);
    setIsSyncModalOpen(true);
  };

  const closeSyncModal = () => {
    if (enrollmentData) {
      if (isAdmin(enrollmentData)) {
        window.history.pushState({}, '', '/admin/dashboard');
      } else if (isStaff(enrollmentData)) {
        window.history.pushState({}, '', '/staff/dashboard');
      } else {
        window.history.pushState({}, '', '/reviewee/dashboard');
      }
    } else {
      window.history.pushState({}, '', '/login');
    }
    setIsSyncModalOpen(false);
  };

  const normalizeRole = (role: any) =>
    String(role || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/-/g, "");

  const handleSuccess = React.useCallback((data: RevieweeData) => {
    setEnrollmentData(data);
    if (data && (data.seqId || data.seq_id)) {
      setLastGeneratedId(data.seqId || data.seq_id || null);
    }
    setView('portal');

    const currentPath = decodeURIComponent(window.location.pathname).toLowerCase();
    if (currentPath === '/' || currentPath === '/login' || currentPath === '/signup') {
      if (isAdmin(data)) {
        window.history.replaceState({}, '', '/admin/dashboard');
      } else if (isStaff(data)) {
        window.history.replaceState({}, '', '/staff/dashboard');
      } else {
        window.history.replaceState({}, '', '/reviewee/dashboard');
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleReset = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("Firebase logout error during portal reset:", err);
    }
    setEnrollmentData(null);
    setIsSyncModalOpen(false);
    setView('form');
    window.history.replaceState({}, '', '/login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSync = async (filters: { year: string; schools?: string[]; dateFrom?: string; dateTo?: string; isAutoSync?: boolean }) => {
    const taskId = Date.now().toString();
    const newTask = {
      id: taskId,
      name: `Sync to Sheet: ${filters.year}`,
      progress: 0,
      status: 'working',
      message: 'Connecting to server...',
      startTime: new Date()
    };
    setBackgroundTasks(prev => [...prev, newTask]);

    const updateTask = (updates: any) => {
      setBackgroundTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    };

    const maxRetries = 2;
    let attempt = 0;
    let success = false;

    while (attempt <= maxRetries && !success) {
      try {
        if (attempt > 0) {
          updateTask({ message: `Reconnecting to server (attempt ${attempt + 1})...` });
          await new Promise(r => setTimeout(r, 1500 * attempt));
        }

        const response = await fetch('/api/sync-to-sheet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            adminId: enrollmentData?.seqId || "000126", 
            adminName: enrollmentData ? `${enrollmentData.first_name} ${enrollmentData.last_name}` : "Admin",
            adminRole: enrollmentData?.role || "admin",
            password: "",
            year: filters.year,
            schools: filters.schools,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            isAutoSync: filters.isAutoSync
          }),
        });

        if (!response.ok) {
          let errText = "";
          try { errText = await response.text(); } catch(e) {}
          throw new Error(errText || 'Sync request failed');
        }

        success = true;
        
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split('\n\n');
            buffer = parts.pop() || '';
            
            for (const part of parts) {
              const line = part.trim();
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.replace('data: ', ''));
                  if (data.type === 'progress') {
                    updateTask({ progress: data.progress, message: `Syncing... ${data.progress}%` });
                  } else if (data.type === 'done') {
                    updateTask({ progress: 100, status: 'completed', message: 'Sync completed successfully' });
                  } else if (data.type === 'warning') {
                    console.warn('Sync warning:', data.error);
                  } else if (data.type === 'error') {
                    throw new Error(data.error || 'Unknown sync error');
                  }
                } catch (e) {
                  console.warn('Sync parse notice:', e, line);
                }
              }
            }
          }
        } else {
          updateTask({ progress: 100, status: 'completed', message: 'Sync completed' });
        }
      } catch (err: any) {
        attempt++;
        const isNetErr = String(err?.message || err || '').toLowerCase().includes('failed to fetch') || 
                         String(err?.message || err || '').toLowerCase().includes('network error');
        if (attempt > maxRetries || !isNetErr) {
          console.warn('Sync attempt notice:', err?.message || err);
          const friendlyMessage = isNetErr ? 'Network connection interrupted. Please try again.' : (err.message || 'Sync failed');
          updateTask({ progress: 100, status: 'failed', message: friendlyMessage });
          break;
        }
      }
    }
  };

  const { missingFields: missingKeys } = getFirebaseConfig();

  if (!firebaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-8 text-center">
          <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-rose-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-3">Firebase Unconfigured</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            The application is currently unavailable because the Firebase configuration is incomplete. 
            Please provide the required environment variables or update the configuration file.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-5 text-left border border-slate-100 mb-6">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Missing Required Fields:</p>
            <ul className="space-y-2">
              {missingKeys.map(key => (
                <li key={key} className="flex items-center text-sm text-slate-700 font-medium">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-3" />
                  {key}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => setIsDiagnosticsOpen(true)}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg shadow-blue-500/20 mb-4"
          >
            <Bug className="w-4 h-4" />
            Open Firebase Diagnostics
          </button>
          
          <div className="pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 font-medium">
              If you are the developer, check your <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">.env</code> file or <code className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">firebase-applet-config.json</code>.
            </p>
          </div>
        </div>
        <FirebaseDiagnosticPanel isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full relative selection:bg-blue-100 selection:text-blue-900 font-sans flex flex-col">
      <FirebaseDiagnosticPanel isOpen={isDiagnosticsOpen} onClose={() => setIsDiagnosticsOpen(false)} />
      <AnimatePresence>
        {backgroundTasks.length > 0 && (
          <div className="fixed top-6 right-6 z-[100001] flex flex-col gap-3 pointer-events-none">
            {backgroundTasks.map((task) => (
              <motion.div 
                key={task.id}
                initial={{ opacity: 0, x: 100 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 100 }}
                className="bg-slate-900 border-l-[3px] border-emerald-500 p-4 w-72 text-white shadow-2xl rounded-xl pointer-events-auto"
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-bold text-[10px] text-emerald-400 uppercase tracking-wider truncate mr-4">{task.name}</h3>
                  {(task.status === 'completed' || task.status === 'failed') && (
                    <button
                      onClick={() => setBackgroundTasks(prev => prev.filter(t => t.id !== task.id))}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="w-full bg-slate-800 h-1 rounded-full mb-2 overflow-hidden">
                  <motion.div
                    className={`${task.status === 'failed' ? 'bg-rose-500' : 'bg-emerald-500'} h-1`}
                    initial={{ width: 0 }}
                    animate={{ width: `${task.progress}%` }}
                  ></motion.div>
                </div>

                <p className="text-[10px] font-medium text-slate-400 truncate">{task.message}</p>
                {task.status === 'completed' && (
                  <div className="mt-2 text-[9px] font-bold text-emerald-500 uppercase flex items-center gap-1">
                    <CheckCircle2 size={10} /> Completed
                  </div>
                )}
                {task.status === 'failed' && (
                  <div className="mt-2 text-[9px] font-bold text-rose-500 uppercase flex items-center gap-1">
                    <AlertCircle size={10} /> Failed
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Teal Glow Background (Light & Dark mode aware) */}
      <div
        className="absolute inset-0 z-0 dark:hidden"
        style={{
          backgroundImage: `
            radial-gradient(125% 125% at 50% 90%, #ffffff 40%, #14b8a6 100%)
          `,
          backgroundSize: "100% 100%",
        }}
      />
      <div
        className="absolute inset-0 z-0 hidden dark:block"
        style={{
          backgroundImage: `
            radial-gradient(125% 125% at 50% 90%, #020617 40%, #0d9488 100%)
          `,
          backgroundSize: "100% 100%",
        }}
      />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SyncModal 
          isOpen={isSyncModalOpen && view !== 'portal'} 
          onClose={closeSyncModal} 
          onSync={handleSync}
          loading={loading}
          syncStatus={syncStatus}
          syncProgress={syncProgress}
          syncError={syncError}
          currentUser={enrollmentData}
          backgroundTasks={backgroundTasks}
          setBackgroundTasks={setBackgroundTasks}
          initialTab={syncModalTab}
          initialSection={syncModalSection}
          scoreFolderId={syncModalFolderId}
        />

        {/* Main Content Pane */}
        <main className="flex-1 w-full px-4 sm:px-6 py-8 flex flex-col items-center justify-center">
          <div className="w-full flex flex-col items-center justify-center">
            {view === 'form' && (
              <div className="w-full max-w-lg animate-fade-in flex justify-center">
                <AuthPage onSuccess={handleSuccess} />
              </div>
            )}
            
            {view === 'success' && enrollmentData && (
              <div className="w-full max-w-lg animate-fade-in">
                <SuccessPage data={enrollmentData} onReset={handleReset} onOpenSyncModal={openSyncModal} onOpenPortal={() => { setView('portal'); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
              </div>
            )}

            {view === 'portal' && enrollmentData && (
              <div className="fixed inset-0 z-[100] w-full h-full bg-[#F8FAFC] dark:bg-[#020617] overflow-hidden animate-fade-in">
                {isAdmin(enrollmentData) ? (
                  <AdminPortal 
                    data={enrollmentData} 
                    onLogout={handleReset} 
                    onOpenSyncModal={openSyncModal}
                    syncProps={{ onClose: closeSyncModal, onSync: handleSync, loading, syncStatus, syncProgress, syncError, currentUser: enrollmentData, backgroundTasks, setBackgroundTasks }}
                  />
                ) : isStaff(enrollmentData) ? (
                  <StaffPortal 
                    data={enrollmentData} 
                    onLogout={handleReset} 
                    onOpenSyncModal={openSyncModal}
                    syncProps={{ onClose: closeSyncModal, onSync: handleSync, loading, syncStatus, syncProgress, syncError, currentUser: enrollmentData, backgroundTasks, setBackgroundTasks }}
                  />
                ) : (
                  <RevieweePortal data={enrollmentData} onLogout={handleReset} />
                )}
              </div>
            )}
          </div>
        </main>

        {/* Footer copyright */}
        {view !== 'portal' && (
          <footer className="py-6 border-t border-slate-100 text-center text-slate-400 text-[11px] font-medium bg-white/40 space-y-1">
            <p>Developed by Ariel O. Pesalver, RCrim, MSCJ</p>
            <p>© {new Date().getFullYear()} SRC Registration Form. All rights reserved.</p>
          </footer>
        )}
      </div>
    </div>
  );
}

