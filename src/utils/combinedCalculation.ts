import { RevieweeData, ScoreFolder } from "../types";
import { 
  SubjectArea, 
  GradeWeights, 
  GradeCategoryKey,
  normalizeCategoryKey,
  SUBJECT_AREA_KEYS
} from "./gradeCalculation";
import { getResolvedDetailedScore } from "./scoreFieldResolver";
import { 
  extractCohortEvents, 
  calculateRevieweeCategoryScore 
} from "../services/scoreCalculationService";

export type CombineMethod = "combined_scores" | "equal_folder_average";

export interface CombinedScoreResult {
  earned: number;
  possible: number;
  rating: number; // earned / possible * 100
}

export interface RevieweeCombinedRatings {
  revieweeId: string;
  subjects: Record<SubjectArea, number>; // Weighted rating per subject
  overall: number;
}

/**
 * Accurately combines score records for a single reviewee across multiple folders.
 * Uses the "Sum of Earned / Sum of Possible" formula for each Category and Subject.
 */
export function calculateRevieweeCombinedRatings(
  reviewee: Record<string, any>,
  selectedFolders: ScoreFolder[],
  gradeWeights: GradeWeights,
  method: CombineMethod = "combined_scores",
  noScoreHandling: 'include' | 'exclude' = 'include',
  reviewees: Record<string, any>[] = []
): RevieweeCombinedRatings {
  const revieweeId = reviewee.uid || reviewee.doc_id || reviewee.id || "";
  
  const categories: GradeCategoryKey[] = [
    "preboard", "pretest", "posttest", "quiz", 
    "dailyEvaluation", "removal", "diagnostic"
  ];

  const subjectRatings: Record<SubjectArea, number> = {} as Record<SubjectArea, number>;
  let hasAnyGlobalScore = false;
  
  const folderIds = selectedFolders.map(f => f.id);
  const cohort = reviewees.length > 0 ? reviewees : [reviewee];
  
  SUBJECT_AREA_KEYS.forEach(subj => {
    let weightedSum = 0;
    
    // First calculate the total possible weight for this subject
    let takenWeight = 0;
    let hasAnyScoreForSubject = false;

    categories.forEach(cat => {
      const weight = gradeWeights[cat] ?? 0;
      if (weight <= 0) return;
      
      let hasAnyScoreForCat = false;
      
      if (method === "combined_scores") {
        const cohortEvents = extractCohortEvents(cohort, folderIds);
        const catResult = calculateRevieweeCategoryScore(reviewee, cat, subj, cohortEvents, noScoreHandling);
        
        if (noScoreHandling === 'exclude') {
          if (catResult.hasScore) {
            takenWeight += weight;
            hasAnyScoreForSubject = true;
          }
        } else {
          if (catResult.hasEvent) {
            takenWeight += weight;
            if (catResult.hasScore) hasAnyScoreForSubject = true;
          }
        }
      } else {
        // Equal folder average logic...
        // For equal folder average, we treat each folder separately.
        let folderCount = 0;
        let activeFolderWeight = 0;
        selectedFolders.forEach(folder => {
          const folderEvents = extractCohortEvents(cohort, folder.id);
          const catResult = calculateRevieweeCategoryScore(reviewee, cat, subj, folderEvents, noScoreHandling);
          
          if (noScoreHandling === 'exclude') {
            if (catResult.hasScore) {
               folderCount++;
               activeFolderWeight += 1; // Or you could average the percentages
            }
          } else {
            if (catResult.hasEvent) {
               folderCount++;
               activeFolderWeight += 1;
            }
          }
        });
        if (folderCount > 0) takenWeight += weight;
      }
    });
    
    categories.forEach(cat => {
      const weight = gradeWeights[cat] ?? 0;
      if (weight <= 0) return;

      let categoryRating = 0;
      let hasAnyScore = false;

      if (method === "combined_scores") {
        const cohortEvents = extractCohortEvents(cohort, folderIds);
        const catResult = calculateRevieweeCategoryScore(reviewee, cat, subj, cohortEvents, noScoreHandling);
        
        if (catResult.percentage !== null) {
           categoryRating = catResult.percentage;
           hasAnyScore = true;
        }
      } else {
        let sumRatings = 0;
        let validFolders = 0;
        selectedFolders.forEach(folder => {
          const folderEvents = extractCohortEvents(cohort, folder.id);
          const catResult = calculateRevieweeCategoryScore(reviewee, cat, subj, folderEvents, noScoreHandling);
          
          if (catResult.percentage !== null) {
            sumRatings += catResult.percentage;
            validFolders++;
            hasAnyScore = true;
          }
        });
        if (validFolders > 0) {
          categoryRating = sumRatings / validFolders;
        }
      }

      if (hasAnyScore) {
        hasAnyGlobalScore = true;
      }

      if (takenWeight > 0 && categoryRating > 0) {
        weightedSum += categoryRating * (weight / takenWeight);
      }
    });

    subjectRatings[subj] = weightedSum;
  });

  const finalSubjects = {} as Record<SubjectArea, number>;
  SUBJECT_AREA_KEYS.forEach(subj => {
    finalSubjects[subj] = Math.min(100, Math.max(0, subjectRatings[subj] || 0));
  });

  const overall = SUBJECT_AREA_KEYS.reduce((sum, subj) => sum + finalSubjects[subj], 0) / SUBJECT_AREA_KEYS.length;

  return {
    revieweeId,
    subjects: finalSubjects,
    overall: hasAnyGlobalScore ? overall : 0
  };
}

