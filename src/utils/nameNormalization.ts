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
  'firstname',
  'first_Name',
  'fname',
  'First_Name',
];

export const MIDDLE_NAME_FIELDS = [
  'middle_name',
  'middleName',
  'middle_initial',
  'middleInitial',
  'mi',
  'Middle Name',
  'middlename',
  'mname',
  'Middle_Name',
];

export const LAST_NAME_FIELDS = [
  'last_name',
  'lastName',
  'surname',
  'family_name',
  'familyName',
  'Last Name',
  'lastname',
  'lname',
  'Last_Name',
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
  'student_name',
  'studentName',
  'Full Name',
  'Name',
];

/**
 * Resolves the canonical ID number of a user record across all possible identifier fields.
 */
export function getCanonicalIdNumber(user: UserLike): string {
  if (!user || typeof user !== 'object') return '';

  const sources = [
    user,
    user.profile,
    user.personalInfo,
    user.reviewee,
    user.data,
    user.user
  ];

  const keys = [
    'seq_id', 'seqId',
    'id_number', 'idNumber',
    'src_id', 'srcId',
    'student_id', 'studentId',
    'official_id_number', 'officialIdNumber',
    'employee_id', 'employeeId',
    'registration_id', 'registrationId',
    'reviewee_id', 'revieweeId',
    'staff_id', 'staffId',
    'admin_id', 'adminId',
    'ID Number', 'ID', 'Id'
  ];

  for (const src of sources) {
    if (src && typeof src === 'object') {
      for (const k of keys) {
        const val = src[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          const str = String(val).trim();
          if (str && str.toUpperCase() !== 'N/A' && str.toUpperCase() !== 'NONE' && str !== '-') {
            return str;
          }
        }
      }
    }
  }

  return '';
}

/**
 * Gets the first non-empty string value from a set of possible field keys across top-level and nested objects.
 */
