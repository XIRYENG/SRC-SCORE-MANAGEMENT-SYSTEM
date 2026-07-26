import re

with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

# We'll replace the entire map function body to be sure
pattern = r'\{filteredAndSortedUsers\.map\(\(u, i\) => \{.*?\}\)\}'

new_map = """{filteredAndSortedUsers.map((u, i) => {
                           const idStr = String(u.doc_id || u.seq_id);
                           const isExcluded = excludedUserIds.has(idStr);
                           
                           if (editingUserId === u.doc_id) {
                             return (
                               <tr key={i} className="bg-slate-50 border-y-2 border-slate-300 divide-x divide-slate-200">
                                 <td className="p-2 sm:p-3 text-center">
                                   {/* Disabled / Empty during edit */}
                                 </td>
                                 <td className="p-2 sm:p-3 font-sans text-xs font-bold text-slate-500 whitespace-nowrap">
                                   <input 
                                      type="text"
                                      value={editSeqId}
                                      onChange={e => setEditSeqId(e.target.value)}
                                      className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                                   />
                                   <div className="text-[8px] text-blue-600 font-bold uppercase mt-1 leading-none bg-blue-50 rounded px-1 py-0.5 inline-block text-center w-full">EDITING</div>
                                 </td>
                                 <td colSpan={2} className="p-2 sm:p-3 space-y-2.5 bg-slate-50/60">
                                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Last Name</label>
                                       <input 
                                         type="text" 
                                         value={editLastName} 
                                         onChange={e => setEditLastName(e.target.value)} 
                                         className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">First Name</label>
                                       <input 
                                         type="text" 
                                         value={editFirstName} 
                                         onChange={e => setEditFirstName(e.target.value)} 
                                         className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Middle Name</label>
                                       <input 
                                         type="text" 
                                         value={editMiddleName} 
                                         onChange={e => setEditMiddleName(e.target.value)} 
                                         className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                   </div>
                                   <div>
                                     <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">School Name</label>
                                     <input 
                                       type="text" 
                                       value={editSchoolName} 
                                       onChange={e => setEditSchoolName(e.target.value)} 
                                       className="w-full p-1.5 border border-slate-300 rounded text-[11px] uppercase font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                     />
                                   </div>
                                   <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Criminal Law and Jurisprudence">CLJ</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCLJ} 
                                         onChange={e => setEditScoreCLJ(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Law Enforcement and Administration">LEA</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreLEA} 
                                         onChange={e => setEditScoreLEA(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Forensic Science">FS</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreFS} 
                                         onChange={e => setEditScoreFS(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Crime Detection and Investigation">CDI</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCDI} 
                                         onChange={e => setEditScoreCDI(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Criminology">CRIM</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCRIM} 
                                         onChange={e => setEditScoreCRIM(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                     <div>
                                       <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5" title="Correctional Administration">CA</label>
                                       <input 
                                         type="number" min="0" max="100"
                                         value={editScoreCA} 
                                         onChange={e => setEditScoreCA(e.target.value)} 
                                         className="w-full p-1 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white" 
                                       />
                                     </div>
                                   </div>
                                   <div className="mt-2 text-left w-full">
                                     <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wide block mb-0.5">Role / Admin Status (Who can see/use sync settings)</label>
                                     <select
                                       value={editRole}
                                       onChange={(e) => setEditRole(e.target.value)}
                                       className="w-full sm:w-[200px] p-1.5 border border-slate-300 rounded text-[11px] font-bold outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                                     >
                                       <option value="">Student (Default)</option>
                                       <option value="co_admin">Co-Admin</option>
                                       <option value="admin">Admin</option>
                                     </select>
                                   </div>
                                 </td>
                                 <td className="p-2 sm:p-3 text-center">
                                   <span className="text-[8px] text-slate-400 font-bold uppercase block mb-1 leading-none">Resets To:</span>
                                   <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Clock size={10} /> PENDING
                                   </span>
                                 </td>
                                 <td className="p-2 sm:p-3 text-right">
                                   <div className="flex flex-col gap-1.5 justify-end">
                                     <button 
                                       type="button"
                                       onClick={() => handleUpdateUserDetails(u)} 
                                       disabled={updatingUser}
                                       className="w-full px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded shadow-sm text-[9px] uppercase tracking-wider whitespace-nowrap text-center disabled:opacity-50 cursor-pointer"
                                     >
                                       {updatingUser ? 'SAVING...' : 'SAVE'}
                                     </button>
                                     <button 
                                       type="button"
                                       onClick={() => setEditingUserId(null)} 
                                       disabled={updatingUser}
                                       className="w-full px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded shadow-sm text-[9px] uppercase tracking-wider whitespace-nowrap text-center disabled:opacity-50 cursor-pointer"
                                     >
                                       CANCEL
                                     </button>
                                   </div>
                                 </td>
                               </tr>
                             );
                           }

                             if (activeTab === 'scores') {
                               return (
                                 <tr key={i} className={`hover:bg-slate-50 transition-colors divide-x divide-slate-200 ${isExcluded ? 'opacity-40 bg-slate-50' : ''}`}>
                                   <td className="p-1 sm:px-2 sm:py-1.5 text-center w-[1%] whitespace-nowrap">
                                     <input 
                                       type="checkbox" 
                                       className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                       checked={!isExcluded}
                                       onChange={(e) => {
                                         handleToggleExclusionSingle(idStr, !e.target.checked);
                                       }} 
                                     />
                                   </td>
                                   <td className="p-1 font-sans text-[9px] font-bold text-slate-700 whitespace-nowrap w-16">{u.seq_id}</td>
                                   <td className="p-1 font-bold text-slate-900 uppercase text-[9px] leading-tight break-words max-w-[120px] pl-2">
                                     {u.last_name}, {u.first_name} {u.middle_name ? `${u.middle_name}` : ''}
                                   </td>
                                   <td className="p-1 sm:p-2 text-center text-slate-700">
                                     {renderScoreCell(u, 'clj', 0.20)}
                                   </td>
                                   <td className="p-1 sm:p-2 text-center text-slate-700">
                                     {renderScoreCell(u, 'lea', 0.15)}
                                   </td>
                                   <td className="p-1 sm:p-2 text-center text-slate-700">
                                     {renderScoreCell(u, 'cdi', 0.20)}
                                   </td>
                                   <td className="p-1 sm:p-2 text-center text-slate-700">
                                     {renderScoreCell(u, 'fs', 0.15)}
                                   </td>
                                   <td className="p-1 sm:p-2 text-center text-slate-700">
                                     {renderScoreCell(u, 'crim', 0.20)}
                                   </td>
                                   <td className="p-1 sm:p-2 text-center text-slate-700">
                                     {renderScoreCell(u, 'ca', 0.10)}
                                   </td>
                                   <td className="p-1 sm:px-2 sm:py-1.5 text-center font-black text-blue-600">
                                     {(() => {
                                       const clj = Number(getSubjectDetails(u, 'clj').score || 0) * 0.20;
                                       const lea = Number(getSubjectDetails(u, 'lea').score || 0) * 0.15;
                                       const cdi = Number(getSubjectDetails(u, 'cdi').score || 0) * 0.20;
                                       const fs = Number(getSubjectDetails(u, 'fs').score || 0) * 0.15;
                                       const crim = Number(getSubjectDetails(u, 'crim').score || 0) * 0.20;
                                       const ca = Number(getSubjectDetails(u, 'ca').score || 0) * 0.10;
                                       const total = clj + lea + cdi + fs + crim + ca;
                                       return total > 0 ? `${total.toFixed(2)}%` : '-';
                                     })()}
                                   </td>
                                   <td className="p-1 sm:px-2 sm:py-1.5 text-right w-[5%] overflow-visible">
                                     <div className="flex flex-row gap-1 justify-end items-center h-full ml-auto">
                                       <button
                                         onClick={() => {
                                           setEditingUserId(u.doc_id);
                                           setEditFirstName(u.first_name || '');
                                           setEditMiddleName(u.middle_name || '');
                                           setEditLastName(u.last_name || '');
                                           setEditSchoolName(u.school_name || '');
                                           setEditSeqId(u.seq_id || '');
                                           setEditScoreCLJ(u.score_clj || '');
                                           setEditScoreLEA(u.score_lea || '');
                                           setEditScoreFS(u.score_fs || '');
                                           setEditScoreCDI(u.score_cdi || '');
                                           setEditScoreCRIM(u.score_crim || '');
                                           setEditScoreCA(u.score_ca || '');
                                           setEditRole(u.role || '');
                                         }}
                                         className="p-1 px-1.5 font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-[9px] uppercase tracking-wider flex items-center gap-1 border border-slate-200 shadow-sm cursor-pointer whitespace-nowrap"
                                         title="Edit scores"
                                       >
                                         <Edit size={10} /> EDIT
                                       </button>
                                       <button 
                                          onClick={() => u.is_archived ? handleToggleArchiveUser(u) : handleSyncSingleUser(u)} 
                                          disabled={syncingUserId === u.doc_id}
                                          className={`p-1 px-1.5 font-bold outline-none rounded shadow-sm transition-colors text-[9px] uppercase tracking-wider whitespace-nowrap cursor-pointer flex items-center gap-1
                                            ${u.is_archived 
                                              ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200' 
                                              : syncingUserId === u.doc_id 
                                                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                                : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'}`}
                                        >
                                          {syncingUserId === u.doc_id && <Loader2 size={10} className="animate-spin" />}
                                          {u.is_archived ? 'UNARCHIVE' : syncingUserId === u.doc_id ? 'SYNCING' : 'SYNC'}
                                        </button>
                                     </div>
                                   </td>
                                 </tr>
                               );
                             }

                            return (
                            <tr key={i} className={`hover:bg-slate-50 transition-colors divide-x divide-slate-200 ${isExcluded ? 'opacity-40 bg-slate-50' : ''}`}>
                              <td className="p-1 sm:p-2 text-center w-[1%] whitespace-nowrap">
                                <input 
                                  type="checkbox" 
                                  className="w-3 h-3 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                  checked={!isExcluded}
                                  onChange={(e) => {
                                    handleToggleExclusionSingle(idStr, !e.target.checked);
                                  }} 
                                />
                              </td>
                              <td className="p-1 sm:px-2 sm:py-1.5 font-sans text-xs font-bold text-slate-700 whitespace-nowrap w-[1%]">{u.seq_id}</td>
                              <td className="p-1 sm:px-2 sm:py-1.5 font-bold text-slate-900 uppercase text-xs leading-tight break-words max-w-[150px] sm:max-w-[200px]">
                                {u.last_name}, {u.first_name} {u.middle_name ? `${u.middle_name}` : ''}
                                {(u.role === 'admin' || u.role === 'co_admin') && (
                                  <div className="font-bold text-emerald-600 mt-1 text-[9px] uppercase tracking-wider">{u.role === 'admin' ? "ADMIN" : "CO-ADMIN"}</div>
                                )}
                                <div className="font-normal text-slate-400 mt-1 sm:hidden leading-tight break-words">{u.school_name}</div>
                              </td>
                              <td className="p-1 sm:px-2 sm:py-1.5 text-[9px] text-slate-500 uppercase leading-tight break-words hidden sm:table-cell">
                                {u.school_name}
                              </td>
                              <td className="p-1 sm:px-2 sm:py-1.5 text-center">
                                {syncingUserId === u.doc_id ? (
                                   <span className="inline-flex items-center justify-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Loader2 size={10} className="animate-spin" /> SYNCING...
                                   </span>
                                ) : u.is_synced ? (
                                   <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-green-50 text-green-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Check size={10} /> SYNCED
                                   </span>
                                ) : (
                                   <span className="inline-flex items-center justify-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[9px] font-bold uppercase tracking-wider">
                                     <Clock size={10} /> PENDING
                                   </span>
                                )}
                              </td>
                              <td className="p-1 sm:px-2 sm:py-1.5 text-right">
                                <div className="flex flex-row gap-1 justify-end items-center w-auto h-full ml-auto">
                                  <button
                                    onClick={() => {
                                      setEditingUserId(u.doc_id);
                                      setEditFirstName(u.first_name || '');
                                      setEditMiddleName(u.middle_name || '');
                                      setEditLastName(u.last_name || '');
                                      setEditSchoolName(u.school_name || '');
                                      setEditSeqId(u.seq_id || '');
                                      setEditScoreCLJ(u.score_clj || '');
                                      setEditScoreLEA(u.score_lea || '');
                                      setEditScoreFS(u.score_fs || '');
                                      setEditScoreCDI(u.score_cdi || '');
                                      setEditScoreCRIM(u.score_crim || '');
                                      setEditScoreCA(u.score_ca || '');
                                      setEditRole(u.role || '');
                                    }}
                                    className="p-1 px-1.5 font-bold rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors text-[9px] uppercase tracking-wider flex items-center justify-center gap-1 border border-slate-200 shadow-sm cursor-pointer text-center whitespace-nowrap"
                                    title="Edit details"
                                  >
                                    <Edit size={10} /> EDIT
                                  </button>
                                  <button 
                                    onClick={() => u.is_archived ? handleToggleArchiveUser(u) : handleSyncSingleUser(u)} 
                                    disabled={syncingUserId === u.doc_id}
                                    className={`p-1 px-1.5 font-bold outline-none rounded shadow-sm transition-colors text-[9px] uppercase tracking-wider whitespace-nowrap cursor-pointer flex items-center gap-1
                                      ${u.is_archived 
                                        ? 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200' 
                                        : syncingUserId === u.doc_id 
                                          ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                                          : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'}`}
                                  >
                                    {syncingUserId === u.doc_id && <Loader2 size={10} className="animate-spin" />}
                                    {u.is_archived ? 'UNARCHIVE' : syncingUserId === u.doc_id ? 'SYNCING' : 'SYNC'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                            );
                        })}"""

content = re.sub(pattern, new_map, content, flags=re.DOTALL)

with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
