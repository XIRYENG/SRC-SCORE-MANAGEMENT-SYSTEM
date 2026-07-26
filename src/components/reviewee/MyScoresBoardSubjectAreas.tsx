import React from 'react';
import { AreaPerformanceCircle } from '../AreaPerformanceCircle';

export function MyScoresBoardSubjectAreas({ areas, selectedArea, onAreaClick }: { areas: any[], selectedArea?: string, onAreaClick: (area: string) => void }) {
  return (
    <section>
      <h2 className="text-lg font-black text-slate-900 mb-1">Board Subject Areas</h2>
      <p className="text-xs font-medium text-slate-500 mb-6">Click an area to view your scores by category and examination date.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {areas.map(area => (
          <AreaPerformanceCircle
            key={area.area}
            subject={area.area}
            percentage={area.percent || 0}
            subtitle={area.title}
            isSelected={selectedArea === area.area}
            onClick={() => onAreaClick(area.area)}
          />
        ))}
      </div>
    </section>
  );
}