export function calculateAggregateCombinedBreakdown(
  reviewees: Record<string, any>[],
  selectedFolders: ScoreFolder[],
  gradeWeights: GradeWeights,
  subject: SubjectArea,
  noScoreHandling: 'include' | 'exclude' = 'include'
) {
  // We can just use our new service, it calculates combined aggregates seamlessly!
  const folderIds = selectedFolders.map(f => f.id);
  const cohortEvents = extractCohortEvents(reviewees, folderIds);
  
  const individualResults = reviewees.map(reviewee => {
    return calculateRevieweeCombinedRatings(reviewee, selectedFolders, gradeWeights, "combined_scores", noScoreHandling, reviewees);
  });
  
  const validPercentages = individualResults
    .map(r => r.subjects[subject])
    .filter(p => p !== null && Number.isFinite(p));
    
  const totalPercentage = validPercentages.length > 0
    ? validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length
    : 0;
    
  // Reconstruct breakdown across cohort for the modal
  const breakdown = [];
  const categories: GradeCategoryKey[] = [
    "preboard", "pretest", "posttest", "quiz", 
    "dailyEvaluation", "removal", "diagnostic"
  ];
  
  for (const cat of categories) {
    let catTotalEarned = 0;
    let catTotalPossible = 0;
    let hasAnyScore = false;
    
    // Average rating across valid reviewees
    let ratingSum = 0;
    let validReviewees = 0;
    
    for (const r of reviewees) {
      const res = calculateRevieweeCategoryScore(r, cat, subject, cohortEvents, noScoreHandling);
      if (res.hasScore) {
        hasAnyScore = true;
      }
      if (res.percentage !== null) {
        ratingSum += res.percentage;
        validReviewees++;
        catTotalEarned += res.earned;
        catTotalPossible += res.possible;
      }
    }
    
    const catRating = validReviewees > 0 ? ratingSum / validReviewees : 0;
    const weight = gradeWeights[cat] ?? 0;
    
    breakdown.push({
      category: cat,
      label: cat,
      earned: catTotalEarned,
      possible: catTotalPossible,
      score: catRating,
      weight,
      contribution: 0, // modal calculates this based on total active weight
      hasScores: hasAnyScore,
      hasEvent: cohortEvents.some(e => e.category === cat && e.subject === subject)
    });
  }

  return {
    totalPercentage,
    breakdown
  };
}
