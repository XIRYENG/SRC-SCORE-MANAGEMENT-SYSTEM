import React from 'react';
import { Loader2 } from 'lucide-react';

export type Tone = "blue" | "emerald" | "sky" | "amber" | "purple" | "teal" | "rose";

const toneClasses: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-600",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
  amber: "bg-amber-50 text-amber-600",
  purple: "bg-purple-50 text-purple-600",
  teal: "bg-teal-50 text-teal-600",
  rose: "bg-rose-50 text-rose-600",
};

interface AdminSummaryCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  subtitle?: string;
  onClick?: () => void;
}

export function AdminSummaryCard({
  label,
  value,
  icon,
  tone = "teal",
  loading,
  subtitle,
  onClick,
}: AdminSummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            {label}
          </p>
          <h3 className="mt-2 text-3xl font-black text-slate-900 tracking-tight">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : value}
          </h3>
          {subtitle && (
            <p className="mt-1 text-[11px] font-semibold text-emerald-600">
              {subtitle}
            </p>
          )}
        </div>

        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${toneClasses[tone]} transition-colors group-hover:opacity-90`}>
          {icon}
        </div>
      </div>
    </button>
  );
}