export function getFirstNonEmptyValue(source: UserLike, fields: string[]): string {
  if (!source || typeof source !== 'object') return '';

  const targets = [
    source,
    source.profile,
    source.personalInfo,
    source.reviewee,
    source.data,
    source.user
  ];

  for (const target of targets) {
    if (target && typeof target === 'object') {
      for (const field of fields) {
        const val = target[field];
        if (typeof val === 'string' && val.trim()) {
          return val.trim();
        }
      }
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
 * Resolves the canonical birthdate string YYYY-MM-DD (or normalized digits) from user record.
 */
export function getCanonicalBirthdate(user: UserLike): string {
  if (!user || typeof user !== 'object') return '';

  const sources = [
    user,
    user.profile,
    user.personalInfo,
    user.reviewee,
    user.data,
    user.user
  ];

  const keys = [
    'birthdate', 'birth_date', 'birthDate',
    'dob', 'DOB', 'dateOfBirth', 'date_of_birth', 'Date of Birth',
    'bday', 'birthday', 'Birth Date'
  ];

  for (const src of sources) {
    if (src && typeof src === 'object') {
      for (const k of keys) {
        const val = src[k];
        if (val !== undefined && val !== null) {
          const str = String(val).trim();
          if (!str || str.toUpperCase() === 'N/A' || str.toUpperCase() === 'NONE' || str === '-') continue;

          // If numeric timestamp (e.g. millis)
          if (/^\d{9,13}$/.test(str)) {
            const d = new Date(parseInt(str, 10));
            if (!isNaN(d.getTime())) {
              return d.toISOString().split('T')[0];
            }
          }

          // If string like YYYY-MM-DD or YYYY/MM/DD or MM/DD/YYYY
          const d = new Date(str);
          if (!isNaN(d.getTime()) && d.getFullYear() > 1900 && d.getFullYear() < 2100) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }

          // Fallback: extract digits if length >= 6
          const digits = str.replace(/\D/g, '');
          if (digits.length >= 6) {
            return digits;
          }
        }
      }
    }
  }

  return '';
}

/**
 * Resolves contact information (normalized phone digits and normalized email) from user record.
 */
export function getCanonicalContactInfo(user: UserLike): { phone: string; email: string } {
  if (!user || typeof user !== 'object') return { phone: '', email: '' };

  const sources = [
    user,
    user.profile,
    user.personalInfo,
    user.reviewee,
    user.data,
    user.user
  ];

  const phoneKeys = [
    'phone', 'phone_number', 'phoneNumber', 'Phone Number', 'Phone',
    'mobile', 'mobile_number', 'mobileNumber', 'Mobile Number', 'Mobile',
    'contact_number', 'contactNumber', 'Contact Number', 'contact_no', 'contactNo',
    'cellphone', 'cellphone_number', 'cellphoneNumber', 'tel', 'telephone'
  ];

  const emailKeys = [
    'email', 'user_email', 'userEmail', 'contact_email', 'contactEmail', 'Email', 'User Email'
  ];

  let foundPhone = '';
  let foundEmail = '';

  for (const src of sources) {
    if (src && typeof src === 'object') {
      if (!foundPhone) {
        for (const k of phoneKeys) {
          const val = src[k];
          if (val !== undefined && val !== null) {
            const str = String(val).replace(/\D/g, '');
            if (str.length >= 7) {
              foundPhone = str.length >= 10 ? str.slice(-10) : str;
              break;
            }
          }
        }
      }
      if (!foundEmail) {
        for (const k of emailKeys) {
          const val = src[k];
          if (val !== undefined && val !== null) {
            const str = String(val).trim().toLowerCase();
            if (str && str.includes('@') && !str.endsWith('@example.com') && str !== 'none' && str !== 'n/a') {
              foundEmail = str;
              break;
            }
          }
        }
      }
    }
  }

  return { phone: foundPhone, email: foundEmail };
}

/**
 * Compares two records and determines if they match as duplicate names, along with match level & confidence.
 * Incorporates fuzzy name matching with secondary checks (Birthdate, Contact Info, Shared ID).
 */
export function compareNamesAndRecords(recA: UserLike, recB: UserLike): MatchResult {
  const cA = getCanonicalFullName(recA);
  const cB = getCanonicalFullName(recB);

  if (!cA.normalizedName || !cB.normalizedName || cA.normalizedName === 'unnamed user' || cB.normalizedName === 'unnamed user') {
    return { isMatch: false, confidence: 'none', matchLevel: 0, matchReason: '', badgeText: '', score: 0 };
  }

  const uidA = String(recA.uid || recA.doc_id || recA.id || '').trim();
  const uidB = String(recB.uid || recB.doc_id || recB.id || '').trim();
  if (uidA && uidB && uidA === uidB) {
    return { isMatch: false, confidence: 'none', matchLevel: 0, matchReason: 'Same Record', badgeText: '', score: 0 };
  }

  // Supporting secondary identifiers
  const contactA = getCanonicalContactInfo(recA);
  const contactB = getCanonicalContactInfo(recB);

  const sameEmail = Boolean(contactA.email && contactB.email && contactA.email === contactB.email);
  const samePhone = Boolean(contactA.phone && contactB.phone && contactA.phone === contactB.phone);
  const sameContact = sameEmail || samePhone;

  const bdayA = getCanonicalBirthdate(recA);
  const bdayB = getCanonicalBirthdate(recB);
  const sameBirthdate = Boolean(bdayA && bdayB && bdayA === bdayB);

  const rawSeqIdA = getCanonicalIdNumber(recA).replace(/^SRC\s*/i, '').trim();
  const rawSeqIdB = getCanonicalIdNumber(recB).replace(/^SRC\s*/i, '').trim();
  const sameSeqId = Boolean(rawSeqIdA && rawSeqIdB && rawSeqIdA === rawSeqIdB);

  const hasSecondaryInfo = sameBirthdate || sameContact || sameSeqId;

  // Name comparisons & Levenshtein / Token Fuzzy metrics
  const normA = cA.normalizedName;
  const normB = cB.normalizedName;
  const noSpaceA = normA.replace(/\s+/g, '');
  const noSpaceB = normB.replace(/\s+/g, '');

  const isExactName = normA === normB;
  const isNoSpacesNameMatch = noSpaceA === noSpaceB;

  // Sorted token comparison (handles "LastName, FirstName" vs "FirstName LastName")
  const isReversedName = cA.sortedTokens.length >= 2 && cB.sortedTokens.length >= 2 && cA.sortedTokens.join(' ') === cB.sortedTokens.join(' ');

  // Token Overlap (Jaccard & Count)
  const setB = new Set(cB.tokens);
  const commonTokens = cA.tokens.filter(t => setB.has(t));
  const tokenOverlapCount = commonTokens.length;
  const minTokensLen = Math.min(cA.tokens.length, cB.tokens.length);

  // Levenshtein distance
  const dist = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  const levSim = maxLen > 0 ? 1 - dist / maxLen : 0;

  // First / Last token checks
  const firstA = cA.tokens[0] || '';
  const lastA = cA.tokens[cA.tokens.length - 1] || '';
  const firstB = cB.tokens[0] || '';
  const lastB = cB.tokens[cB.tokens.length - 1] || '';

  const sameFirstLast = cA.tokens.length >= 2 && cB.tokens.length >= 2 && firstA === firstB && lastA === lastB;

  const firstDist = levenshteinDistance(firstA, firstB);
  const lastDist = levenshteinDistance(lastA, lastB);
  const fuzzyFirstLast = cA.tokens.length >= 2 && cB.tokens.length >= 2 && firstDist <= 1 && lastDist <= 1;

  // Fuzzy Name Match flag
  const hasFuzzyNameMatch =
    isExactName ||
    isNoSpacesNameMatch ||
    isReversedName ||
    sameFirstLast ||
    fuzzyFirstLast ||
    levSim >= 0.70 ||
    (dist <= 4 && maxLen >= 6) ||
    (tokenOverlapCount >= 2 && minTokensLen >= 2) ||
    (tokenOverlapCount >= 1 && (firstDist <= 1 || lastDist <= 1));

  // LEVEL 1 / 2: Exact Canonical Full Name or Space-Insensitive Match
  if (isExactName || isNoSpacesNameMatch) {
    const sameFields =
      cA.rawFirstName.toLowerCase() === cB.rawFirstName.toLowerCase() &&
      cA.rawLastName.toLowerCase() === cB.rawLastName.toLowerCase() &&
      Boolean(cA.rawFirstName && cA.rawLastName);

    let secondaryDetail = '';
    if (sameBirthdate && sameContact) secondaryDetail = ' (Same DOB & Contact)';
    else if (sameBirthdate) secondaryDetail = ' (Same DOB)';
    else if (samePhone) secondaryDetail = ' (Same Phone)';
    else if (sameEmail) secondaryDetail = ' (Same Email)';

    const matchReason = (sameEmail || sameSeqId || samePhone || sameBirthdate)
      ? `Exact Full Name & Secondary Identifier Match${secondaryDetail}`
      : sameFields
      ? 'Exact Canonical Full Name Match'
      : 'Same Name Tokens / Field Mismatch';

    const badgeText = sameBirthdate ? 'Exact Name + DOB' : sameFields ? 'Exact Match' : 'Field Mismatch';

    return {
      isMatch: true,
      confidence: 'high',
      matchLevel: sameFields ? 1 : 2,
      matchReason,
      badgeText,
      score: 1.0,
    };
  }

  // LEVEL 3: Reversed Name Order
  if (isReversedName) {
    const secondaryDetail = sameBirthdate ? ' (Same DOB)' : samePhone ? ' (Same Phone)' : sameEmail ? ' (Same Email)' : '';
    return {
      isMatch: true,
      confidence: 'high',
      matchLevel: 3,
      matchReason: `Reversed Name Order${secondaryDetail}`,
      badgeText: sameBirthdate ? 'Reversed Name + DOB' : 'Reversed Name',
      score: 0.98,
    };
  }

  // LEVEL 4: Middle Name / Initial Variation (First & Last match)
  if (sameFirstLast) {
    const schoolA = String(recA.school_name || recA.schoolName || recA.school || '').toLowerCase().trim();
    const schoolB = String(recB.school_name || recB.schoolName || recB.school || '').toLowerCase().trim();
    const sameSchool = Boolean(schoolA && schoolB && schoolA === schoolB);

    const secondaryDetail = sameBirthdate ? ' & Same DOB' : samePhone ? ' & Same Phone' : sameEmail ? ' & Same Email' : sameSchool ? ' & Same School' : '';

    return {
      isMatch: true,
      confidence: (sameEmail || sameSeqId || samePhone || sameBirthdate || sameSchool) ? 'high' : 'medium',
      matchLevel: 4,
      matchReason: `Middle Name / Initial Variation${secondaryDetail}`,
      badgeText: sameBirthdate ? 'Middle Name + DOB' : 'Middle Name Variation',
      score: 0.92,
    };
  }

  // LEVEL 5: Fuzzy Name Match + Secondary Identifier (Birthdate / Phone / Email / Shared ID)
  if (hasFuzzyNameMatch && hasSecondaryInfo) {
    let reason = 'Fuzzy Name Match';
    let badge = 'Fuzzy Match';

    if (sameBirthdate && (samePhone || sameEmail)) {
      reason = 'Fuzzy Name Match with Same Birthdate & Contact Info';
      badge = 'DOB + Contact + Name';
    } else if (sameBirthdate) {
      reason = 'Fuzzy Name Match with Same Birthdate';
      badge = 'Same DOB + Name';
    } else if (samePhone) {
      reason = 'Fuzzy Name Match with Same Phone Number';
      badge = 'Same Phone + Name';
    } else if (sameEmail) {
      reason = 'Fuzzy Name Match with Same Email Address';
      badge = 'Same Email + Name';
    } else if (sameSeqId) {
      reason = 'Fuzzy Name Match with Shared ID Number';
      badge = 'Shared ID + Name';
    }

    return {
      isMatch: true,
      confidence: 'high',
      matchLevel: 5,
      matchReason: reason,
      badgeText: badge,
      score: Math.max(0.85, levSim),
    };
  }

  // LEVEL 6: High Secondary Match (Birthdate + Contact or Phone + Email) with moderate name similarity
  if ((sameBirthdate && sameContact) || (samePhone && sameEmail) || (sameBirthdate && sameSeqId)) {
    if (levSim >= 0.40 || tokenOverlapCount >= 1 || (cA.tokens.length === 1 && cB.tokens.length === 1)) {
      return {
        isMatch: true,
        confidence: 'high',
        matchLevel: 6,
        matchReason: sameBirthdate && sameContact
          ? 'Matching Birthdate & Contact Info (Fuzzy Name)'
          : samePhone && sameEmail
          ? 'Matching Phone & Email Address (Fuzzy Name)'
          : 'Matching Birthdate & ID Number (Fuzzy Name)',
        badgeText: 'DOB & Contact Match',
        score: 0.88,
      };
    }
  }

  // LEVEL 7: Pure Fuzzy Name Match (Levenshtein / Token Overlap) without secondary info
  if (levSim >= 0.80 || (dist <= 3 && maxLen >= 5) || (tokenOverlapCount >= 2 && minTokensLen >= 2)) {
    return {
      isMatch: true,
      confidence: levSim >= 0.88 ? 'medium' : 'low',
      matchLevel: 7,
      matchReason: 'Similar Name / Minor Typo',
      badgeText: 'Possible Duplicate',
      score: levSim,
    };
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
    const rawSeqId = getCanonicalIdNumber(rec);
    const numericalId = rawSeqId.replace(/^SRC\s*/i, '').trim();
    if (numericalId && numericalId.toUpperCase() !== 'N/A' && numericalId.toUpperCase() !== 'NONE' && numericalId !== '-') {
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
      _canonicalId: getCanonicalIdNumber(records[i]),
      _canonicalBirthdate: getCanonicalBirthdate(records[i]),
      _canonicalContact: getCanonicalContactInfo(records[i]),
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
        _canonicalId: getCanonicalIdNumber(r),
        _canonicalBirthdate: getCanonicalBirthdate(r),
        _canonicalContact: getCanonicalContactInfo(r),
      }))
    );

  return {
    duplicateIds: duplicateIdsGroups,
    similarNames: similarNameGroups,
  };
}
