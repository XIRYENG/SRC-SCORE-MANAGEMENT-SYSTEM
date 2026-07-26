import * as fs from 'fs';

let code = fs.readFileSync('src/components/SyncModal.tsx', 'utf8');

code = code.replace(
  `                <div className="flex flex-col gap-3">\n                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">`,
  `                {activeTab !== 'analysis' && activeTab !== 'activity' && (\n                <div className="flex flex-col gap-3">\n                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">`
);

code = code.replace(
  `                              </motion.div>\n                            </>\n                          )}\n                        </AnimatePresence>\n                      </div>\n                      <button\n                        onClick={handleExportCSV}\n                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"\n                      >\n                        <FileText size={12} />\n                        CSV\n                      </button>\n                      <button\n                        onClick={handleExportPDF}\n                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"\n                      >\n                        <Download size={12} />\n                        PDF\n                      </button>`,
  `                              </motion.div>\n                            </>\n                          )}\n                        </AnimatePresence>\n                      </div>\n                      <button\n                        onClick={handleExportCSV}\n                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"\n                      >\n                        <FileText size={12} />\n                        CSV\n                      </button>\n                      <button\n                        onClick={handleExportPDF}\n                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"\n                      >\n                        <Download size={12} />\n                        PDF\n                      </button>`
);

code = code.replace(
  `                                </AnimatePresence>\n                              </motion.div>\n                            )}\n                          </div>\n                        </>\n                      )}\n                      <button\n                        onClick={() => window.print()}\n                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"\n                      >\n                        <Printer size={12} />\n                        Print List\n                      </button>\n                    </div>\n                  </div>\n                  <div className="flex gap-2">`,
  `                                </AnimatePresence>\n                              </motion.div>\n                            )}\n                          </div>\n                        </>\n                      )}\n                      <button\n                        onClick={() => window.print()}\n                        className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors uppercase tracking-wider shadow-sm print-hidden"\n                      >\n                        <Printer size={12} />\n                        Print List\n                      </button>\n                    </div>\n                  </div>\n                  <div className="flex gap-2">`
);

code = code.replace(
  `                      <Loader2 className="w-8 h-8 animate-spin" />\n                      <span className="text-xs font-bold uppercase">Loading Accounts...</span>\n                    </div>\n\n                  ) : activeTab === 'activity' ? (`,
  `                      <Loader2 className="w-8 h-8 animate-spin" />\n                      <span className="text-xs font-bold uppercase">Loading Accounts...</span>\n                    </div>\n\n                  ) : activeTab === 'activity' ? (`
);

code = code.replace(
  `                    <button onClick={fetchAllUsers} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-sm" disabled={loadingUsers}>\n                      <RefreshCw size={16} className={loadingUsers ? 'animate-spin' : ''} />\n                    </button>\n                  </div>\n                </div>`,
  `                    <button onClick={fetchAllUsers} className="px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors shadow-sm" disabled={loadingUsers}>\n                      <RefreshCw size={16} className={loadingUsers ? 'animate-spin' : ''} />\n                    </button>\n                  </div>\n                </div>\n                )}`
);

fs.writeFileSync('src/components/SyncModal.tsx', code);
