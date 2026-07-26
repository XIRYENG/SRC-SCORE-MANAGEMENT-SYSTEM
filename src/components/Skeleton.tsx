import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => {
  return (
    <div className={`animate-pulse bg-slate-200 rounded-md ${className}`} />
  );
};

export const SkeletonTableRows: React.FC<{ rows?: number, cols?: number }> = ({ rows = 8, cols = 5 }) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr key={rIdx} className="border-b border-slate-100 last:border-0">
          {Array.from({ length: cols }).map((_, cIdx) => (
            <td key={cIdx} className="p-3">
              {cIdx === 0 ? (
                <Skeleton className="h-4 w-4 rounded" />
              ) : cIdx === 1 ? (
                <Skeleton className="h-4 w-12" />
              ) : cIdx === 2 ? (
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32 sm:w-48" />
                  <Skeleton className="h-3 w-20 opacity-65" />
                </div>
              ) : (
                <Skeleton className={`h-4 ${cIdx % 2 === 0 ? 'w-16' : 'w-24'}`} />
              )}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export const SkeletonCardList: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, idx) => (
        <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2 animate-pulse">
          <div className="flex justify-between items-center">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-5 bg-slate-200 rounded-full w-16" />
          </div>
          <div className="h-3 bg-slate-100 rounded w-2/3" />
          <div className="flex gap-2 mt-2">
            <div className="h-8 bg-slate-100 rounded-lg w-1/4" />
            <div className="h-8 bg-slate-100 rounded-lg w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
};
