import { GradeWeights, SubjectArea, GradeCategoryKey, normalizeCategoryKey } from "./gradeCalculation";
import { getResolvedDetailedScore } from "./scoreFieldResolver";
import { 
  calculateRevieweeAreaWithEvents, 
  calculateAreaDashboardDataWithEvents, 
  extractCohortEvents 
} from "../services/scoreCalculationService";

export function calculateRevieweeArea(
  reviewee: Record<string, any>,
  subject: SubjectArea,
  weights: GradeWeights,
  noScoreHandling: 'include' | 'exclude' = 'include',
  folderId?: string | null,
  reviewees: Record<string, any>[] = [],
  validFolders?: any[] | null
) {
  // We need cohort events. If reviewees array is passed, use it. Otherwise just use the single reviewee.
  // Note: For accurate "unentered" penalties, callers should provide the full cohort or use the WithEvents functions directly.
  const cohort = reviewees.length > 0 ? reviewees : [reviewee];
  const cohortEvents = extractCohortEvents(cohort, folderId, validFolders);
  
  return calculateRevieweeAreaWithEvents(reviewee, subject, weights, noScoreHandling, cohortEvents);
}

export function calculateAreaDashboardData(
  reviewees: Record<string, any>[],
  subject: SubjectArea,
  weights: GradeWeights,
  noScoreHandling: 'include' | 'exclude' = 'include',
  folderId?: string | null,
  validFolders?: any[] | null
) {
  return calculateAreaDashboardDataWithEvents(reviewees, subject, weights, noScoreHandling, folderId, validFolders);
}
