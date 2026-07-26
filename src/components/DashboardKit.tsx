import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";

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

export function StatCard({
  label,
  value,
  icon,
  tone = "teal",
  loading,
  subtitle,
  onClick,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: Tone;
  loading?: boolean;
  subtitle?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-600">{label}</p>
          <h3 className="mt-2 text-3xl font-black text-slate-900">
            {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : value}
          </h3>
          <p className="mt-1 text-xs font-semibold text-emerald-600">
            {subtitle || "+2.31% vs last month"}
          </p>
        </div>

        <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${toneClasses[tone]}`}>
          {icon}
        </div>
      </div>
    </button>
  );
}

export type ActivityItem = {
  id: string;
  icon: React.ReactNode;
  title: string;
  meta: string;
  tag?: string;
  tone?: Tone;
};

export function ActivityFeed({
  items,
  loading,
  emptyLabel = "No activity yet.",
}: {
  items: ActivityItem[];
  loading?: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-slate-400">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-xs font-semibold text-slate-400">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div key={item.id} className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${toneClasses[item.tone || "teal"]}`}>
            {item.icon}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-slate-900">
              {item.title}
            </p>
            <p className="truncate text-xs font-semibold text-slate-500">
              {item.meta}
            </p>
          </div>

          {item.tag && (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
              {item.tag}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export function QuickActionsGrid({
  actions,
}: {
  actions: {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
  }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {actions.map((action) => (
        <button
          key={action.key}
          onClick={action.onClick}
          className="rounded-[1.5rem] border border-slate-200 bg-white p-4 text-center shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
        >
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-50 text-[#007C89]">
            {action.icon}
          </div>
          <p className="mt-3 text-xs font-black text-slate-800">
            {action.label}
          </p>
        </button>
      ))}
    </div>
  );
}

export function SimpleTable({
  rows,
  columns,
  loading,
  emptyLabel,
  compact = false,
}: {
  rows: any[];
  columns: {
    key: string;
    header: string;
    render: (row: any) => React.ReactNode;
  }[];
  loading?: boolean;
  emptyLabel?: string;
  compact?: boolean;
}) {
  if (loading) {
    return (
      <div className={`flex items-center justify-center text-slate-400 ${compact ? 'h-20' : 'h-32'}`}>
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className={`flex items-center justify-center text-xs font-semibold text-slate-400 ${compact ? 'h-20' : 'h-32'}`}>
        {emptyLabel || "No records found."}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left">
        <thead>
          <tr className="border-b border-slate-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 ${compact ? 'py-2' : 'py-3'} text-[10px] font-black uppercase tracking-widest text-slate-400`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index} className="border-b border-slate-100 last:border-0">
              {columns.map((col) => (
                <td key={col.key} className={`px-3 ${compact ? 'py-2' : 'py-3'} text-sm`}>
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SectionHeader({
  title,
  onViewAll,
}: {
  title: string;
  onViewAll?: () => void;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-base font-black text-slate-900">{title}</h3>
      {onViewAll && (
        <button
          onClick={onViewAll}
          className="flex items-center gap-1 text-xs font-black text-[#007C89]"
        >
          View All <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
