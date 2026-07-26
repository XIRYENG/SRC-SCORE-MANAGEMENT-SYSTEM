import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, X, AlertCircle, Info, AlertTriangle } from 'lucide-react';

interface ToastProps {
  message: string;
  onClose: () => void;
  duration?: number;
  type?: 'success' | 'error' | 'warning' | 'info';
}

export const Toast: React.FC<ToastProps> = ({ message, onClose, duration = 3000, type = 'success' }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const styles = {
    success: {
      bg: 'bg-white border-emerald-200 text-slate-800 shadow-xl',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
      title: 'Success'
    },
    error: {
      bg: 'bg-white border-rose-200 text-slate-800 shadow-xl',
      icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
      title: 'Error'
    },
    warning: {
      bg: 'bg-white border-amber-200 text-slate-800 shadow-xl',
      icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
      title: 'Warning'
    },
    info: {
      bg: 'bg-white border-sky-200 text-slate-800 shadow-xl',
      icon: <Info className="w-5 h-5 text-sky-500 shrink-0" />,
      title: 'Information'
    }
  };

  const currentStyle = styles[type] || styles.success;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100, scale: 0.9 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, x: 50 }}
        className={`fixed top-16 right-3 lg:top-6 lg:right-6 z-[9999] flex items-center justify-between gap-3 p-4 rounded-[1.5rem] border backdrop-blur-md shadow-2xl w-[min(92vw,420px)] lg:w-[420px] ${currentStyle.bg}`}
      >
        <div className="flex items-center gap-3">
          {currentStyle.icon}
          <div>
            <p className="text-[10px] uppercase font-black tracking-widest text-slate-400 opacity-80">{currentStyle.title}</p>
            <p className="text-xs font-bold text-slate-800">{message}</p>
          </div>
        </div>
        <button 
          onClick={onClose} 
          className="p-1 hover:bg-slate-100 rounded-full transition-colors shrink-0 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

