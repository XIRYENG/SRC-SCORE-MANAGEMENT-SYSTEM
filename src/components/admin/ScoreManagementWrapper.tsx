import React, { useState } from 'react';
import { ScoreFolderDashboard } from './ScoreFolderDashboard';
import { ScoreManagementDashboard } from './ScoreManagementDashboard';
import { ScoreFolder, RevieweeData } from '../../types';
import { ChevronLeft } from 'lucide-react';

type ScoreManagementWrapperProps = {
  onOpenSyncModal?: (section?: any, tab?: any, folderId?: string) => void;
  currentUser?: RevieweeData | null;
};

export function ScoreManagementWrapper({ onOpenSyncModal, currentUser }: ScoreManagementWrapperProps) {
  const [selectedFolder, setSelectedFolder] = useState<ScoreFolder | null>(null);

  if (selectedFolder) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => setSelectedFolder(null)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Score Folders
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">{selectedFolder.name}</h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {selectedFolder.type.replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        
        {/* Pass the selected folder object down to the dashboard */}
        <ScoreManagementDashboard 
          onOpenSyncModal={onOpenSyncModal}
          currentUser={currentUser}
          scoreFolderId={selectedFolder.id}
          scoreFolderName={selectedFolder.name}
          scoreFolder={selectedFolder}
        />
      </div>
    );
  }

  return (
    <ScoreFolderDashboard 
      currentUser={currentUser} 
      onOpenFolder={setSelectedFolder} 
    />
  );
}
