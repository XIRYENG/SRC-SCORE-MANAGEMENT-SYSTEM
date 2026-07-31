import React, { useState, useEffect } from 'react';
import { ScoreFolderDashboard } from './ScoreFolderDashboard';
import { ScoreManagementDashboard } from './ScoreManagementDashboard';
import { ScoreFolder, RevieweeData } from '../../types';
import { ChevronLeft } from 'lucide-react';
import { useScoreFolders } from '../../hooks/useScoreFolders';
import { useScoreManagementPreferences } from '../../hooks/useScoreManagementPreferences';
import { formatFolderType } from '../../utils/folderScope';

type ScoreManagementWrapperProps = {
  onOpenSyncModal?: (section?: any, tab?: any, folderId?: string) => void;
  currentUser?: RevieweeData | null;
};

export function ScoreManagementWrapper({ onOpenSyncModal, currentUser }: ScoreManagementWrapperProps) {
  const { folders, loading: foldersLoading } = useScoreFolders();
  const [selectedFolder, setSelectedFolder] = useState<ScoreFolder | null>(null);
  const [hasInitializedFolder, setHasInitializedFolder] = useState(false);

  const { preference, savePreference, isPreferencesReady } = useScoreManagementPreferences({
    currentUser,
    folders,
  });

  useEffect(() => {
    if (hasInitializedFolder || foldersLoading || !isPreferencesReady) return;

    if (preference.folderId) {
      const found = folders.find(f => f.id === preference.folderId && !f.isArchived && !f.isDeleted);
      if (found) {
        setSelectedFolder(found);
      }
    }
    setHasInitializedFolder(true);
  }, [preference.folderId, folders, foldersLoading, isPreferencesReady, hasInitializedFolder]);

  if (!isPreferencesReady || foldersLoading) {
    return (
      <div className="flex-1 min-h-0 p-6 flex flex-col items-center justify-center bg-slate-50 gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-xs font-semibold text-slate-500 animate-pulse">Restoring your last Score Management view...</p>
      </div>
    );
  }

  if (selectedFolder) {
    return (
      <div className="flex flex-col h-full w-full bg-slate-50 overflow-hidden">
        <div className="flex items-center gap-3 px-4 sm:px-6 py-4 border-b border-slate-200 bg-white shrink-0">
          <button
            onClick={() => {
              setSelectedFolder(null);
              savePreference({ folderId: null });
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <ChevronLeft size={16} />
            Back to Score Folders
          </button>
          <div className="h-4 w-px bg-slate-300" />
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-800">{selectedFolder.name}</h2>
            <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
              {formatFolderType(selectedFolder.folderType ?? selectedFolder.type)}
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
          initialPreference={preference}
          onPreferenceChange={savePreference}
        />
      </div>
    );
  }

  return (
    <ScoreFolderDashboard 
      currentUser={currentUser} 
      onOpenFolder={(folder) => {
        setSelectedFolder(folder);
        savePreference({ folderId: folder.id });
      }} 
    />
  );
}

