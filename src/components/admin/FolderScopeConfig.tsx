import React from 'react';
import { Building2, GitBranch } from 'lucide-react';
import { SearchableMultiSelect, MultiSelectOption } from '../searchable-multi-select';

export interface FolderScopeConfigProps {
  schoolScope: 'all' | 'selected';
  onSchoolScopeChange: (scope: 'all' | 'selected') => void;
  selectedSchoolIds: string[];
  selectedSchoolNames?: string[];
  onSchoolsChange: (selectedIds: string[], selectedNames: string[]) => void;
  availableSchools: MultiSelectOption[];
  schoolError?: string | null;

  branchScope: 'all' | 'selected';
  onBranchScopeChange: (scope: 'all' | 'selected') => void;
  selectedBranchIds: string[];
  selectedBranchNames?: string[];
  onBranchesChange: (selectedIds: string[], selectedNames: string[]) => void;
  availableBranches: MultiSelectOption[];
  branchError?: string | null;

  className?: string;
}

export function FolderScopeConfig({
  schoolScope,
  onSchoolScopeChange,
  selectedSchoolIds,
  selectedSchoolNames,
  onSchoolsChange,
  availableSchools,
  schoolError,

  branchScope,
  onBranchScopeChange,
  selectedBranchIds,
  selectedBranchNames,
  onBranchesChange,
  availableBranches,
  branchError,

  className = ''
}: FolderScopeConfigProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* School Scope */}
      <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3 transition-all hover:border-slate-300">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <Building2 size={16} className="text-teal-600" />
            <label className="block text-sm font-bold text-slate-800">School Scope</label>
          </div>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors">
              <input 
                type="radio"
                name="schoolScope"
                checked={schoolScope === 'all'}
                onChange={() => {
                  onSchoolScopeChange('all');
                  onSchoolsChange([], []);
                }}
                className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 cursor-pointer"
              />
              <span>All Schools</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors">
              <input 
                type="radio"
                name="schoolScope"
                checked={schoolScope === 'selected'}
                onChange={() => onSchoolScopeChange('selected')}
                className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 cursor-pointer"
              />
              <span>Selected Schools</span>
            </label>
          </div>
        </div>

        {schoolScope === 'selected' && (
          <div className="pt-2">
            <SearchableMultiSelect 
              label="Selected Schools"
              options={availableSchools}
              selectedIds={selectedSchoolIds}
              onChange={onSchoolsChange}
              placeholder="Search & select schools..."
              error={schoolError}
            />
          </div>
        )}
      </div>

      {/* Branch Scope */}
      <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3 transition-all hover:border-slate-300">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <GitBranch size={16} className="text-teal-600" />
            <label className="block text-sm font-bold text-slate-800">Branch Scope</label>
          </div>
          <div className="flex items-center gap-5">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors">
              <input 
                type="radio"
                name="branchScope"
                checked={branchScope === 'all'}
                onChange={() => {
                  onBranchScopeChange('all');
                  onBranchesChange([], []);
                }}
                className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 cursor-pointer"
              />
              <span>All Branches</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 hover:text-slate-900 transition-colors">
              <input 
                type="radio"
                name="branchScope"
                checked={branchScope === 'selected'}
                onChange={() => onBranchScopeChange('selected')}
                className="text-teal-600 focus:ring-teal-500 h-4 w-4 border-slate-300 cursor-pointer"
              />
              <span>Selected Branches</span>
            </label>
          </div>
        </div>

        {branchScope === 'selected' && (
          <div className="pt-2">
            <SearchableMultiSelect 
              label="Selected Branches"
              options={availableBranches}
              selectedIds={selectedBranchIds}
              onChange={onBranchesChange}
              placeholder="Search & select branches..."
              error={branchError}
            />
          </div>
        )}
      </div>
    </div>
  );
}
