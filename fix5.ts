import * as fs from 'fs';

let code = fs.readFileSync('src/components/SyncModal.tsx', 'utf8');

// 1. Add tab button
const activityTabButton = `
                      <button 
                        onClick={() => setActiveTab('activity')}
                        className={\`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors \${activeTab === 'activity' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}\`}
                      >
                        Activity Log
                      </button>
                    </div>`;

code = code.replace(
  `                      </button>\n                    </div>`,
  `                      </button>\n` + activityTabButton
);

// 2. Add tab content
const activityTabContent = `
                  ) : activeTab === 'activity' ? (
                    <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-14rem)]">
                      <div className="overflow-auto flex-1 p-2">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          {loadingLogs ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium">Loading logs...</td></tr>
                          ) : activityLogs.length === 0 ? (
                            <tr><td colSpan={5} className="p-12 text-center text-slate-400 font-medium">No activity logs found.</td></tr>
                          ) : (
                            <>
                              <thead>
                                <tr className="border-b border-slate-200">
                                  <th className="p-2 font-bold text-slate-500 uppercase text-xs">Timestamp</th>
                                  <th className="p-2 font-bold text-slate-500 uppercase text-xs">Co-Admin</th>
                                  <th className="p-2 font-bold text-slate-500 uppercase text-xs">Role</th>
                                  <th className="p-2 font-bold text-slate-500 uppercase text-xs">Operation</th>
                                  <th className="p-2 font-bold text-slate-500 uppercase text-xs">Records Processed</th>
                                </tr>
                              </thead>
                              <tbody>
                                {activityLogs.map((log, i) => (
                                  <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
                                    <td className="p-2 font-medium text-slate-700 text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                                    <td className="p-2 font-bold text-slate-900 text-xs">{log.admin_name}</td>
                                    <td className="p-2">
                                      <span className={\`inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider \${log.admin_role === 'admin' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'}\`}>
                                        {log.admin_role || 'System'}
                                      </span>
                                    </td>
                                    <td className="p-2 font-medium text-slate-600 text-xs">{log.operation}</td>
                                    <td className="p-2 font-bold text-slate-700 text-xs text-center">{log.records_processed}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </>
                          )}
                        </table>
                      </div>
                    </div>
                  ) : activeTab === 'analysis' ? (
`;

code = code.replace(
  `                  ) : activeTab === 'analysis' ? (`,
  activityTabContent
);

fs.writeFileSync('src/components/SyncModal.tsx', code);
