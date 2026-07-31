export const FOLDER_TYPE_LABELS = {
  phase_1: "Phase 1",
  phase_2: "Phase 2",
  marathon: "Marathon",
  final_coaching: "Final Coaching",
  custom: "Custom"
} as const;

export type FolderType = keyof typeof FOLDER_TYPE_LABELS;

export const STANDARD_FOLDER_TYPES = [
  'phase_1',
  'phase_2',
  'marathon',
  'final_coaching'
];

export const AVAILABLE_FOLDER_TYPES = [
  { value: 'phase_1', label: 'Phase 1' },
  { value: 'phase_2', label: 'Phase 2' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'final_coaching', label: 'Final Coaching' },
  { value: 'custom', label: 'Custom (Manual Input)' },
];

export function normalizeFolderType(type?: unknown): string {
  if (!type) return 'custom';
  const clean = String(type).toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (['phase_1', 'phase1', 'phase_1_eval'].includes(clean)) return 'phase_1';
  if (['phase_2', 'phase2'].includes(clean)) return 'phase_2';
  if (['marathon'].includes(clean)) return 'marathon';
  if (['final_coaching', 'finalcoaching'].includes(clean)) return 'final_coaching';
  if (['custom'].includes(clean)) return 'custom';
  return 'custom';
}

export const getFolderTypeLabel = (value: unknown): string => {
  if (!value) return FOLDER_TYPE_LABELS.custom;
  const strVal = String(value).trim();
  const normalized = normalizeFolderType(strVal);
  if (normalized !== 'custom') {
    return FOLDER_TYPE_LABELS[normalized as FolderType];
  }
  const clean = strVal.toLowerCase().replace(/[\s-]+/g, '_');
  if (clean === 'custom') {
    return FOLDER_TYPE_LABELS.custom;
  }
  return strVal;
};

export type FolderPublicationStatus = "draft" | "hidden" | "published";

export function normalizeFolderPublicationStatus(value: unknown): FolderPublicationStatus {
  if (!value) return "draft";
  const clean = String(value).toLowerCase().trim();
  if (["published", "active", "visible"].includes(clean)) return "published";
  if (["hidden", "inactive"].includes(clean)) return "hidden";
  if (["draft"].includes(clean)) return "draft";
  return "draft";
}

export function normalizeScoreFolder(rawFolder: any) {
  if (!rawFolder) return null;
  const id = rawFolder.id || rawFolder.doc_id || "";
  const name = rawFolder.name || "";
  const rawType = rawFolder.folderType ?? rawFolder.type;
  const folderType = normalizeFolderType(rawType);
  const folderTypeLabel = getFolderTypeLabel(rawType);
  
  const publicationStatus = normalizeFolderPublicationStatus(
    rawFolder.publicationStatus ?? rawFolder.status ?? rawFolder.visibility ?? (rawFolder.isPublished ? "published" : "hidden")
  );

  return {
    id,
    name,
    folderType,
    folderTypeLabel,
    publicationStatus,
    isArchived: !!(rawFolder.isArchived || rawFolder.archived),
    isDeleted: !!(rawFolder.isDeleted || rawFolder.deleted),
    schoolScope: rawFolder.schoolScope || "all",
    selectedSchoolIds: rawFolder.selectedSchoolIds || [],
    branchScope: rawFolder.branchScope || "all",
    selectedBranchIds: rawFolder.selectedBranchIds || [],
    createdAt: rawFolder.createdAt || rawFolder.created_at || null,
    updatedAt: rawFolder.updatedAt || rawFolder.updated_at || null,
  };
}
