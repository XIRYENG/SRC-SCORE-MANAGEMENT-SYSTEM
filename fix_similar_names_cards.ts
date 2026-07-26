import fs from 'fs';
let content = fs.readFileSync('src/components/SyncModal.tsx', 'utf8');

const targetRegex = /<div className="divide-y divide-amber-100 bg-white">([\s\S]*?)<\/div>/g;

let matchCount = 0;
content = content.replace(targetRegex, (match) => {
    matchCount++;
    if (matchCount === 1) { // 1st match is similarNames
        return `<div className="p-3 bg-white flex flex-col sm:flex-row gap-3 overflow-x-auto">
                                  {group.map((r: any, i: number) => (
                                    <label key={i} className={\`flex-1 border rounded-lg p-3 flex flex-col gap-2 cursor-pointer transition-colors relative min-w-[200px] \${selectionsToKeep[\`name_\${idx}\`]?.includes(r.doc_id) ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-300' : 'border-slate-200 hover:border-amber-200'}\`}>
                                      <div className="absolute top-3 right-3">
                                        <input
                                          type="checkbox"
                                          name={\`keep_name_\${idx}\`}
                                          checked={selectionsToKeep[\`name_\${idx}\`]?.includes(r.doc_id)}
                                          onChange={() => {
                                            setSelectionsToKeep(prev => {
                                              const current = prev[\`name_\${idx}\`] || [];
                                              const updated = current.includes(r.doc_id)
                                                ? current.filter(id => id !== r.doc_id)
                                                : [...current, r.doc_id];
                                              return { ...prev, [\`name_\${idx}\`]: updated };
                                            });
                                            setConfirmResolve(false);
                                          }}
                                          className="w-4 h-4 text-amber-600 focus:ring-amber-500 rounded border-slate-300"
                                        />
                                      </div>
                                      <div className="pt-1 pr-8">
                                        <div className="font-bold text-slate-800 text-xs text-left capitalize leading-tight">{(r.last_name || r['Last Name'] || '').toLowerCase()}, {(r.first_name || r['First Name'] || '').toLowerCase()}</div>
                                        <div className="text-[10px] text-slate-400 font-normal text-left mt-0.5">ID: {r.seq_id || r['ID Number'] || 'N/A'}</div>
                                        <div className="text-[9px] font-medium text-slate-500 mt-2 text-left bg-slate-50 p-1.5 rounded border border-slate-100">{r.school_name || r['School'] || 'Unknown School'}</div>
                                        <div className="text-[9px] text-slate-400 mt-1.5 text-left flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(r.created_at).toLocaleString()}</div>
                                      </div>
                                    </label>
                                  ))}
                                </div>`;
    } else {
       return match; // duplicateIds uses divide-y divide-amber-100 bg-white too maybe?
    }
});

fs.writeFileSync('src/components/SyncModal.tsx', content);
console.log('Replaced similarly named mapping layout to cards');
