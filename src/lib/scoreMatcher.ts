export type MatchMethod =
  | 'ID_EXACT_NAME_VERIFIED'
  | 'ID_EXACT_NAME_PARTIAL'
  | 'NAME_EXACT_UNIQUE'
  | 'MANUAL_SELECTION'
  | 'NONE';

import { getCanonicalFullName } from '../utils/nameNormalization';
import { resolveCanonicalUserIdentity } from '../services/userIdentityResolver';
import { ScoreFolder } from '../types';
import { isRevieweeInFolderScope } from '../utils/folderScope';
import { normalizeScoreCategory, normalizeScoreSubject, normalizeEvaluationDate } from '../utils/scoreFieldResolver';

export type RowStatus =
  | 'READY'
  | 'ID_NAME_CONFLICT'
  | 'ID_NOT_FOUND'
  | 'ID_NOT_FOUND_NAME_MATCH'
  | 'AMBIGUOUS_NAME'
  | 'INVALID_ID'
  | 'INVALID_NAME'
  | 'INVALID_SCORE'
  | 'DUPLICATE_CSV_ID'
  | 'DUPLICATE_DATABASE_ID'
  | 'EXISTING_SCORE'
  | 'ALREADY_IMPORTED'
  | 'OUTSIDE_FOLDER_SCOPE';

export interface CsvParsedRow {
  rowNum: number;
  importRowId?: string | number;
  csvFirst: string;
  csvLast: string;
  csvStudentId: string;
  csvFullName: string;
  earnedPoints: number | null;
  possiblePoints: number | null;
  percentage: number | null;
  rawEarnedPoints: string;
  rawPossiblePoints: string;
  matchedUser: any | null;
  matchedUserId: string | null;
  matchedUserName: string | null;
  matchedRevieweeDocumentId?: string | null;
  matchedRevieweeUid?: string | null;
  matchedOfficialIdNumber?: string | null;
  matchedRevieweeId?: string | null;
  matchMethod: MatchMethod;
  status: RowStatus;
  remarks: string;
  possibleMatches: any[];
  updateData?: any;
  scoreRecordKey?: string;
}

export interface ProcessCsvResult {
  headerValidation: { isValid: boolean; missingColumns: string[] };
  processedRows: CsvParsedRow[];
  summary: {
    totalRows: number;
    readyCount: number;
    exactIdMatches: number;
    nameFallbackMatches: number;
    conflictCount: number;
    unmatchedCount: number;
    invalidScoreCount: number;
    duplicateCsvIdCount: number;
    duplicateDbIdCount: number;
    existingScoreCount: number;
    outsideFolderScopeCount: number;
  };
}

