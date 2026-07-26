/**
 * Shared Name Normalization Utility
 * 
 * Provides canonical full-name resolution, normalization, and duplicate matching
 * across all user roles (Reviewee, Staff, Admin) and legacy/modern name fields.
 */

export type UserLike = Record<string, any>;

export interface CanonicalNameResult {
  displayName: string;
  normalizedName: string;
  tokens: string[];
  sortedTokens: string[];
  rawFirstName: string;
  rawMiddleName: string;
  rawLastName: string;
  rawFullName: string;
  firstName: string;
  middleName: string;
  lastName: string;
}

export interface MatchResult {
  isMatch: boolean;
  confidence: 'high' | 'medium' | 'low' | 'none';
  matchLevel: number; // 1 to 6
  matchReason: string;
  badgeText: string;
  score: number;
}

export const FIRST_NAME_FIELDS = [
  'first_name',
  'firstName',
  'given_name',
  'givenName',
  'First Name',
];

export const MIDDLE_NAME_FIELDS = [
  'middle_name',
  'middleName',
  'middle_initial',
  'middleInitial',
  'mi',
  'Middle Name',
];

export const LAST_NAME_FIELDS = [
  'last_name',
  'lastName',
  'surname',
  'family_name',
  'familyName',
  'Last Name',
];

export const FULL_NAME_FIELDS = [
  'full_name',
  'fullName',
  'display_name',
  'displayName',
  'name',
  'reviewee_name',
  'revieweeName',
  'staff_name',
  'staffName',
  'admin_name',
  'adminName',
  'user_name',
  'userName',
];

/**
 * Gets the first non-empty string value from a set of possible field keys.
 */
export function getFirstNonEmptyValue(source: UserLike, fields: string[]): string {
  if (!source || typeof source !== 'object') return '';
  for (const field of fields) {
    const val = source[field];
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return '';
}

/**
 * Reorders "SURNAME, GIVEN NAME" format into "GIVEN NAME SURNAME"
 */
export function reorderCommaName(value: string): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed.includes(',')) {
    return trimmed;
  }
  const parts = trimmed
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length === 2) {
    const [surname, givenNames] = parts;
    return `${givenNames} ${surname}`;
  }
  return trimmed;
}

/**
 * Normalizes raw string preserving diacritics for raw comparison
 */
