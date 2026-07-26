import React from 'react';
import { RefreshCw, LucideIcon } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onRefresh?: () => void;
  loading?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon: Icon, 
  title, 
  description, 
  onRefresh,
  loading = false
}) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-slate-500 mb-4 ring-1 ring-white/10">
        <Icon size={32} />
      </div>
      <h3 className="text-lg font-bold text-slate-200 mb-1 uppercase tracking-tight">{title}</h3>
      <p className="text-sm text-slate-500 max-w-xs mb-8 leading-relaxed">
        {description}
      </p>
      
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white font-bold text-xs uppercase tracking-widest transition-all border border-white/10 active:scale-95 disabled:opacity-50 disabled:active:scale-100"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      )}
    </motion.div>
  );
};
