import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, Check, X, ChevronDown } from 'lucide-react';

export interface MultiSelectOption {
  id: string;
  name: string;
}

interface SearchableMultiSelectProps {
  label?: string;
  options: MultiSelectOption[];
  selectedIds: string[];
  onChange: (selectedIds: string[], selectedNames: string[]) => void;
  placeholder?: string;
  error?: string | null;
}

export function SearchableMultiSelect({
  label,
  options,
  selectedIds,
  onChange,
  placeholder = 'Search...',
  error
}: SearchableMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      opt => opt.name.toLowerCase().includes(q) || opt.id.toLowerCase().includes(q)
    );
  }, [options, searchQuery]);

  const selectedOptions = useMemo(() => {
    return options.filter(opt => selectedIds.includes(opt.id));
  }, [options, selectedIds]);

  const handleToggle = (id: string) => {
    let newIds: string[];
    if (selectedIds.includes(id)) {
      newIds = selectedIds.filter(i => i !== id);
    } else {
      newIds = [...selectedIds, id];
    }
    const newNames = options.filter(opt => newIds.includes(opt.id)).map(opt => opt.name);
    onChange(newIds, newNames);
  };

  const handleSelectAll = () => {
    const allIds = options.map(o => o.id);
    const allNames = options.map(o => o.name);
    onChange(allIds, allNames);
  };

  const handleClearAll = () => {
    onChange([], []);
  };

  const handleRemoveBadge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newIds = selectedIds.filter(i => i !== id);
    const newNames = options.filter(opt => newIds.includes(opt.id)).map(opt => opt.name);
    onChange(newIds, newNames);
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      {label && (
        <label className="block text-sm font-bold text-slate-700">
          {label} <span className="text-rose-500">*</span>
        </label>
      )}

      {/* Selected badges list */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[42px] rounded-xl border bg-white px-3 py-2 text-sm transition-all cursor-pointer flex flex-wrap items-center gap-1.5 justify-between ${
          error
            ? 'border-rose-400 ring-1 ring-rose-400/20'
            : isOpen
            ? 'border-teal-500 ring-1 ring-teal-500'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        <div className="flex flex-wrap items-center gap-1.5 max-w-[90%]">
          {selectedOptions.length === 0 ? (
            <span className="text-slate-400 font-normal">{placeholder}</span>
          ) : (
            selectedOptions.map(opt => (
              <span
                key={opt.id}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-teal-50 text-teal-800 border border-teal-200/60 text-xs font-semibold"
              >
                <span className="max-w-[180px] truncate">{opt.name}</span>
                <button
                  type="button"
                  onClick={e => handleRemoveBadge(opt.id, e)}
                  className="hover:bg-teal-200/60 rounded-full p-0.5 text-teal-600 transition-colors"
                >
                  <X size={12} />
                </button>
              </span>
            ))
          )}
        </div>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      {error && <p className="text-xs font-semibold text-rose-500">{error}</p>}

      {/* Dropdown list */}
      {isOpen && (
        <div className="relative z-30">
          <div className="absolute top-1 left-0 right-0 rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-60">
            {/* Search Input */}
            <div className="p-2 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Search size={14} className="text-slate-400 shrink-0 ml-1" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Type to filter..."
                className="w-full bg-transparent text-xs outline-none py-1 text-slate-800 placeholder:text-slate-400"
                autoFocus
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Quick Actions */}
            <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>{selectedIds.length} of {options.length} selected</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-teal-600 hover:underline"
                >
                  Select All
                </button>
                <span>|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-slate-500 hover:underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* Options List */}
            <div className="overflow-y-auto flex-1 p-1 space-y-0.5">
              {filteredOptions.length === 0 ? (
                <div className="p-3 text-center text-xs text-slate-400">No matching options found</div>
              ) : (
                filteredOptions.map(opt => {
                  const isChecked = selectedIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => handleToggle(opt.id)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-teal-50 text-teal-900 font-semibold'
                          : 'text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate pr-2">{opt.name}</span>
                      <div
                        className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isChecked
                            ? 'bg-teal-600 border-teal-600 text-white'
                            : 'border-slate-300 bg-white'
                        }`}
                      >
                        {isChecked && <Check size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
