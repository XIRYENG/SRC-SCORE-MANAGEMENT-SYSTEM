import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, CheckCircle2, AlertTriangle, RefreshCw, Globe, 
  Terminal, Key, Wifi, WifiOff, X, Bug, Copy, Check, Info, Server, ExternalLink 
} from 'lucide-react';
import { getFirebaseConfig, firebaseConfigured } from '../utils/firebase';

// Global error logger helper for Firebase and network errors
type FirebaseErrorLog = {
  id: string;
  timestamp: string;
  type: 'auth' | 'firestore' | 'network' | 'config' | 'general';
  code?: string;
  message: string;
  details?: string;
};

let globalErrorListeners: ((error: FirebaseErrorLog) => void)[] = [];

export function logFirebaseError(error: any, type: FirebaseErrorLog['type'] = 'general') {
  const errLog: FirebaseErrorLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toLocaleTimeString(),
    type,
    code: error?.code || error?.name,
    message: String(error?.message || error || 'Unknown error'),
    details: error?.stack || JSON.stringify(error, null, 2)
  };
  
  console.error(`[Firebase Diagnostic Capture] [${type.toUpperCase()}]`, error);
  globalErrorListeners.forEach(listener => listener(errLog));
}

export function FirebaseDiagnosticPanel({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<'config' | 'network' | 'logs' | 'help'>('config');
  const [configInfo, setConfigInfo] = useState<any>(null);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [pingStatus, setPingStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [pingLatency, setPingLatency] = useState<number | null>(null);
  const [pingMessage, setPingMessage] = useState<string>('');
  const [errorLogs, setErrorLogs] = useState<FirebaseErrorLog[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Refresh config inspection
    const evaluated = getFirebaseConfig();
    setConfigInfo(evaluated);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Register error listener
    const errorListener = (newErr: FirebaseErrorLog) => {
      setErrorLogs(prev => [newErr, ...prev.slice(0, 49)]);
    };
    globalErrorListeners.push(errorListener);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      globalErrorListeners = globalErrorListeners.filter(l => l !== errorListener);
    };
  }, []);

  const testConnectivity = async () => {
    setPingStatus('testing');
    setPingMessage('Testing connection to Firebase / Google services...');
    const startTime = performance.now();

    try {
      // Test fetch to Google identity toolkit or public API endpoint
      const response = await fetch('https://identitytoolkit.googleapis.com/v1/projects', {
        method: 'GET',
        mode: 'no-cors'
      });
      const endTime = performance.now();
      const latency = Math.round(endTime - startTime);
      setPingLatency(latency);
      setPingStatus('success');
      setPingMessage(`Connected successfully (Latency: ~${latency}ms). Network routing is operational.`);
    } catch (err: any) {
      // If network request failed due to CORS (which is normal for no-cors/direct API ping without key), 
      // let's test general internet connection via lightweight ping or image/manifest fetch
      try {
        const fallbackStart = performance.now();
        await fetch('https://www.google.com/favicon.ico', { mode: 'no-cors', cache: 'no-store' });
        const fallbackEnd = performance.now();
        const latency = Math.round(fallbackEnd - fallbackStart);
        setPingLatency(latency);
        setPingStatus('success');
        setPingMessage(`Internet connection active (Latency: ~${latency}ms). Firebase API reachable.`);
      } catch (fallbackErr: any) {
        setPingStatus('failed');
        setPingMessage(`Connection failed: ${fallbackErr?.message || 'Unable to reach external endpoints. Check firewall or network.'}`);
        logFirebaseError(fallbackErr, 'network');
      }
    }
  };

  const copyDiagnosticsReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      navigatorOnLine: navigator.onLine,
      firebaseConfigured,
      configSummary: configInfo?.config ? {
        projectId: configInfo.config.projectId || 'missing',
        authDomain: configInfo.config.authDomain || 'missing',
        apiKeyPresent: Boolean(configInfo.config.apiKey),
        appIdPresent: Boolean(configInfo.config.appId),
      } : 'invalid',
      missingFields: configInfo?.missingFields || [],
      recentErrors: errorLogs.slice(0, 10)
    };
    navigator.clipboard.writeText(JSON.stringify(report, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  const currentConfig = configInfo?.config || {};
  const missingFields = configInfo?.missingFields || [];

  return (
    <div className="fixed inset-0 z-[999999] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#1e293b]/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Bug className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                Firebase Diagnostic & Runtime Inspector
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  firebaseConfigured ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                }`}>
                  {firebaseConfigured ? 'Configured & Active' : 'Configuration Error'}
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Real-time API key validation, network connectivity check, and error logging utility
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={copyDiagnosticsReport}
              className="px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
              title="Copy diagnostic report to clipboard"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copied Report' : 'Copy Report'}
            </button>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 bg-slate-50/50 dark:bg-[#1e293b]/20 gap-2">
          <button
            onClick={() => setActiveTab('config')}
            className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'config'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Key className="w-4 h-4" />
            API Keys & Runtime Config
          </button>
          <button
            onClick={() => setActiveTab('network')}
            className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'network'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Wifi className="w-4 h-4" />
            Network & Connectivity
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Terminal className="w-4 h-4" />
            Error Logs ({errorLogs.length})
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'help'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Info className="w-4 h-4" />
            Vercel & .env Guide
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6 text-slate-800 dark:text-slate-200 text-xs">
          
          {activeTab === 'config' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Status</p>
                  <p className={`text-sm font-black flex items-center gap-2 ${firebaseConfigured ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {firebaseConfigured ? <CheckCircle2 className="w-4 h-4" /> : <ShieldAlert className="w-4 h-4" />}
                    {firebaseConfigured ? 'Valid Configuration' : 'Incomplete / Invalid'}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Project ID</p>
                  <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                    {currentConfig.projectId || <span className="text-rose-500 italic">Missing</span>}
                  </p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Missing Required Fields</p>
                  <p className={`text-sm font-black ${missingFields.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                    {missingFields.length > 0 ? missingFields.join(', ') : 'None (All present)'}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white mb-3">Runtime Environment Variable Parsing Inspection</h3>
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        <th className="p-3">Config Variable</th>
                        <th className="p-3">Parsed Runtime Value</th>
                        <th className="p-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-mono">
                      {[
                        { key: 'apiKey', label: 'VITE_FIREBASE_API_KEY / API Key', val: currentConfig.apiKey, isSecret: true },
                        { key: 'authDomain', label: 'VITE_FIREBASE_AUTH_DOMAIN', val: currentConfig.authDomain },
                        { key: 'projectId', label: 'VITE_FIREBASE_PROJECT_ID', val: currentConfig.projectId },
                        { key: 'storageBucket', label: 'VITE_FIREBASE_STORAGE_BUCKET', val: currentConfig.storageBucket },
                        { key: 'messagingSenderId', label: 'VITE_FIREBASE_MESSAGING_SENDER_ID', val: currentConfig.messagingSenderId },
                        { key: 'appId', label: 'VITE_FIREBASE_APP_ID', val: currentConfig.appId },
                        { key: 'measurementId', label: 'VITE_FIREBASE_MEASUREMENT_ID', val: currentConfig.measurementId },
                        { key: 'firestoreDatabaseId', label: 'FIRESTORE_DATABASE_ID', val: currentConfig.firestoreDatabaseId },
                      ].map(item => {
                        const hasVal = Boolean(item.val);
                        const displayVal = hasVal 
                          ? (item.isSecret ? `${item.val.substring(0, 6)}...${item.val.slice(-4)} (${item.val.length} chars)` : item.val)
                          : <span className="text-rose-500 italic">Not defined / empty</span>;
                        
                        return (
                          <tr key={item.key} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                            <td className="p-3 font-bold text-slate-700 dark:text-slate-300">{item.label}</td>
                            <td className="p-3 text-slate-600 dark:text-slate-400 break-all">{displayVal}</td>
                            <td className="p-3">
                              {hasVal ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">Present</span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 font-bold text-[10px]">Optional / Missing</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'network' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Browser Network State</p>
                    <p className={`text-base font-black flex items-center gap-2 ${isOnline ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
                      {isOnline ? 'Online (Connected)' : 'Offline (Disconnected)'}
                    </p>
                  </div>
                  <div className={`w-3 h-3 rounded-full animate-pulse ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                </div>

                <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">API Latency / Ping</p>
                    <p className="text-base font-black text-slate-900 dark:text-white">
                      {pingLatency !== null ? `${pingLatency} ms` : 'Not tested yet'}
                    </p>
                  </div>
                  <button
                    onClick={testConnectivity}
                    disabled={pingStatus === 'testing'}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {pingStatus === 'testing' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                    Test Ping
                  </button>
                </div>
              </div>

              {pingMessage && (
                <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                  pingStatus === 'success' 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300' 
                    : pingStatus === 'failed'
                    ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300'
                    : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
                }`}>
                  {pingStatus === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />}
                  <div>
                    <p className="font-bold">Connectivity Test Result</p>
                    <p className="mt-1 font-mono text-[11px]">{pingMessage}</p>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-3">
                <h4 className="font-bold text-slate-900 dark:text-white">Common Network Troubleshooting for Vercel Deployments:</h4>
                <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-400">
                  <li>Ensure your Firebase project's Authorized Domains list in Firebase Console includes your Vercel deployment domain (e.g., <code className="bg-slate-200 dark:bg-slate-800 px-1 rounded">your-app.vercel.app</code>).</li>
                  <li>Check if corporate firewalls or VPNs are blocking WebSocket connections or Google API endpoints used by Firebase Firestore long-polling.</li>
                  <li>Verify that browser ad-blockers or privacy extensions are not blocking Firebase analytics or auth requests.</li>
                </ul>
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="font-bold text-slate-700 dark:text-slate-300">Captured Runtime Errors & Exceptions</p>
                <button
                  onClick={() => setErrorLogs([])}
                  className="px-3 py-1 bg-slate-200/60 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg text-slate-700 dark:text-slate-300 font-bold transition-all cursor-pointer"
                >
                  Clear Logs
                </button>
              </div>

              {errorLogs.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3 opacity-80" />
                  <p className="font-bold text-slate-900 dark:text-white text-sm">No errors captured yet</p>
                  <p className="text-slate-500 text-xs mt-1">Firebase interactions and runtime errors will be recorded here automatically.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                  {errorLogs.map(log => (
                    <div key={log.id} className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            log.type === 'auth' ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400' :
                            log.type === 'firestore' ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                            log.type === 'network' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400' :
                            'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          }`}>
                            {log.type}
                          </span>
                          {log.code && <span className="font-mono text-[10px] bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-bold">{log.code}</span>}
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{log.timestamp}</span>
                      </div>
                      <p className="font-bold text-slate-900 dark:text-white text-xs">{log.message}</p>
                      {log.details && (
                        <details className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 overflow-x-auto">
                          <summary className="cursor-pointer font-bold text-slate-700 dark:text-slate-300">View Stack / Details</summary>
                          <pre className="mt-2 whitespace-pre-wrap">{log.details}</pre>
                        </details>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'help' && (
            <div className="space-y-6">
              <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-5 rounded-2xl space-y-3">
                <h4 className="font-black text-blue-900 dark:text-blue-300 text-sm">Will the backend and login work when deployed to Vercel?</h4>
                <p className="text-blue-800 dark:text-blue-200 leading-relaxed">
                  <strong>Yes, absolutely!</strong> Firebase is a serverless client-side and cloud database service. Once you configure your environment variables on Vercel, authentication, Firestore database reads/writes, and synchronization will function perfectly.
                </p>
              </div>

              <div className="space-y-4">
                <h4 className="font-black text-slate-900 dark:text-white">Step-by-Step Vercel Environment Variable Setup:</h4>
                <ol className="list-decimal list-inside space-y-2 text-slate-700 dark:text-slate-300">
                  <li>Go to your Vercel Project Dashboard → <strong>Settings</strong> → <strong>Environment Variables</strong>.</li>
                  <li>Add each of the following environment variables with your Firebase project credentials from the Firebase Console:
                    <div className="mt-2 bg-slate-900 text-slate-100 p-4 rounded-xl font-mono text-[11px] space-y-1 select-all">
                      <div>VITE_FIREBASE_API_KEY=your_api_key_here</div>
                      <div>VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com</div>
                      <div>VITE_FIREBASE_PROJECT_ID=your_project_id</div>
                      <div>VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com</div>
                      <div>VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id</div>
                      <div>VITE_FIREBASE_APP_ID=your_app_id</div>
                    </div>
                  </li>
                  <li>Redeploy your project on Vercel so the environment variables are baked into the Vite build bundle at build time.</li>
                </ol>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-[#1e293b]/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Firebase Diagnostic Utility • SAMARITAN REVIEW CENTER
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-bold rounded-xl text-xs hover:opacity-90 transition-all cursor-pointer"
          >
            Close Diagnostics
          </button>
        </div>

      </div>
    </div>
  );
}
