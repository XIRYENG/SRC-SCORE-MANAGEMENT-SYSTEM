import { GradeWeights, GradeCategoryKey } from './gradeCalculation';
import { getResolvedDetailedScore, normalizeScoreCategory, normalizeScoreSubject } from './scoreFieldResolver';
import { getSchoolDisplayName } from './schoolDisplayName';
import { ScoreFolder } from '../types';

export type SchoolContribution = {
  schoolId: string;
  schoolName: string;
  revieweeCount: number;
  scoreCount: number;
  earned: number;
  possible: number;
  schoolRating: number;
  schoolShare: number;
  categoryContribution: number;
  majorAreaContribution: number;
};

export type CategoryContributionBreakdown = {
  categoryId: GradeCategoryKey;
  categoryName: string;
  categoryWeight: number;
  categoryEarned: number;
  categoryPossible: number;
  categoryRating: number;
  weightedContribution: number;
  schools: SchoolContribution[];
};

export type MajorAreaContributionBreakdown = {
  majorAreaId: string;
  majorAreaName: string;
  majorAreaRating: number;
  categoryWeightTotal: number;
  schoolCount: number;
  revieweeCount: number;
  aggregationMethod: 'Reviewee-Weighted Average' | 'Equal School Average';
  categories: CategoryContributionBreakdown[];
  schoolSummary: {
    schoolId: string;
    schoolName: string;
    categoryContributions: Record<string, number>;
    totalContribution: number;
  }[];
};

export function normalizeSchoolKey(name: string): { schoolId: string; schoolName: string } {
  if (!name || typeof name !== 'string' || !name.trim()) {
    return { schoolId: 'unassigned', schoolName: 'Unassigned School' };
  }
  const trimmed = name.trim();
  const upper = trimmed.toUpperCase();
  const clean = upper.replace(/[^A-Z0-9]/g, '');

  let schoolId = clean;
  let schoolName = getSchoolDisplayName({ normalizedName: clean, name: trimmed, schoolName: trimmed });

  if (clean.includes('CKCM') || clean.includes('CHRISTTHEKING')) {
    schoolId = 'CKCM';
    schoolName = getSchoolDisplayName({ code: 'CKCM', name: trimmed, normalizedName: clean, officialName: 'Christ the King College de Maranding, Inc.' });
  } else if (clean.includes('LSSTI') || clean.includes('LANAOSCHOOL')) {
    schoolId = 'LSSTI';
    schoolName = getSchoolDisplayName({ code: 'LSSTI', name: trimmed, normalizedName: clean });
  } else if (clean.includes('NCMC') || clean.includes('NORTHCENTRAL')) {
    schoolId = 'NCMC';
    schoolName = getSchoolDisplayName({ code: 'NCMC', name: trimmed, normalizedName: clean });
  } else if (clean.includes('CDEK') || clean.includes('COLEGIODE')) {
    schoolId = 'CDEK';
    schoolName = getSchoolDisplayName({ code: 'CDEK', name: trimmed, normalizedName: clean });
  } else if (clean.includes('SMC') || clean.includes('STMICHAEL')) {
    schoolId = 'SMC';
    schoolName = getSchoolDisplayName({ code: 'SMC', name: trimmed, normalizedName: clean });
  } else {
    schoolId = clean || 'UNASSIGNED';
    schoolName = getSchoolDisplayName({ name: trimmed, normalizedName: clean });
  }

  return { schoolId, schoolName };
}

