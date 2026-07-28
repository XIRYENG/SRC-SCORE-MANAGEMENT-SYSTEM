import React from 'react';
import { ScoreMatrixRow } from './BoardSubjectAreaScoresModal'; // Will need to define types

type DateColumn = {
  id: string;
  date: string;
  label: string;
};

export function BoardSubjectAreaScoreTable({
  rows,
  dates,
  selectedCategory,
  onRowClick,
  highlightedArea,
}: {
  rows: any[];
  dates: DateColumn[];
  selectedCategory: string;
  onRowClick: (area: string) => void;
  highlightedArea: string | null;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-xs text-left text-slate-600">
        <thead className="text-[10px] text-slate-400 uppercase font-black bg-slate-50 border-b border-slate-200">
          <tr>
            <th rowSpan={2} className="px-4 py-3 sticky left-0 bg-slate-50 z-20">Area</th>
            <th colSpan={dates.length} className="px-4 py-3 text-center border-b border-slate-200">{selectedCategory}</th>
            <th rowSpan={2} className="px-4 py-3 text-center">Combined</th>
            <th rowSpan={2} className="px-4 py-3 text-center sticky right-0 bg-slate-50 z-20">Rating</th>
          </tr>
          <tr>
            {dates.map((d) => (
              <th key={d.id} className="px-4 py-2 border-r border-slate-200 whitespace-nowrap">{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr
              key={row.area}
              onClick={() => onRowClick(row.area)}
              className={`cursor-pointer hover:bg-slate-50 transition-colors ${highlightedArea === row.area ? 'bg-teal-50 hover:bg-teal-50' : ''}`}
            >
              <td className="px-4 py-3 font-black text-slate-900 sticky left-0 bg-white z-10 border-r border-slate-100">{row.area}</td>
              {dates.map((date) => {
                const cell = row.cellsByDateId[date.id];
                return (
                  <td key={date.id} className="px-4 py-3 border-r border-slate-100">
                    {cell ? `${cell.earned}/${cell.total}` : '___/—'}
                  </td>
                );
              })}
              <td className="px-4 py-3 font-bold text-slate-700">{row.aggregate.totalEarned}/{row.aggregate.totalPossible}</td>
              <td className="px-4 py-3 font-black text-teal-700 sticky right-0 bg-white z-10 border-l border-slate-100">
                {row.aggregate.rating !== null ? `${row.aggregate.rating.toFixed(2)}%` : '0.00%'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
