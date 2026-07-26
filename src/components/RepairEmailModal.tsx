import React, { useState } from 'react';
import { X, Wrench, AlertTriangle, Loader2 } from 'lucide-react';
import { firestoreDb, initFirebaseClient } from '../utils/firebaseClient';
import { collection, getDocs, doc, writeBatch, serverTimestamp } from 'firebase/firestore';

export const RepairEmailModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [results, setResults] = useState<{ total: number; missingLower: any[]; duplicates: any[] } | null>(null);

  const handleScan = async () => {
    setIsScanning(true);
    setResults(null);
    try {
      const { db } = await initFirebaseClient();
      if (!db) { throw new Error("Firestore not initialized"); }
      const snap = await getDocs(collection(db, "users"));
      
      const missingLower: any[] = [];
      const emailMap = new Map<string, any[]>();
      
      snap.forEach(docSnap => {
        const data = docSnap.data();
        const email = String(data.email || "").trim();
        if (email) {
          const lower = email.toLowerCase();
          
          if (!data.email_lower || data.email_lower !== lower) {
            missingLower.push({ id: docSnap.id, email: lower, data });
          }
          
          if (!emailMap.has(lower)) {
            emailMap.set(lower, []);
          }
          emailMap.get(lower)!.push({ id: docSnap.id, data });
        }
      });
      
      const duplicates: any[] = [];
      emailMap.forEach((users, email) => {
        if (users.length > 1) {
          duplicates.push({ email, count: users.length, users });
        }
      });
      
      setResults({ total: snap.size, missingLower, duplicates });
    } catch (e) {
      console.error(e);
      alert("Error scanning.");
    } finally {
      setIsScanning(false);
    }
  };

  const handleFix = async () => {
    if (!results || results.missingLower.length === 0) return;
    setIsFixing(true);
    try {
      const { db } = await initFirebaseClient();
      if (!db) { throw new Error("Firestore not initialized"); }
      let batch = writeBatch(db);
      let count = 0;
      
      for (const item of results.missingLower) {
        batch.update(doc(db, "users", item.id), {
          email_lower: item.email,
          updatedAt: serverTimestamp()
        });
        count++;
        if (count === 500) {
          await batch.commit();
          batch = writeBatch(db);
          count = 0;
        }
      }
      if (count > 0) {
        await batch.commit();
      }
      alert(`Fixed ${results.missingLower.length} records!`);
      setResults(prev => prev ? { ...prev, missingLower: [] } : null);
    } catch (e) {
      console.error(e);
      alert("Error fixing records.");
    } finally {
      setIsFixing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
            <Wrench className="text-teal-600" size={20} /> Repair Email Links
          </h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-900"><X size={20} /></button>
        </div>
        
        {!results && (
          <div className="text-center py-6">
            <p className="text-sm text-slate-600 mb-6">
              Scan the database to ensure all user records have normalized `email_lower` fields, which is required for correct login routing and preventing duplicate Reviewee creation.
            </p>
            <button onClick={handleScan} disabled={isScanning} className="bg-teal-600 text-white font-bold py-2.5 px-6 rounded-xl hover:bg-teal-700 disabled:opacity-50 inline-flex items-center gap-2">
              {isScanning && <Loader2 size={16} className="animate-spin" />}
              Scan Database
            </button>
          </div>
        )}
        
        {results && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Missing email_lower</p>
                <p className="text-2xl font-black text-slate-900">{results.missingLower.length}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="text-[10px] font-black uppercase text-slate-500 mb-1">Duplicate Emails</p>
                <p className="text-2xl font-black text-rose-600">{results.duplicates.length}</p>
              </div>
            </div>
            
            {results.missingLower.length > 0 && (
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <h3 className="text-sm font-bold text-amber-900 mb-2">Fix Missing `email_lower` Fields</h3>
                <p className="text-xs text-amber-800 mb-4">
                  Found {results.missingLower.length} records that need normalization.
                </p>
                <button onClick={handleFix} disabled={isFixing} className="bg-amber-600 text-white text-xs font-bold py-2 px-4 rounded-lg hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-2">
                  {isFixing && <Loader2 size={14} className="animate-spin" />}
                  Run Fix
                </button>
              </div>
            )}
            
            {results.duplicates.length > 0 && (
              <div className="bg-rose-50 p-4 rounded-xl border border-rose-200 space-y-3">
                <h3 className="text-sm font-bold text-rose-900 flex items-center gap-2">
                  <AlertTriangle size={16} /> Duplicate Emails Detected
                </h3>
                <p className="text-xs text-rose-800">
                  These emails belong to multiple accounts. The system will not auto-merge them. Please manually resolve these from the Users Directory by renaming or deleting the duplicate.
                </p>
                <div className="max-h-40 overflow-y-auto space-y-2 bg-white rounded-lg p-2 border border-rose-100">
                  {results.duplicates.map((dup, i) => (
                    <div key={i} className="text-xs p-2 border-b border-rose-100 last:border-0">
                      <p className="font-bold text-slate-900">{dup.email}</p>
                      <p className="text-slate-500 text-[10px]">Used by {dup.count} records</p>
                      <ul className="list-disc pl-4 mt-1 text-[10px] text-slate-600">
                        {dup.users.map((u: any, idx: number) => (
                          <li key={idx}>{u.data.first_name} {u.data.last_name} ({u.data.role || 'Reviewee'})</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <button onClick={() => setResults(null)} className="w-full bg-slate-100 text-slate-700 font-bold py-2.5 rounded-xl hover:bg-slate-200">
              Reset Scan
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
