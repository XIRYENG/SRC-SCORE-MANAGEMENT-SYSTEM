import React from 'react';

export type Metric = {
  label: string;
  value: string;
};

export function ScoreSummaryMetrics({ metrics }: { metrics: Metric[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {metrics.map((metric, i) => (
        <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">{metric.label}</p>
          <p className="text-lg font-black text-slate-900 mt-1">{metric.value}</p>
        </div>
      ))}
    </div>
  );
}
