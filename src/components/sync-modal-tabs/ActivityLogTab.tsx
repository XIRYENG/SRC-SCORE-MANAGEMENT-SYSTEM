import React from 'react';
import { History, Shield, Calendar, User, Sliders } from 'lucide-react';
import { EmptyState } from './EmptyState';

interface ActivityLogTabProps {
  activityLogs: any[];
  loadingLogs: boolean;
  onRefresh?: () => void;
  error?: string | null;
}

export const ActivityLogTab: React.FC<ActivityLogTabProps> = ({ activityLogs, loadingLogs, onRefresh, error }) => {
  return (
    <div className="bg-[#0B1220] rounded-[2rem] border border-white/10 overflow-hidden flex flex-col h-[calc(100vh-14rem)] shadow-2xl">
      <div className="overflow-x-auto flex-1 p-4 custom-scrollbar">
        {loadingLogs ? (
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider font-semibold">
                <th className="p-3 font-bold">Timestamp</th>
                <th className="p-3 font-bold">Performer</th>
                <th className="p-3 font-bold">Role</th>
                <th className="p-3 font-bold">Operation</th>
                <th className="p-3 font-bold text-center">Records Processed</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                  <td className="p-3">
                    <div className="animate-pulse bg-white/10 h-4 w-28 rounded-lg" />
                  </td>
                  <td className="p-3">
                    <div className="animate-pulse bg-white/10 h-4 w-32 rounded-lg" />
                  </td>
                  <td className="p-3">
                    <div className="animate-pulse bg-white/10 h-4 w-12 rounded-full" />
                  </td>
                  <td className="p-3">
                    <div className="animate-pulse bg-white/10 h-4 w-48 rounded-lg" />
                  </td>
                  <td className="p-3 text-center">
                    <div className="animate-pulse bg-white/10 h-4 w-8 mx-auto rounded-lg" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : activityLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full min-h-[300px]">
            <EmptyState 
              icon={History}
              title={error ? "Logs unavailable" : "No logs found"}
              description={error ? `Unable to fetch administrative logs: ${error}. Please check database permissions.` : "All administrative transactions are recorded here in real-time. Try refreshing if you expect data."}
              onRefresh={onRefresh}
              loading={loadingLogs}
            />
          </div>
        ) : (
          <table className="w-full text-left text-xs whitespace-nowrap border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 uppercase tracking-widest font-black text-[10px]">
                <th className="p-3 font-extrabold flex items-center gap-1"><Calendar size={12} className="text-[#0EA5E9]" /> Timestamp</th>
                <th className="p-3 font-extrabold"><div className="flex items-center gap-1"><User size={12} className="text-[#00B8A9]" /> Performer</div></th>
                <th className="p-3 font-extrabold"><div className="flex items-center gap-1"><Shield size={12} className="text-[#0057FF]" /> Role</div></th>
                <th className="p-3 font-extrabold"><div className="flex items-center gap-1"><Sliders size={12} className="text-orange-400" /> Operation</div></th>
                <th className="p-3 font-extrabold text-center">Records</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activityLogs.map((log, i) => {
                const isAdminRole = String(log.admin_role || '').toLowerCase() === 'admin';
                const isStaffRole = String(log.admin_role || '').toLowerCase() === 'staff';
                
                return (
                  <tr key={i} className="hover:bg-white/[0.03] transition-colors border-b border-white/5 last:border-0">
                    <td className="p-3 font-medium text-slate-300 font-mono text-[11px]">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3 font-black text-white text-[11px] max-w-[150px] truncate">
                      {log.admin_name}
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        isAdminRole 
                          ? 'bg-[#0057FF]/20 text-[#38BDF8] border border-[#0057FF]/30' 
                          : isStaffRole 
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}>
                        {log.admin_role || 'System'}
                      </span>
                    </td>
                    <td className="p-3 font-bold text-slate-200 text-[11px] whitespace-normal break-words max-w-sm">
                      {log.operation}
                    </td>
                    <td className="p-3 font-black text-[#00B8A9] text-[11px] text-center">
                      {log.records_processed}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
