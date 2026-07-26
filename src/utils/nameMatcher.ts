export function normalizeStr(str: string | null | undefined): string {
  if (!str) return '';
  return str
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' '); // collapse consecutive spaces
}

export interface CandidateRecord {
  id: string;
  first_name?: string;
  firstName?: string;
  middle_name?: string;
  middleName?: string;
  last_name?: string;
  lastName?: string;
  school_name?: string;
  schoolName?: string;
  review_branch?: string;
  reviewBranch?: string;
  seq_id?: string;
  srcId?: string;
  uid?: string;
  role?: string;
  [key: string]: any;
}

export interface MatchResult {
  matchType: 'none' | 'perfect' | 'requires_verification';
  matchedRecord?: CandidateRecord;
  candidates?: CandidateRecord[];
}

/**
 * Robustly matches signup details with existing unlinked database records.
 * Follows duplicate protection guidelines:
 * - If multiple records share the same Last Name and First Name, do not auto merge.
 * - Require exact match of Name, School, and Branch for auto-merging.
 */
export function matchRevieweeRecord(
  formFirst: string,
  formMiddle: string,
  formLast: string,
  formSchool: string,
  formBranch: string,
  existingUsers: CandidateRecord[]
): MatchResult {
  const normFormFirst = normalizeStr(formFirst);
  const normFormMiddle = normalizeStr(formMiddle);
  const normFormLast = normalizeStr(formLast);
  const normFormSchool = normalizeStr(formSchool);
  const normFormBranch = normalizeStr(formBranch);

  // 1. Find all unlinked reviewee candidates
  const unlinkedReviewees = existingUsers.filter(u => {
    const isUnlinked = !u.uid || u.uid.trim() === '';
    const isReviewee = String(u.role || '').toLowerCase() === 'reviewee';
    return isUnlinked && isReviewee;
  });

  // 2. Find any candidate with the exact same Last Name and First Name
  const nameMatches = unlinkedReviewees.filter(u => {
    const first = normalizeStr(u.first_name || u.firstName);
    const last = normalizeStr(u.last_name || u.lastName);
    return first === normFormFirst && last === normFormLast;
  });

  if (nameMatches.length === 0) {
    return { matchType: 'none' };
  }

  // 3. Apply duplicate protection: if multiple possible matches found in database
  // with the same Last Name and First Name, DO NOT auto-merge.
  if (nameMatches.length > 1) {
    return {
      matchType: 'requires_verification',
      candidates: nameMatches
    };
  }

  // Exactly 1 record has the same Last Name and First Name.
  const candidate = nameMatches[0];
  const candidateMiddle = normalizeStr(candidate.middle_name || candidate.middleName);
  const candidateSchool = normalizeStr(candidate.school_name || candidate.schoolName);
  const candidateBranch = normalizeStr(candidate.review_branch || candidate.reviewBranch);

  // 4. Verify school and branch (and middle name)
  const isMiddleMatch = candidateMiddle === normFormMiddle;
  const isSchoolMatch = candidateSchool === normFormSchool;
  // If the old record has no branch, we can treat it as a match, or if it matches exactly
  const isBranchMatch = !candidateBranch || candidateBranch === normFormBranch;

  if (isMiddleMatch && isSchoolMatch && isBranchMatch) {
    return {
      matchType: 'perfect',
      matchedRecord: candidate
    };
  }

  // If there is a single record but its middle name/school/branch is different,
  // to prevent incorrect merges or duplicate generation, flag it for verification.
  return {
    matchType: 'requires_verification',
    candidates: nameMatches
  };
}
