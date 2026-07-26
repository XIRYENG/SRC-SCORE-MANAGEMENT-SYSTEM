import React from 'react';
import { Award, Calendar, CheckCircle2 } from 'lucide-react';

export const LatestResults = ({ results }: { results: any[] }) => {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-[#0B1220] p-4">
      <h3 className="mb-4 text-base font-black text-white">Latest Results</h3>
      <div className="space-y-3">
        {results.map((res, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl bg-white/5 p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0057FF] to-[#00B8A9] text-white">
              <Award className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">{res.title}</p>
              <p className="text-xs text-slate-400">{res.date}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-[#22C55E]">{res.percent}%</p>
              <p className="text-[10px] text-slate-400">Excellent</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