export function normalizeStudentId(value: unknown): string {
  if (value === null || value === undefined) return "";
  let normalized = String(value).trim();

  // Remove spreadsheet decimal suffix such as 102626.0 or 102626.00
  normalized = normalized.replace(/\.0+$/, "");

  // Remove spaces, hyphens, underscores, dots, and hash symbols
  normalized = normalized.replace(/[\s\-_\.#]/g, "");

  // Remove leading '#', 'SRC', 'SRC-', 'ID-', 'ID' prefix if present
  normalized = normalized.replace(/^[#]/, "");
  normalized = normalized.replace(/^(SRC|ID)-?/i, "");

  return normalized.toUpperCase();
}

export function normalizeCkcmId(value: unknown): string {
  let id = normalizeStudentId(value);
  const fullYearMatch = id.match(/^2026(\d{4,5})$/);
  if (fullYearMatch) {
    return `26${fullYearMatch[1]}`;
  }
  return id;
}

export function getCanonicalRevieweeIds(user: any): string[] {
  if (!user) return [];
  const candidateValues = [
    user.idNumber,
    user.id_number,
    user.studentId,
    user.student_id,
    user.revieweeId,
    user.reviewee_id,
    user.seqId,
    user.seq_id,
    user.pin,
    user.srcId,
    user.src_id,
    user.customId,
    user.custom_id,
    user.zipgradeId,
    user.zipgrade_id,
    user.doc_id,
    user.uid
  ];

  const set = new Set<string>();
  for (const raw of candidateValues) {
    if (raw !== null && raw !== undefined && String(raw).trim() !== "") {
      const norm1 = normalizeStudentId(raw);
      if (norm1) set.add(norm1);
      const norm2 = normalizeCkcmId(raw);
      if (norm2) set.add(norm2);
    }
  }
  return Array.from(set);
}

export function normalizeName(value: unknown): string {
  if (value === null || value === undefined) return "";
  let str = String(value).trim();
  if (!str) return "";

  // Normalize diacritics and replace Ñ/ñ
  str = str
    .replace(/Ñ/g, "N")
    .replace(/ñ/g, "n")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  return str
    .toUpperCase()
    .replace(/[.,'’`"-]/g, " ")
    .replace(/\b(JR|SR|II|III|IV|V|VI|VII|VIII|IX|X|DR|MR|MS|MRS)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function compactName(value: string): string {
  return normalizeName(value).replace(/\s+/g, "");
}

export function nameTokens(value: string): string[] {
  return normalizeName(value)
    .split(" ")
    .filter(Boolean);
}

export function firstNamesCompatible(csvFirst: string, savedFirst: string): boolean {
  const csvTokens = nameTokens(csvFirst);
  const savedTokens = nameTokens(savedFirst);

  if (!csvTokens.length || !savedTokens.length) return false;

  const csvSet = new Set(csvTokens);
  const savedSet = new Set(savedTokens);

  // 1. Full token subset match (e.g. "JUAN" vs "JUAN CARLOS")
  const csvContained = csvTokens.every(token => savedSet.has(token));
  const savedContained = savedTokens.every(token => csvSet.has(token));

  if (csvContained || savedContained) return true;

  // 2. Primary given name token match
  const primaryCsvToken = csvTokens[0];
  const primarySavedToken = savedTokens[0];

  if (primaryCsvToken === primarySavedToken) {
    return true;
  }

  // 3. Any significant token overlap (>2 chars)
  const commonTokens = csvTokens.filter(t => savedSet.has(t) && t.length > 2);
  if (commonTokens.length >= 1) return true;

  return false;
}

export function lastNamesCompatible(csvLast: string, savedLast: string): boolean {
  const normCsv = normalizeName(csvLast);
  const normSaved = normalizeName(savedLast);

  if (!normCsv || !normSaved) return false;

  if (normCsv === normSaved) return true;
  if (compactName(csvLast) === compactName(savedLast)) return true;

  const csvTokens = nameTokens(csvLast);
  const savedTokens = nameTokens(savedLast);

  const significantCsv = csvTokens.filter(t => t.length > 2 && !['DE', 'LA', 'DEL', 'DELA', 'SAN', 'SANTA', 'LOS', 'LAS'].includes(t));
  const significantSaved = savedTokens.filter(t => t.length > 2 && !['DE', 'LA', 'DEL', 'DELA', 'SAN', 'SANTA', 'LOS', 'LAS'].includes(t));

  if (significantCsv.length > 0 && significantSaved.length > 0) {
    const hasCommonSurname = significantCsv.some(t => significantSaved.includes(t));
    if (hasCommonSurname) return true;
  }

  return false;
}

export function isNameCompatible(
  csvFirst: string,
  csvLast: string,
  savedFirst: string,
  savedLast: string,
  savedMiddle: string = ""
): { compatible: true; matchType: 'ID_EXACT_NAME_VERIFIED' | 'ID_EXACT_NAME_PARTIAL' } | { compatible: false; matchType: 'NONE' } {
  const normCsvFirst = normalizeName(csvFirst);
  const normCsvLast = normalizeName(csvLast);
  const normSavedFirst = normalizeName(savedFirst);
  const normSavedLast = normalizeName(savedLast);

  if (normCsvFirst === normSavedFirst && normCsvLast === normSavedLast) {
    return { compatible: true, matchType: 'ID_EXACT_NAME_VERIFIED' };
  }

  const lastNameOk = lastNamesCompatible(csvLast, savedLast);

  const fullSavedGiven = `${savedFirst} ${savedMiddle}`.trim();
  const firstNameOk = firstNamesCompatible(csvFirst, savedFirst) || firstNamesCompatible(csvFirst, fullSavedGiven);

  if (lastNameOk && firstNameOk) {
    return { compatible: true, matchType: 'ID_EXACT_NAME_PARTIAL' };
  }

  // Token overlap across full name if first/last split was ambiguous
  const csvFullTokens = nameTokens(`${csvFirst} ${csvLast}`);
  const savedFullTokens = nameTokens(`${savedFirst} ${savedMiddle} ${savedLast}`);

  if (csvFullTokens.length >= 2 && savedFullTokens.length >= 2) {
    const savedTokenSet = new Set(savedFullTokens);
    const matchedTokenCount = csvFullTokens.filter(t => savedTokenSet.has(t) && t.length > 2).length;
    if (matchedTokenCount >= 2) {
      return { compatible: true, matchType: 'ID_EXACT_NAME_PARTIAL' };
    }
  }

  return { compatible: false, matchType: 'NONE' };
}

export function parseScore(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim().replace(/,/g, "");
  if (!cleaned) return null;
  const score = Number(cleaned);
  return Number.isFinite(score) ? score : null;
}

export function normalizeHeader(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function extractCsvRowData(row: Record<string, any>) {
  const getVal = (possibleKeys: string[]): string => {
    for (const k of Object.keys(row)) {
      const cleanK = normalizeHeader(k).replace(/[^a-z0-9]/g, '');
      for (const target of possibleKeys) {
        if (cleanK === target.toLowerCase().replace(/[^a-z0-9]/g, '')) {
          const val = row[k];
          if (val !== undefined && val !== null && String(val).trim() !== '') {
            return String(val).trim();
          }
        }
      }
    }
    return '';
  };

  let csvFirst = getVal(['student first name', 'first name', 'firstname', 'fname', 'first', 'givenname', 'given name']);
  let csvLast = getVal(['student last name', 'last name', 'lastname', 'lname', 'last', 'surname', 'family name']);
  const fullName = getVal(['student name', 'full name', 'name', 'student', 'reviewee name', 'revieweename']);
  const csvStudentId = getVal(['student id', 'studentid', 'customid', 'zipgradeid', 'zipgrade id', 'externalid', 'seqid', 'seq id', 'id', 'idnumber', 'student_id', 'pin']);
  let rawEarned = getVal(['earned points', 'earnedpoints', 'earnedpts', 'earned pts', 'pointsearned', 'earned', 'points', 'score', 'totalscore', 'total score', 'rawscore']);
  let rawPossible = getVal(['possible points', 'possiblepoints', 'possiblepts', 'possible pts', 'total points', 'total score', 'max score', 'maxscore']);

  if ((!csvFirst || !csvLast) && fullName) {
    if (fullName.includes(',')) {
      const parts = fullName.split(',').map(s => s.trim());
      if (!csvLast) csvLast = parts[0] || '';
      if (!csvFirst) csvFirst = parts[1] || '';
    } else {
      const parts = fullName.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        if (!csvLast) csvLast = parts[parts.length - 1];
        if (!csvFirst) csvFirst = parts.slice(0, parts.length - 1).join(' ');
      } else if (parts.length === 1) {
        if (!csvLast) csvLast = parts[0];
      }
    }
  }

  if (!rawEarned) {
    for (const k of Object.keys(row)) {
      const cleanK = normalizeHeader(k).replace(/[^a-z0-9]/g, '');
      if (cleanK.includes('earned') || cleanK.includes('score') || cleanK.includes('points') || cleanK.includes('pts')) {
        const val = row[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          rawEarned = String(val).trim();
          break;
        }
      }
    }
  }

  return { csvFirst, csvLast, csvStudentId, rawEarned, rawPossible };
}

export function validateCsvHeaders(headers: string[]): { isValid: boolean; missingColumns: string[] } {
  const normHeaders = headers.map(h => normalizeHeader(h).replace(/[^a-z0-9]/g, ''));

  const missingColumns: string[] = [];

  const hasFirstName = normHeaders.some(h => ['studentfirstname', 'firstname', 'fname', 'first', 'givenname'].some(k => h === k || h.includes(k)));
  const hasLastName = normHeaders.some(h => ['studentlastname', 'lastname', 'lname', 'last', 'surname'].some(k => h === k || h.includes(k)));
  const hasFullName = normHeaders.some(h => ['fullname', 'studentname', 'name', 'student'].some(k => h === k || h === 'name'));

  if (!hasFirstName && !hasFullName) {
    missingColumns.push('Student First Name / Name');
  }
  if (!hasLastName && !hasFullName) {
    missingColumns.push('Student Last Name / Name');
  }

  const hasId = normHeaders.some(h => ['studentid', 'customid', 'zipgradeid', 'seqid', 'idnumber', 'student_id', 'id', 'pin', 'externalid'].some(k => h === k || h.includes(k)));
  if (!hasId) {
    missingColumns.push('Student ID');
  }

  const hasEarned = normHeaders.some(h => ['earnedpoints', 'earnedpts', 'points', 'score', 'rawscore', 'earned', 'totalscore'].some(k => h === k || h.includes(k)));
  if (!hasEarned) {
    missingColumns.push('Earned Points / Score');
  }

  return {
    isValid: missingColumns.length === 0,
    missingColumns
  };
}

export function processCsvRows(
  csvData: any[],
  headers: string[],
  allUsers: any[],
  selectedSubject: string,
  selectedCategory: string,
  selectedDate: string,
  scoreFolder?: ScoreFolder | null
): ProcessCsvResult {
  // 1. Header Validation
  const headerValidation = validateCsvHeaders(headers);
  if (!headerValidation.isValid) {
    return {
      headerValidation,
      processedRows: [],
      summary: {
        totalRows: csvData.length,
        readyCount: 0,
        exactIdMatches: 0,
        nameFallbackMatches: 0,
        conflictCount: 0,
        unmatchedCount: 0,
        invalidScoreCount: 0,
        duplicateCsvIdCount: 0,
        duplicateDbIdCount: 0,
        existingScoreCount: 0,
        outsideFolderScopeCount: 0
      }
    };
  }

  // 2. Filter eligible reviewee users (exclude admin, staff, archived, deleted)
  const eligibleUsers = (allUsers || []).filter(u => {
    const role = String(u.role || '').toLowerCase();
    if (role === 'admin' || role === 'staff') return false;
    if (u.is_archived || u.isArchived || u.is_deleted || u.isDeleted) return false;
    return true;
  });

  // 3. Build in-memory ID map
  const revieweesByIdMap = new Map<string, any[]>();
  for (const user of eligibleUsers) {
    const ids = getCanonicalRevieweeIds(user);
    for (const idKey of ids) {
      if (!idKey) continue;
      const existing = revieweesByIdMap.get(idKey) || [];
      if (!existing.some(u => (u.doc_id || u.uid) === (user.doc_id || user.uid))) {
        existing.push(user);
      }
      revieweesByIdMap.set(idKey, existing);
    }
  }

  // Determine score field names
  const fieldMatch = selectedSubject.trim().toUpperCase();
  const categoryMatch = selectedCategory.trim().toLowerCase().replace(/\s+/g, '');
  let scoreField = '';
  if (categoryMatch === 'preboard') {
    scoreField = `preboard_${fieldMatch.toLowerCase()}`;
  } else if (categoryMatch === 'pretest' || categoryMatch === 'diagnostic') {
    scoreField = `diag_${fieldMatch.toLowerCase()}`;
  } else if (categoryMatch === 'posttest' || categoryMatch === 'post') {
    scoreField = `post_${fieldMatch.toLowerCase()}`;
  } else {
    scoreField = `score_${fieldMatch.toLowerCase()}_${categoryMatch}`;
  }

  const answerPrefix = `${categoryMatch}_${fieldMatch.toLowerCase()}`;
  const normalizedDateKey = selectedDate.replace(/\//g, '-');
  const normalizedCategoryKey = categoryMatch.toLowerCase().replace(/[^a-z0-9]/g, '');

  // 4. Pre-scan for Duplicate CSV IDs
  const csvIdCounts = new Map<string, number>();
  for (const row of csvData) {
    const extracted = extractCsvRowData(row);
    const normId = normalizeStudentId(extracted.csvStudentId);
    if (normId) {
      csvIdCounts.set(normId, (csvIdCounts.get(normId) || 0) + 1);
    }
  }

  const processedRows: CsvParsedRow[] = [];

  let exactIdMatches = 0;
  let nameFallbackMatches = 0;
  let conflictCount = 0;
  let unmatchedCount = 0;
  let invalidScoreCount = 0;
  let duplicateCsvIdCount = 0;
  let duplicateDbIdCount = 0;
  let existingScoreCount = 0;
  let outsideFolderScopeCount = 0;
  let readyCount = 0;

  for (let idx = 0; idx < csvData.length; idx++) {
    const row = csvData[idx];
    const rowNum = idx + 1;

    const extracted = extractCsvRowData(row);
    const csvFirst = extracted.csvFirst;
    const csvLast = extracted.csvLast;
    const csvStudentId = extracted.csvStudentId;
    const normId = normalizeStudentId(csvStudentId);
    const ckcmId = normalizeCkcmId(csvStudentId);

    const rawEarnedPoints = extracted.rawEarned;
    const rawPossiblePoints = extracted.rawPossible;

    const earnedPoints = parseScore(rawEarnedPoints);
    const possiblePoints = parseScore(rawPossiblePoints) ?? 100;

    let percentage: number | null = null;
    if (earnedPoints !== null && possiblePoints > 0) {
      percentage = (earnedPoints / possiblePoints) * 100;
    }

    const csvFullName = csvLast && csvFirst 
      ? `${csvLast}, ${csvFirst}` 
      : (csvFirst || csvLast || csvStudentId || 'Unknown');

    let matchedUser: any | null = null;
    let matchMethod: MatchMethod = 'NONE';
    let status: RowStatus = 'ID_NOT_FOUND';
    let remarks = '';
    let possibleMatchesList: any[] = [];

    // --- SCORE VALIDATION ---
    const isEarnedBlank = rawEarnedPoints === null || rawEarnedPoints === undefined || String(rawEarnedPoints).trim() === '';
    const isScoreInvalid = 
      isEarnedBlank ||
      earnedPoints === null || 
      isNaN(earnedPoints) || 
      earnedPoints < 0 || 
      (possiblePoints !== null && (possiblePoints <= 0 || earnedPoints > possiblePoints));

    if (isEarnedBlank) {
      status = 'INVALID_SCORE';
      remarks = `Blank earned score in CSV. Score entries cannot be empty.`;
      invalidScoreCount++;
    } else if (isScoreInvalid) {
      status = 'INVALID_SCORE';
      remarks = `Invalid score: Earned=${rawEarnedPoints || 'blank'}, Possible=${rawPossiblePoints || 'blank'}`;
      invalidScoreCount++;
    } else {
      // --- DUPLICATE CSV ID CHECK ---
      if (normId && (csvIdCounts.get(normId) || 0) > 1) {
        status = 'DUPLICATE_CSV_ID';
        remarks = `Duplicate Student ID '${normId}' in uploaded CSV.`;
        duplicateCsvIdCount++;
      } else {
        // --- MATCHING LOGIC ---
        // Step 1: Look up by ID
        let candidatesForId: any[] = [];
        if (normId) {
          const m1 = revieweesByIdMap.get(normId) || [];
          const m2 = revieweesByIdMap.get(ckcmId) || [];
          const combinedMap = new Map<string, any>();
          for (const u of [...m1, ...m2]) {
            const uDocId = u.doc_id || u.documentId || u.id || u.uid;
            combinedMap.set(uDocId, u);
          }
          candidatesForId = Array.from(combinedMap.values());
        }

        if (candidatesForId.length > 1) {
          status = 'DUPLICATE_DATABASE_ID';
          remarks = `Multiple accounts share ID '${normId}' in database.`;
          duplicateDbIdCount++;
        } else if (candidatesForId.length === 1) {
          const dbUser = candidatesForId[0];
          const dbCanonical = getCanonicalFullName(dbUser);
          const dbFirst = dbCanonical.firstName;
          const dbLast = dbCanonical.lastName;
          const dbMiddle = dbCanonical.middleName;

          const nameCheck = isNameCompatible(csvFirst, csvLast, dbFirst, dbLast, dbMiddle);

          if (nameCheck.compatible) {
            matchedUser = dbUser;
            matchMethod = nameCheck.matchType;
            status = 'READY';
            remarks = `Matched by Student ID '${normId}' and verified name.`;
            exactIdMatches++;
          } else {
            status = 'ID_NAME_CONFLICT';
            remarks = `ID '${normId}' matches '${dbCanonical.displayName}' in DB, but CSV name is '${csvFullName}'.`;
            conflictCount++;
          }
        } else {
          // Step 2: ID not found -> Controlled Name Fallback
          const nameMatches = eligibleUsers.filter(u => {
            const canonical = getCanonicalFullName(u);
            const dbFirst = canonical.firstName;
            const dbLast = canonical.lastName;
            const dbMiddle = canonical.middleName;
            return isNameCompatible(csvFirst, csvLast, dbFirst, dbLast, dbMiddle).compatible;
          });

          if (nameMatches.length === 1) {
            matchedUser = nameMatches[0];
            const matchedCanonical = getCanonicalFullName(matchedUser);
            matchMethod = 'NAME_EXACT_UNIQUE';
            status = 'ID_NOT_FOUND_NAME_MATCH';
            remarks = `ID '${normId || 'N/A'}' not found, but exact name match found ('${matchedCanonical.displayName}'). Confirmation required.`;
            nameFallbackMatches++;
          } else if (nameMatches.length > 1) {
            status = 'AMBIGUOUS_NAME';
            remarks = `ID '${normId || 'N/A'}' not found and multiple accounts match name '${csvFullName}'.`;
            unmatchedCount++;
          } else {
            status = 'ID_NOT_FOUND';
            remarks = `No account found with ID '${normId || 'N/A'}' or name '${csvFullName}'.`;
            unmatchedCount++;
          }
        }
      }
    }

    possibleMatchesList = eligibleUsers.filter(u => {
      const canonical = getCanonicalFullName(u);
      const dbFirst = canonical.firstName;
      const dbLast = canonical.lastName;
      if (lastNamesCompatible(csvLast, dbLast)) return true;
      if (firstNamesCompatible(csvFirst, dbFirst)) return true;
      return false;
    }).slice(0, 5);

    // --- CHECK EXISTING SCORES ---
    const activeFolderId = scoreFolder?.id || "main";
    const normSubjKey = normalizeScoreSubject(selectedSubject);
    const normCatKey = normalizeScoreCategory(selectedCategory);
    const normDateStr = normalizeEvaluationDate(selectedDate);
    let scoreRecordKey = '';

    if (matchedUser) {
      const userDocId = matchedUser.doc_id || matchedUser.documentId || matchedUser.id || matchedUser.uid;
      scoreRecordKey = [userDocId, activeFolderId, normCatKey, normSubjKey, normSubjKey, normDateStr].filter(Boolean).join("__");
    }

    if ((status === 'READY' || status === 'ID_NOT_FOUND_NAME_MATCH') && matchedUser) {
      let existingInScoresByDate = false;
      if (matchedUser.scoresByDate && typeof matchedUser.scoresByDate === 'object') {
        if (matchedUser.scoresByDate[scoreRecordKey]) {
          existingInScoresByDate = true;
        } else {
          existingInScoresByDate = Object.values(matchedUser.scoresByDate).some((entry: any) => {
            if (!entry || typeof entry !== 'object') return false;
            const entryFolder = entry.scoreFolderId || entry.folderId || "main";
            if (entryFolder !== activeFolderId) return false;
            const entryCat = normalizeScoreCategory(entry.categoryKey || entry.category || '');
            if (entryCat !== normCatKey) return false;
            const entrySubj = normalizeScoreSubject(entry.subjectId || entry.subject || entry.majorAreaId || '');
            if (entrySubj !== normSubjKey) return false;
            const entryDate = normalizeEvaluationDate(entry.date || entry.evaluationDate);
            return entryDate === normDateStr;
          });
        }
      }

      if (existingInScoresByDate) {
        status = 'EXISTING_SCORE';
        remarks = `Score already exists for this reviewee (${selectedSubject} - ${selectedCategory} on ${normDateStr}).`;
        existingScoreCount++;
      }
    }

    // --- CHECK FOLDER SCOPE ---
    if (matchedUser && scoreFolder && !isRevieweeInFolderScope(matchedUser, scoreFolder)) {
      if (status === 'READY') {
        readyCount--;
      } else if (status === 'EXISTING_SCORE') {
        existingScoreCount--;
      }
      status = 'OUTSIDE_FOLDER_SCOPE';
      remarks = `Reviewee found (${resolveCanonicalUserIdentity(matchedUser).fullName}) but is not included in this folder's selected school or branch scope.`;
      outsideFolderScopeCount++;
    }

    if (status === 'READY') {
      readyCount++;
    }

    let updateData: any = null;
    if (earnedPoints !== null && matchedUser) {
      const userDocId = matchedUser.doc_id || matchedUser.documentId || matchedUser.id || matchedUser.uid;
      const scoreValue = Number(earnedPoints);
      
      updateData = {
        [scoreField]: String(earnedPoints),
        category: categoryMatch,
        subject: fieldMatch
      };

      updateData[`date_${fieldMatch.toLowerCase()}_${normCatKey}`] = normDateStr;

      if (normCatKey === 'pretest' || normCatKey === 'diagnostic') {
        updateData[`date_${fieldMatch.toLowerCase()}_diag`] = normDateStr;
        updateData[`date_${fieldMatch.toLowerCase()}_pretest`] = normDateStr;
      } else if (normCatKey === 'preboard') {
        updateData[`date_${fieldMatch.toLowerCase()}_preboard`] = normDateStr;
      } else if (normCatKey === 'posttest' || normCatKey === 'post') {
        updateData[`date_${fieldMatch.toLowerCase()}_posttest`] = normDateStr;
        updateData[`date_${fieldMatch.toLowerCase()}_post`] = normDateStr;
      }

      updateData[`scoresByDate.${scoreRecordKey}`] = {
        category: selectedCategory,
        categoryKey: normCatKey,
        majorAreaId: normSubjKey,
        subjectId: normSubjKey,
        subject: selectedSubject,
        score: scoreValue,
        rawScore: scoreValue,
        earnedPoints: scoreValue,
        possiblePoints: Number(possiblePoints),
        percentage: percentage !== null ? percentage : (scoreValue / Number(possiblePoints)) * 100,
        date: normDateStr,
        evaluationDate: normDateStr,
        scoreFolderId: activeFolderId,
        source: 'score_import',
        remarks: 'Imported via CSV',
        updatedAt: new Date().toISOString()
      };
      updateData[`latestScores.${normCatKey}`] = updateData[`scoresByDate.${scoreRecordKey}`];
      updateData['latestScoreUploadAt'] = new Date().toISOString();

      for (let i = 1; i <= 100; i++) {
        if (row[`Stu${i}`] !== undefined) {
          updateData[`${answerPrefix}_Stu${i}`] = String(row[`Stu${i}`]).trim().toUpperCase();
          updateData[`Stu${i}`] = String(row[`Stu${i}`]).trim().toUpperCase();
        }
        if (row[`PriKey${i}`] !== undefined) {
          updateData[`${answerPrefix}_Key${i}`] = String(row[`PriKey${i}`]).trim().toUpperCase();
          updateData[`Key${i}`] = String(row[`PriKey${i}`]).trim().toUpperCase();
        }
      }
    }

    const matchedDocId = matchedUser ? (matchedUser.doc_id || matchedUser.documentId || matchedUser.id || matchedUser.uid) : null;
    const matchedUidVal = matchedUser ? (matchedUser.uid || matchedUser.doc_id || matchedUser.documentId) : null;
    const matchedOfficialId = matchedUser ? (matchedUser.idNumber || matchedUser.id_number || matchedUser.studentId || matchedUser.student_id || matchedUser.seqId || matchedUser.seq_id || normId) : null;

    processedRows.push({
      rowNum,
      csvFirst,
      csvLast,
      csvStudentId,
      csvFullName,
      earnedPoints,
      possiblePoints,
      percentage,
      rawEarnedPoints,
      rawPossiblePoints,
      matchedUser,
      matchedUserId: matchedDocId,
      matchedUserName: matchedUser ? resolveCanonicalUserIdentity(matchedUser).fullName : null,
      matchedRevieweeDocumentId: matchedDocId,
      matchedRevieweeUid: matchedUidVal,
      matchedOfficialIdNumber: matchedOfficialId,
      matchMethod,
      status,
      remarks,
      possibleMatches: possibleMatchesList,
      updateData,
      scoreRecordKey
    });
  }

  return {
    headerValidation,
    processedRows,
    summary: {
      totalRows: csvData.length,
      readyCount,
      exactIdMatches,
      nameFallbackMatches,
      conflictCount,
      unmatchedCount,
      invalidScoreCount,
      duplicateCsvIdCount,
      duplicateDbIdCount,
      existingScoreCount,
      outsideFolderScopeCount
    }
  };
}
