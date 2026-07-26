import React from 'react';

export const SummaryCard = ({ title, value, subtitle, icon }: { title: string; value: string; subtitle: string; icon: React.ReactNode; }) => (
  <div className="rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-4 shadow-lg">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold text-slate-300">{title}</p>
        <h3 className="mt-2 text-2xl font-black text-white">{value}</h3>
        <p className="mt-1 text-xs text-slate-400">{subtitle}</p>
      </div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-[#0EA5E9]">
        {icon}
      </div>
    </div>
  </div>
);
