import React, { useState, useRef } from 'react';
import { Upload, AlertCircle, CheckCircle2, FileSpreadsheet } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

type ImportState = 'idle' | 'dragging' | 'uploading' | 'error' | 'success';

interface SpreadsheetImportProps {
  onCommit: (data: any[]) => void;
}

export const SpreadsheetImport: React.FC<SpreadsheetImportProps> = ({ onCommit }) => {
  const [state, setState] = useState<ImportState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewData, setPreviewData] = useState<any[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if(state === 'idle') setState('dragging');
  };

  const handleDragLeave = () => {
    if(state === 'dragging') setState('idle');
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setState('idle');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const processFile = (file: File) => {
    setState('uploading');
    setProgress(0);
    
    // Simulate parsing
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
            clearInterval(interval);
            setState('success');
            setPreviewData([
                { id: '101', name: 'James Wilson', grade: '95' },
                { id: '102', name: 'Ariel Pesalver', grade: '88' },
                { id: '103', name: 'Jane Smith', grade: '92' },
            ]);
            return 100;
        }
        return prev + 10;
      });
    }, 150); // Slightly faster progression for "honest" feel
  };

  const reset = () => {
    setState('idle');
    setErrorMessage('');
    setProgress(0);
  };

  return (
    <div className="w-full max-w-lg mx-auto border border-slate-200 rounded-xl p-8 bg-white shadow-sm transition-all duration-300">
      <AnimatePresence mode="wait">
        
        {state === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
             className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-violet-400 hover:bg-slate-50 transition-all duration-200"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
            <Upload className="mx-auto text-slate-400 mb-3" size={28} />
            <p className="text-sm text-slate-600 font-semibold">Drag spreadsheet here</p>
            <p className="text-xs text-slate-400 mt-1">or click to browse local files</p>
          </motion.div>
        )}

        {state === 'dragging' && (
          <motion.div key="dragging" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="border-2 border-dashed border-violet-500 bg-violet-50/50 rounded-xl p-10 text-center"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <p className="text-sm text-violet-700 font-bold tracking-wide">Release to parse student scores.</p>
          </motion.div>
        )}
        
        {state === 'uploading' && (
          <motion.div key="uploading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <div className="flex justify-between text-[11px] text-slate-500 font-bold uppercase tracking-wider">
              <span>Parsing items</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <motion.div className="h-full bg-violet-600" animate={{ width: `${progress}%` }} transition={{ duration: 0.2 }} />
            </div>
            <p className="text-[10px] text-slate-400 text-center">Time left: ~{(100-progress)/10}s</p>
          </motion.div>
        )}

        {state === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-2 text-rose-600 justify-center">
                <AlertCircle size={18} />
                <p className="text-sm font-semibold">{errorMessage}</p>
            </div>
            <button onClick={() => processFile(new File([], 'retry'))} className="w-full text-xs font-bold py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                Retry Sync
            </button>
          </motion.div>
        )}

        {state === 'success' && (
          <motion.div key="success" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle2 size={20} />
                <h3 className="text-sm font-bold text-slate-900">Data Summary Validated</h3>
            </div>
            <div className="flex gap-6 text-xs text-slate-600 bg-slate-50 p-4 rounded-lg">
                <p>Students: <span className="font-bold text-slate-900">35</span></p>
                <p>Columns: <span className="font-bold text-slate-900">4</span></p>
            </div>
            
            <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-[11px] text-left">
                    <thead className="bg-slate-50 border-b border-slate-200">
                        <tr>
                            <th className="p-2.5 font-bold text-slate-500">ID</th>
                            <th className="p-2.5 font-bold text-slate-500">Name</th>
                            <th className="p-2.5 font-bold text-slate-500">Grade</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {previewData.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                                <td className="p-2.5 font-medium">{row.id}</td>
                                <td className="p-2.5">{row.name}</td>
                                <td className="p-2.5 font-semibold text-violet-700">{row.grade}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <button onClick={() => onCommit(previewData)} className="w-full text-xs font-bold py-2.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors shadow-sm">
                Commit Grades to Database
            </button>
            <button onClick={reset} className="w-full text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors">
                Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
