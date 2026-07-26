export const levenshteinDistance = (a: string, b: string): number => {
  const tmp: number[][] = [];
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
};

export const normalizeStr = (str: string): string => {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
};

export const extractTokens = (str: string): string[] => {
  return String(str || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0);
};

export const normalizeId = (id: string | number): string => {
  const s = String(id || '').trim();
  if (!s) return '';
  // Strip non-digits or non-alphanumeric, remove leading zeros for numeric comparison
  const digitsOnly = s.replace(/\D/g, '').replace(/^0+/, '');
  if (digitsOnly) return digitsOnly;
  return s.toLowerCase().replace(/[^a-z0-9]/g, '');
};

export const isIdMatch = (csvId: string | number, user: any): boolean => {
  if (!csvId) return false;
  const targetId = normalizeId(csvId);
  if (!targetId) return false;

  const candidateIds = [
    user.seq_id,
    user.seq_num,
    user.student_id,
    user.id,
    user.doc_id,
    user.uid,
    user.pin
  ].filter(Boolean);

  for (const cand of candidateIds) {
    const candNorm = normalizeId(cand);
    if (candNorm && candNorm === targetId) {
      return true;
    }
  }
  return false;
};

export const calculateNameMatchScore = (csvName: string, user: any): number => {
  if (!csvName) return 0;

  const uFirst = user.first_name || user.firstName || '';
  const uLast = user.last_name || user.lastName || '';
  const uMiddle = user.middle_name || user.middleName || '';

  if (!uFirst && !uLast) return 0;

  const csvClean = csvName.toLowerCase().trim();
  const csvTokens = extractTokens(csvClean);
  const uFirstTokens = extractTokens(uFirst);
  const uLastTokens = extractTokens(uLast);
  const uAllTokens = [...uFirstTokens, ...uLastTokens, ...extractTokens(uMiddle)];

  if (csvTokens.length === 0 || uAllTokens.length === 0) return 0;

  // Check if CSV has comma format: "LASTNAME, FIRSTNAME"
  if (csvClean.includes(',')) {
    const parts = csvClean.split(',');
    const csvLast = parts[0].trim();
    const csvFirst = parts.slice(1).join(' ').trim();

    const csvLastToks = extractTokens(csvLast);
    const csvFirstToks = extractTokens(csvFirst);

    const lastMatch = uLastTokens.length > 0 && uLastTokens.every(t => csvLastToks.includes(t) || csvLast.includes(t));
    const firstMatch = uFirstTokens.length > 0 && uFirstTokens.some(t => csvFirstToks.includes(t) || csvFirst.includes(t));

    if (lastMatch && firstMatch) {
      return 100;
    }
  }

  // Exact token set match (regardless of order)
  const isFirstLastInCsv = uFirstTokens.every(t => csvTokens.includes(t)) && uLastTokens.every(t => csvTokens.includes(t));
  if (isFirstLastInCsv && uFirstTokens.length > 0 && uLastTokens.length > 0) {
    return 95;
  }

  // Normalized concatenated match
  const normCsv = normalizeStr(csvClean);
  const normFirstLast = normalizeStr(uFirst + uLast);
  const normLastFirst = normalizeStr(uLast + uFirst);
  const normFull = normalizeStr(uFirst + uMiddle + uLast);
  const normFullRev = normalizeStr(uLast + uFirst + uMiddle);

  if (normCsv === normFirstLast || normCsv === normLastFirst || normCsv === normFull || normCsv === normFullRev) {
    return 100;
  }

  if (normCsv.length > 3 && (normCsv.includes(normFirstLast) || normCsv.includes(normLastFirst))) {
    return 90;
  }

  if (normFirstLast.length > 3 && normCsv.includes(normFirstLast)) {
    return 85;
  }

  // Count matching tokens
  let matchedTokens = 0;
  for (const t of uFirstTokens.concat(uLastTokens)) {
    if (t.length >= 2 && csvTokens.some(ct => ct === t || ct.includes(t) || t.includes(ct))) {
      matchedTokens++;
    }
  }

  const totalUserTokens = uFirstTokens.length + uLastTokens.length;
  if (totalUserTokens > 0 && matchedTokens === totalUserTokens) {
    return 80;
  }

  // Levenshtein on full name strings
  const dist1 = levenshteinDistance(normCsv, normFirstLast);
  const dist2 = levenshteinDistance(normCsv, normLastFirst);
  const minDist = Math.min(dist1, dist2);
  const maxLen = Math.max(normCsv.length, normFirstLast.length);

  if (maxLen > 0) {
    const similarityRatio = 1 - (minDist / maxLen);
    if (similarityRatio >= 0.70) {
      return Math.round(similarityRatio * 80);
    }
  }

  return 0;
};