export function calculateMajorAreaContributionBreakdown(
  reviewees: Record<string, any>[],
  majorAreaCode: string,
  majorAreaTitle: string,
  gradeWeights: GradeWeights,
  aggregationMethod: 'Reviewee-Weighted Average' | 'Equal School Average' = 'Reviewee-Weighted Average',
  selectedFolders?: ScoreFolder[]
): MajorAreaContributionBreakdown {
  const categories: GradeCategoryKey[] = ['preboard', 'pretest', 'posttest', 'quiz', 'dailyEvaluation', 'removal', 'diagnostic'];
  const categoryLabels: Record<GradeCategoryKey, string> = {
    preboard: 'Preboard',
    pretest: 'Pretest',
    posttest: 'Posttest',
    quiz: 'Quiz',
    dailyEvaluation: 'Daily Evaluation',
    removal: 'Removal',
    diagnostic: 'Diagnostic',
  };

  let categoryWeightTotal = 0;
  for (const cat of categories) {
    categoryWeightTotal += Number(gradeWeights[cat]) || 0;
  }

  const categoryBreakdowns: CategoryContributionBreakdown[] = [];
  const allSchoolMap = new Map<string, { schoolId: string; schoolName: string; totalContribution: number; catContributions: Record<string, number> }>();

  for (const cat of categories) {
    const categoryWeight = Number(gradeWeights[cat]) || 0;
    
    // Gather valid scores for this category and major area across all reviewees
    const schoolRecordsMap = new Map<string, {
      schoolId: string;
      schoolName: string;
      revieweeIds: Set<string>;
      scoreCount: number;
      earned: number;
      possible: number;
    }>();

    let categoryEarned = 0;
    let categoryPossible = 0;

    for (const r of reviewees) {
      const rawSchool = r.school || r.school_name || r.schoolName || '';
      const { schoolId, schoolName } = normalizeSchoolKey(rawSchool);
      const rId = r.doc_id || r.uid || r.id || r.seqId || Math.random().toString();

      // Check if valid score exists
      let earned: number | null = null;
      let possible: number = 0;

      if (selectedFolders && selectedFolders.length > 0) {
        let totalEarned = 0;
        let totalPossible = 0;
        let hasAnyScore = false;

        selectedFolders.forEach(folder => {
          const scoresByDate = (r as any).scoresByDate || {};
          const folderScores = Object.values(scoresByDate).filter((s: any) => {
            const entryFolder = s.folderId || s.scoreFolderId || "main";
            return entryFolder === folder.id && 
            normalizeScoreCategory(s.categoryKey || s.category) === normalizeScoreCategory(cat) &&
            normalizeScoreSubject(s.subject) === normalizeScoreSubject(majorAreaCode)
          });

          folderScores.forEach((s: any) => {
            const e = s.earnedPoints ?? s.rawScore ?? s.score;
            const p = s.possiblePoints ?? s.totalItems ?? 100;

            if (e !== null && e !== undefined && String(e).trim() !== "") {
              totalEarned += Number(e);
              totalPossible += Number(p);
              hasAnyScore = true;
            }
          });
        });

        if (hasAnyScore && totalPossible > 0) {
          earned = totalEarned;
          possible = totalPossible;
        }
      } else {
        const scoreObj = getResolvedDetailedScore(r, cat, majorAreaCode);
        earned = scoreObj.earnedScore;
        possible = scoreObj.possiblePoints;
      }

      // Valid score rule: earned is valid finite number (including 0), possible > 0
      if (earned !== null && Number.isFinite(earned) && possible > 0) {
        categoryEarned += earned;
        categoryPossible += possible;

        if (!schoolRecordsMap.has(schoolId)) {
          schoolRecordsMap.set(schoolId, {
            schoolId,
            schoolName,
            revieweeIds: new Set(),
            scoreCount: 0,
            earned: 0,
            possible: 0,
          });
        }

        const sRec = schoolRecordsMap.get(schoolId)!;
        sRec.revieweeIds.add(rId);
        sRec.scoreCount += 1;
        sRec.earned += earned;
        sRec.possible += possible;
      }
    }

    const categoryRating = categoryPossible > 0 ? (categoryEarned / categoryPossible) * 100 : 0;
    const weightedContribution = categoryRating * (categoryWeight / 100);

    const schoolsArray = Array.from(schoolRecordsMap.values());
    const validSchoolsCount = schoolsArray.length;

    const schoolContributions: SchoolContribution[] = schoolsArray.map(sRec => {
      const schoolRating = sRec.possible > 0 ? (sRec.earned / sRec.possible) * 100 : 0;
      
      let schoolShare = 0;
      if (aggregationMethod === 'Reviewee-Weighted Average') {
        schoolShare = categoryPossible > 0 ? (sRec.possible / categoryPossible) * 100 : 0;
      } else {
        // Equal School Average
        schoolShare = validSchoolsCount > 0 ? (100 / validSchoolsCount) : 0;
      }

      const categoryContribution = schoolRating * (schoolShare / 100);
      const majorAreaContribution = categoryContribution * (categoryWeight / 100);

      // Track in global school summary
      if (!allSchoolMap.has(sRec.schoolId)) {
        allSchoolMap.set(sRec.schoolId, {
          schoolId: sRec.schoolId,
          schoolName: sRec.schoolName,
          totalContribution: 0,
          catContributions: {},
        });
      }
      const globalSchool = allSchoolMap.get(sRec.schoolId)!;
      globalSchool.catContributions[cat] = majorAreaContribution;
      globalSchool.totalContribution += majorAreaContribution;

      return {
        schoolId: sRec.schoolId,
        schoolName: sRec.schoolName,
        revieweeCount: sRec.revieweeIds.size,
        scoreCount: sRec.scoreCount,
        earned: sRec.earned,
        possible: sRec.possible,
        schoolRating,
        schoolShare,
        categoryContribution,
        majorAreaContribution,
      };
    });

    categoryBreakdowns.push({
      categoryId: cat,
      categoryName: categoryLabels[cat] || cat,
      categoryWeight,
      categoryEarned,
      categoryPossible,
      categoryRating,
      weightedContribution,
      schools: schoolContributions,
    });
  }

  const majorAreaRating = categoryBreakdowns.reduce((sum, c) => sum + c.weightedContribution, 0);

  const schoolSummary = Array.from(allSchoolMap.values()).map(s => ({
    schoolId: s.schoolId,
    schoolName: s.schoolName,
    categoryContributions: s.catContributions,
    totalContribution: s.totalContribution,
  }));

  const uniqueRevieweesCount = new Set(reviewees.map(r => r.doc_id || r.uid || r.id)).size;
  const uniqueSchoolsCount = allSchoolMap.size;

  return {
    majorAreaId: majorAreaCode,
    majorAreaName: majorAreaTitle,
    majorAreaRating,
    categoryWeightTotal,
    schoolCount: uniqueSchoolsCount,
    revieweeCount: uniqueRevieweesCount,
    aggregationMethod,
    categories: categoryBreakdowns,
    schoolSummary,
  };
}
