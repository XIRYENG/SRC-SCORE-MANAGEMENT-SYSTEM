import React from 'react';
import { AreaPerformanceCircle } from '../AreaPerformanceCircle';

export function MyScoresBoardSubjectAreas({ areas, selectedArea, onAreaClick }: { areas: any[], selectedArea?: string, onAreaClick: (area: string) => void }) {
  return (
    <section className="overflow-hidden">
      <h2 className="text-lg font-black text-slate-900 mb-1">Board Major Area</h2>
      <p className="text-xs font-medium text-slate-500 mb-6">Click an area to view your scores by category and examination date.</p>
      <div className="-mx-4 overflow-x-auto px-4 pb-3">
        <div className="flex w-max gap-3 lg:grid lg:w-full lg:grid-cols-6">
          {areas.map((area) => (
            <div key={area.area} className="w-[180px] shrink-0 lg:w-auto">
              <AreaPerformanceCircle
                subject={area.area}
                percentage={area.percent || 0}
                subtitle={area.title}
                isSelected={selectedArea === area.area}
                onClick={() => onAreaClick(area.area)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