export const extractCsvRowData = (row: Record<string, any>) => {
  const getVal = (possibleKeys: string[]): string => {
    for (const k of Object.keys(row)) {
      const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
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

  const studentId = getVal([
    'studentid', 'student id', 'zipgradeid', 'zipgrade id', 'customid',
    'custom id', 'externalid', 'external id', 'seqid', 'seq id', 'id',
    'idnumber', 'id number', 'student_id'
  ]);

  const firstName = getVal(['firstname', 'first name', 'fname', 'first']);
  const lastName = getVal(['lastname', 'last name', 'lname', 'last']);
  let name = getVal(['name', 'studentname', 'student name', 'student', 'fullname', 'full name', 'student_name']);

  if (!name && (firstName || lastName)) {
    name = `${lastName ? lastName + ', ' : ''}${firstName}`.trim();
  }

  let earnedPoints = getVal([
    'earnedpoints', 'earned points', 'earnedpts', 'earned pts', 'pointsearned',
    'earned', 'points', 'score', 'totalscore', 'total score', 'total', 'rawscore', 'raw score'
  ]);

  if (!earnedPoints) {
    for (const k of Object.keys(row)) {
      const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanK.includes('earned') || cleanK.includes('score') || cleanK.includes('points') || cleanK.includes('pts')) {
        const val = row[k];
        if (val !== undefined && val !== null && String(val).trim() !== '') {
          earnedPoints = String(val).trim();
          break;
        }
      }
    }
  }

  return { studentId, studentName: name, firstName, lastName, earnedPoints };
};

export const findUserForCsvRow = (
  studentId: string | number,
  studentName: string,
  allUsers: any[]
): any | null => {
  if (!allUsers || allUsers.length === 0) return null;

  const validUsers = allUsers.filter(u => !u.is_archived);

  // 1. Try ID match first
  if (studentId) {
    const idMatchedUser = validUsers.find(u => isIdMatch(studentId, u));
    if (idMatchedUser) return idMatchedUser;
  }

  // 2. Try Name match
  if (studentName) {
    let bestUser: any = null;
    let highestScore = 0;

    for (const u of validUsers) {
      const score = calculateNameMatchScore(studentName, u);
      if (score >= 70 && score > highestScore) {
        highestScore = score;
        bestUser = u;
      }
    }

    if (bestUser) return bestUser;
  }

  return null;
};

export const getPossibleMatches = (csvName: string, studentId: string | number, allUsers: any[]): any[] => {
  if (!allUsers || allUsers.length === 0) return [];
  const validUsers = allUsers.filter(u => !u.is_archived);

  return validUsers
    .map(u => {
      let score = 0;
      if (studentId && isIdMatch(studentId, u)) score += 100;
      if (csvName) {
        const nameScore = calculateNameMatchScore(csvName, u);
        score += nameScore;
      }
      const fullName = `${u.last_name || ''}, ${u.first_name || ''}`.trim();
      return { ...u, matchScore: score, fullName };
    })
    .filter(u => u.matchScore >= 30)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
};

export const getBestMatch = (input: string, choices: any[]) => {
  if (!input || !choices || choices.length === 0) return null;
  let bestMatch = null;
  let highestScore = 0;

  for (const choice of choices) {
    const score = calculateNameMatchScore(input, choice);
    if (score >= 50 && score > highestScore) {
      highestScore = score;
      bestMatch = choice;
    }
  }

  return bestMatch;
};