export function normalizeRawWithDiacritics(value: unknown): string {
  if (typeof value !== 'string') return '';
  let str = reorderCommaName(value);
  str = str.toLowerCase();
  str = str.replace(/[.,'’_\-]+/g, ' ');
  str = str.replace(/\b(mr|ms|mrs|dr|prof|sir|maam|rcrim|atty|engr)\b/gi, ' ');
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes a name string for comparison.
 * - Converts Unicode NFKD and strips diacritics / accents (including Ñ -> N)
 * - Lowercases and trims
 * - Removes punctuation
 * - Strips honorifics
 * - Reorders comma-separated names
 */
export function normalizeNameForComparison(value: unknown): string {
  if (typeof value !== 'string') return '';
  
  let str = reorderCommaName(value);

  // Convert Unicode NFKD and strip accents/diacritics
  str = str.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

  // Lowercase
  str = str.toLowerCase();

  // Convert explicit ñ/Ñ if NFKD preserved it
  str = str.replace(/ñ/g, 'n');

  // Replace punctuation with space: . , ' ’ _ -
  str = str.replace(/[.,'’_\-]+/g, ' ');

  // Strip common honorifics
  str = str.replace(/\b(mr|ms|mrs|dr|prof|sir|maam|rcrim|atty|engr)\b/gi, ' ');

  // Collapse whitespace and trim
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Format string to Title Case nicely while preserving original characters
 */
export function formatTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Resolves the canonical full name of a user record across all possible name fields.
 */
export function getCanonicalFullName(user: UserLike): CanonicalNameResult {
  const rawFirst = getFirstNonEmptyValue(user, FIRST_NAME_FIELDS);
  const rawMiddle = getFirstNonEmptyValue(user, MIDDLE_NAME_FIELDS);
  const rawLast = getFirstNonEmptyValue(user, LAST_NAME_FIELDS);
  const rawFull = getFirstNonEmptyValue(user, FULL_NAME_FIELDS);

  let candidateFromSeparated = '';

  // 1. Check if rawFirst or rawLast contains full name already
  if (rawFirst && !rawLast && normalizeNameForComparison(rawFirst).split(' ').length >= 2) {
    candidateFromSeparated = rawFirst;
  } else if (rawLast && !rawFirst && normalizeNameForComparison(rawLast).split(' ').length >= 2) {
    candidateFromSeparated = rawLast;
  } else {
    candidateFromSeparated = [rawFirst, rawMiddle, rawLast].filter(Boolean).join(' ').trim();
  }

  const candidateFromFull = reorderCommaName(rawFull);

  const normSep = normalizeNameForComparison(candidateFromSeparated);
  const normFull = normalizeNameForComparison(candidateFromFull);

  const sepTokens = normSep.split(' ').filter(Boolean);
  const fullTokens = normFull.split(' ').filter(Boolean);

  let selectedRaw = '';

  // DO NOT PREFER INCOMPLETE NAME FIELDS:
  // If separated candidate has fewer than 2 tokens (e.g. only first name) and full candidate has 2+, prefer full!
  if (sepTokens.length < 2 && fullTokens.length >= 2) {
    selectedRaw = candidateFromFull;
  } else if (sepTokens.length >= 2) {
    selectedRaw = candidateFromSeparated;
  } else {
    selectedRaw = candidateFromFull || candidateFromSeparated || rawFirst || rawLast || 'Unnamed User';
  }

  const reorderedSelected = reorderCommaName(selectedRaw);
  const normalizedName = normalizeNameForComparison(reorderedSelected);
  const tokens = normalizedName.split(' ').filter(Boolean);
  const sortedTokens = [...tokens].sort();

  const displayName = formatTitleCase(reorderedSelected);

  return {
    displayName,
    normalizedName,
    tokens,
    sortedTokens,
    rawFirstName: rawFirst,
    rawMiddleName: rawMiddle,
    rawLastName: rawLast,
    rawFullName: rawFull,
    firstName: rawFirst,
    middleName: rawMiddle,
    lastName: rawLast,
  };
}

/**
 * Calculates Levenshtein distance between two strings
 */
export function levenshteinDistance(a: string, b: string): number {
  if (!a) return b ? b.length : 0;
  if (!b) return a ? a.length : 0;
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Compares two records and determines if they match as duplicate names, along with match level & confidence.
 */
export function compareNamesAndRecords(recA: UserLike, recB: UserLike): MatchResult {
  const cA = getCanonicalFullName(recA);
  const cB = getCanonicalFullName(recB);

  if (!cA.normalizedName || !cB.normalizedName) {
    return { isMatch: false, confidence: 'none', matchLevel: 0, matchReason: '', badgeText: '', score: 0 };
  }

  // Supporting identifiers
  const emailA = String(recA.email || recA.user_email || '').trim().toLowerCase();
  const emailB = String(recB.email || recB.user_email || '').trim().toLowerCase();
  const sameEmail = Boolean(emailA && emailB && emailA === emailB);

  const rawSeqIdA = String(recA.seq_id || recA.seqId || recA.id_number || '').replace(/^SRC\s*/i, '').trim();
  const rawSeqIdB = String(recB.seq_id || recB.seqId || recB.id_number || '').replace(/^SRC\s*/i, '').trim();
  const sameSeqId = Boolean(rawSeqIdA && rawSeqIdB && rawSeqIdA === rawSeqIdB);

  const uidA = String(recA.uid || recA.doc_id || '').trim();
  const uidB = String(recB.uid || recB.doc_id || '').trim();
  if (uidA && uidB && uidA === uidB) {
    return { isMatch: false, confidence: 'none', matchLevel: 0, matchReason: 'Same Record', badgeText: '', score: 0 };
  }

  // LEVEL 1 / 2: Exact Canonical Full Name Match or Same Tokens
  if (cA.normalizedName === cB.normalizedName) {
    const sameFields =
      cA.rawFirstName.toLowerCase() === cB.rawFirstName.toLowerCase() &&
      cA.rawLastName.toLowerCase() === cB.rawLastName.toLowerCase() &&
      Boolean(cA.rawFirstName && cA.rawLastName);

    const matchReason = sameEmail || sameSeqId
      ? 'Exact Full Name & Account Match'
      : sameFields
        ? 'Exact Canonical Full Name Match'
        : 'Same Name Tokens / Field Mismatch';

    const badgeText = sameFields ? 'Exact Match' : 'Field Mismatch';

    return {
      isMatch: true,
      confidence: sameEmail || sameSeqId ? 'high' : 'high',
      matchLevel: sameFields ? 1 : 2,
      matchReason,
      badgeText,
      score: 1.0,
    };
  }

  // LEVEL 3: Reversed Name Order (sorted tokens identical, length >= 2)
  if (cA.sortedTokens.length >= 2 && cB.sortedTokens.length >= 2) {
    if (cA.sortedTokens.join(' ') === cB.sortedTokens.join(' ')) {
      return {
        isMatch: true,
        confidence: 'high',
        matchLevel: 3,
        matchReason: 'Reversed Name Order',
        badgeText: 'Reversed Name',
        score: 0.98,
      };
    }
  }

  // LEVEL 4: Middle Name / Initial Variation (First & Last match)
  if (cA.tokens.length >= 2 && cB.tokens.length >= 2) {
    const firstA = cA.tokens[0];
    const lastA = cA.tokens[cA.tokens.length - 1];
    const firstB = cB.tokens[0];
    const lastB = cB.tokens[cB.tokens.length - 1];

    if (firstA === firstB && lastA === lastB) {
      const sameSchool = Boolean(
        recA.school_name &&
        recB.school_name &&
        String(recA.school_name).toLowerCase().trim() === String(recB.school_name).toLowerCase().trim()
      );

      return {
        isMatch: true,
        confidence: sameEmail || sameSeqId || sameSchool ? 'high' : 'medium',
        matchLevel: 4,
        matchReason: 'Middle Name / Initial Variation',
        badgeText: 'Middle Name Variation',
        score: 0.90,
      };
    }
  }

  // LEVEL 5: Accent / Diacritic / Ñ-N Difference
  const rawNormA = normalizeRawWithDiacritics(cA.displayName);
  const rawNormB = normalizeRawWithDiacritics(cB.displayName);
  if (rawNormA && rawNormB && rawNormA !== rawNormB && cA.normalizedName === cB.normalizedName) {
    return {
      isMatch: true,
      confidence: 'high',
      matchLevel: 5,
      matchReason: 'Accent or Special Character Difference (Ñ/N)',
      badgeText: 'Accent Variation',
      score: 0.95,
    };
  }

  // LEVEL 6: Levenshtein Fuzzy Token Match
  if (cA.tokens.length >= 2 && cB.tokens.length >= 2) {
    const dist = levenshteinDistance(cA.normalizedName, cB.normalizedName);
    const maxLen = Math.max(cA.normalizedName.length, cB.normalizedName.length);
    const similarity = 1 - dist / maxLen;

    if (similarity >= 0.82 && dist <= 3) {
      return {
        isMatch: true,
        confidence: similarity >= 0.90 ? 'medium' : 'low',
        matchLevel: 6,
        matchReason: 'Similar Name / Minor Typo',
        badgeText: 'Possible Duplicate',
        score: similarity,
      };
    }
  }

  // Same Email or Same ID with similar name
  if (sameEmail || sameSeqId) {
    const dist = levenshteinDistance(cA.normalizedName, cB.normalizedName);
    if (dist <= 6) {
      return {
        isMatch: true,
        confidence: 'high',
        matchLevel: 6,
        matchReason: sameEmail ? 'Same Email / Matching Account' : 'Shared ID Number',
        badgeText: 'High Confidence',
        score: 0.88,
      };
    }
  }

  return { isMatch: false, confidence: 'none', matchLevel: 0, matchReason: '', badgeText: '', score: 0 };
}

/**
 * Group all records by duplicate ID numbers and duplicate/similar canonical names.
 */
export function analyzeDuplicatesReport(allRecords: UserLike[], filterYear?: string) {
  let records = allRecords;
  if (filterYear && filterYear !== '') {
    records = records.filter((r) => {
      if (!r.created_at) return false;
      return new Date(r.created_at).getFullYear() === parseInt(filterYear);
    });
  }

  // 1. Group by ID Number
  const idGroupsMap: Record<string, UserLike[]> = {};
  records.forEach((rec) => {
    const rawSeqId = String(rec.seq_id || rec.seqId || rec.id_number || '').trim();
    const numericalId = rawSeqId.replace(/^SRC\s*/i, '').trim();
    if (numericalId) {
      if (!idGroupsMap[numericalId]) idGroupsMap[numericalId] = [];
      idGroupsMap[numericalId].push(rec);
    }
  });

  // 2. Union-Find for Name Duplicates
  const n = records.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  const find = (i: number): number => {
    if (parent[i] === i) return i;
    parent[i] = find(parent[i]);
    return parent[i];
  };

  const union = (i: number, j: number) => {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI !== rootJ) parent[rootI] = rootJ;
  };

  const matchTypeMap: Record<string, { reason: string; badge: string; level: number }> = {};

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const matchRes = compareNamesAndRecords(records[i], records[j]);
      if (matchRes.isMatch) {
        union(i, j);

        const docI = records[i].doc_id || records[i].uid || String(i);
        const docJ = records[j].doc_id || records[j].uid || String(j);

        const existingI = matchTypeMap[docI];
        if (!existingI || matchRes.matchLevel < existingI.level) {
          matchTypeMap[docI] = { reason: matchRes.matchReason, badge: matchRes.badgeText, level: matchRes.matchLevel };
        }
        const existingJ = matchTypeMap[docJ];
        if (!existingJ || matchRes.matchLevel < existingJ.level) {
          matchTypeMap[docJ] = { reason: matchRes.matchReason, badge: matchRes.badgeText, level: matchRes.matchLevel };
        }
      }
    }
  }

  // Collect connected components
  const componentMap = new Map<number, UserLike[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!componentMap.has(root)) {
      componentMap.set(root, []);
    }
    const docKey = records[i].doc_id || records[i].uid || String(i);
    const matchMeta = matchTypeMap[docKey];

    const recWithMeta = {
      ...records[i],
      _canonical: getCanonicalFullName(records[i]),
      _matchReason: matchMeta?.reason || 'Exact Name Match',
      _badgeText: matchMeta?.badge || 'Exact Match',
    };
    componentMap.get(root)!.push(recWithMeta);
  }

  const similarNameGroups = Array.from(componentMap.values()).filter((g) => g.length > 1);
  const duplicateIdsGroups = Object.values(idGroupsMap)
    .filter((g) => g.length > 1)
    .map((g) =>
      g.map((r) => ({
        ...r,
        _canonical: getCanonicalFullName(r),
      }))
    );

  return {
    duplicateIds: duplicateIdsGroups,
    similarNames: similarNameGroups,
  };
}
