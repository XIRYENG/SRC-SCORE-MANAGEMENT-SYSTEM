import { ScoreFolder, RevieweeData } from '../types';
import { resolveCanonicalUserIdentity } from '../services/userIdentityResolver';
import { FOLDER_TYPE_LABELS, normalizeFolderType, getFolderTypeLabel } from '../constants/folderTypes';

export function normalizeScopeString(val: unknown): string {
  if (!val) return '';
  return String(val)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function getRevieweeSchoolInfo(reviewee: any): { schoolId: string; schoolName: string } {
  if (!reviewee) return { schoolId: 'unassigned', schoolName: 'Unassigned School' };
  
  const canonical = resolveCanonicalUserIdentity(reviewee);
  const rawId = reviewee.schoolId || reviewee.school_id;
  const rawName = canonical.school || reviewee.school_name || reviewee.schoolName || reviewee.school || '';

  if (rawId) {
    return {
      schoolId: String(rawId).trim(),
      schoolName: rawName ? String(rawName).trim() : String(rawId).trim(),
    };
  }

  if (!rawName) {
    return { schoolId: 'unassigned', schoolName: 'Unassigned School' };
  }

  const nameTrimmed = String(rawName).trim();
  const normKey = normalizeScopeString(nameTrimmed);

  if (normKey.includes('ckcm') || normKey.includes('christtheking')) {
    return { schoolId: 'CKCM', schoolName: 'CKCM (Christ the King College de Maranding)' };
  }
  if (normKey.includes('lssti') || normKey.includes('lanaoschoolofscience')) {
    return { schoolId: 'LSSTI', schoolName: 'LSSTI' };
  }
  if (normKey.includes('ncmc') || normKey.includes('northcentralmindanao')) {
    return { schoolId: 'NCMC', schoolName: 'NCMC' };
  }
  if (normKey.includes('cdek') || normKey.includes('colegiode')) {
    return { schoolId: 'CDEK', schoolName: 'CDEK' };
  }
  if (normKey.includes('smc') || normKey.includes('saintmichaels')) {
    return { schoolId: 'SMC', schoolName: 'SMC' };
  }

  return { schoolId: normKey || 'unassigned', schoolName: nameTrimmed };
}

export function getRevieweeBranchInfo(reviewee: any): { branchId: string; branchName: string } {
  if (!reviewee) return { branchId: 'unassigned', branchName: 'Unassigned Branch' };

  const canonical = resolveCanonicalUserIdentity(reviewee);
  const rawId = reviewee.branchId || reviewee.branch_id;
  const rawName = canonical.branch || reviewee.reviewBranch || reviewee.review_branch || reviewee.branchName || reviewee.branch_name || reviewee.branch || '';

  if (rawId) {
    return {
      branchId: String(rawId).trim(),
      branchName: rawName ? String(rawName).trim() : String(rawId).trim(),
    };
  }

  if (!rawName || rawName === '—' || rawName === '-' || rawName === 'N/A') {
    return { branchId: 'unassigned', branchName: 'Unassigned Branch' };
  }

  const nameTrimmed = String(rawName).trim();
  const normKey = normalizeScopeString(nameTrimmed);

  return { branchId: normKey || 'unassigned', branchName: nameTrimmed };
}

import { normalizeScoreFolder } from '../constants/folderTypes';

/**
 * Validates if a folder is visible to a specific reviewee.
 * Checks for publicationStatus, archived, deleted, school/branch scope, and active account status.
 */
export function isFolderVisibleToReviewee(
  folder: any,
  reviewee: any
): boolean {
  if (!folder) return false;
  const normalized = normalizeScoreFolder(folder);
  if (!normalized) return false;

  // Enforce account check if reviewee is provided
  if (reviewee && reviewee.accountStatus && reviewee.accountStatus.toLowerCase() !== 'active') {
    // If the reviewee has a status, it must be active (or empty/undefined which passes)
    if (reviewee.accountStatus.toLowerCase() === 'inactive' || reviewee.accountStatus.toLowerCase() === 'deleted') {
      return false;
    }
  }

  return (
    normalized.publicationStatus === "published" &&
    normalized.isArchived !== true &&
    normalized.isDeleted !== true &&
    isRevieweeInFolderScope(reviewee, normalized as any)
  );
}

/**
 * Validates if a reviewee belongs to a score folder's school AND branch scope.
 * Uses AND logic when both scopes are set to 'selected'.
 */
export function isRevieweeInFolderScope(
  reviewee: RevieweeData | any,
  folder?: ScoreFolder | null
): boolean {
  if (!folder) return true; // If no folder specified, all reviewees pass

  const { schoolScope = 'all', selectedSchoolIds = [], selectedSchoolNames = [] } = folder;
  const { branchScope = 'all', selectedBranchIds = [], selectedBranchNames = [] } = folder;

  // 1. School check
  let matchesSchool = true;
  if (schoolScope === 'selected') {
    if (selectedSchoolIds.length === 0 && selectedSchoolNames.length === 0) {
      matchesSchool = false;
    } else {
      const { schoolId, schoolName } = getRevieweeSchoolInfo(reviewee);
      const isUnassigned = schoolId === 'unassigned' || schoolName === 'Unassigned School';

      const normSchoolId = normalizeScopeString(schoolId);
      const normSchoolName = normalizeScopeString(schoolName);

       const matchId = selectedSchoolIds.some((id: string) => {
        const norm = normalizeScopeString(id);
        return norm === normSchoolId || normSchoolId.includes(norm) || norm.includes(normSchoolId);
      });

      const matchName = selectedSchoolNames.some((n: string) => {
        const norm = normalizeScopeString(n);
        return norm === normSchoolName || normSchoolName.includes(norm) || norm.includes(normSchoolName) || norm === normSchoolId || normSchoolId.includes(norm);
      });

      const matchUnassigned = (selectedSchoolIds.includes('unassigned') || selectedSchoolNames.some((n: string) => normalizeScopeString(n) === 'unassignedschool' || normalizeScopeString(n) === 'unassigned')) && isUnassigned;

      matchesSchool = matchId || matchName || matchUnassigned;
    }
  }

  // 2. Branch check
  let matchesBranch = true;
  if (branchScope === 'selected') {
    if (selectedBranchIds.length === 0 && selectedBranchNames.length === 0) {
      matchesBranch = false;
    } else {
      const { branchId, branchName } = getRevieweeBranchInfo(reviewee);
      const isUnassigned = branchId === 'unassigned' || branchName === 'Unassigned Branch';

      const normBranchId = normalizeScopeString(branchId);
      const normBranchName = normalizeScopeString(branchName);

      const matchId = selectedBranchIds.some((id: string) => {
        const norm = normalizeScopeString(id);
        return norm === normBranchId || normBranchId.includes(norm) || norm.includes(normBranchId);
      });

      const matchName = selectedBranchNames.some((n: string) => {
        const norm = normalizeScopeString(n);
        return norm === normBranchName || normBranchName.includes(norm) || norm.includes(normBranchName) || norm === normBranchId || normBranchId.includes(norm);
      });

      const matchUnassigned = (selectedBranchIds.includes('unassigned') || selectedBranchNames.some((n: string) => normalizeScopeString(n) === 'unassignedbranch' || normalizeScopeString(n) === 'unassigned')) && isUnassigned;

      matchesBranch = matchId || matchName || matchUnassigned;
    }
  }

  // BOTH conditions must be satisfied (AND logic)
  return matchesSchool && matchesBranch;
}

/**
 * Formats scope text for folder cards or headers.
 */
export function formatFolderScopeDisplay(folder: ScoreFolder): {
  schoolsLabel: string;
  branchesLabel: string;
  schoolsDetail: string[];
  branchesDetail: string[];
} {
  const schoolScope = folder.schoolScope || 'all';
  const branchScope = folder.branchScope || 'all';

  let schoolsLabel = 'All Schools';
  let schoolsDetail: string[] = [];

  if (schoolScope === 'selected') {
    const names = folder.selectedSchoolNames && folder.selectedSchoolNames.length > 0
      ? folder.selectedSchoolNames
      : (folder.selectedSchoolIds || []);

    schoolsDetail = names;
    if (names.length === 0) {
      schoolsLabel = 'No Schools Selected';
    } else if (names.length <= 2) {
      schoolsLabel = names.join(', ');
    } else {
      schoolsLabel = `${names.length} selected`;
    }
  }

  let branchesLabel = 'All Branches';
  let branchesDetail: string[] = [];

  if (branchScope === 'selected') {
    const names = folder.selectedBranchNames && folder.selectedBranchNames.length > 0
      ? folder.selectedBranchNames
      : (folder.selectedBranchIds || []);

    branchesDetail = names;
    if (names.length === 0) {
      branchesLabel = 'No Branches Selected';
    } else if (names.length <= 2) {
      branchesLabel = names.join(', ');
    } else {
      branchesLabel = `${names.length} selected`;
    }
  }

  return {
    schoolsLabel,
    branchesLabel,
    schoolsDetail,
    branchesDetail,
  };
}

export { normalizeFolderType };

export function formatFolderType(type?: string): string {
  return getFolderTypeLabel(type);
}
