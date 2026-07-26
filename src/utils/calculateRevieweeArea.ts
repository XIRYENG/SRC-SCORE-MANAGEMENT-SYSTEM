import {
  GradeWeights,
  SubjectArea,
} from "./gradeCalculation";
import {
  getResolvedDetailedScore,
} from "./scoreFieldResolver";

export function calculateRevieweeArea(
  reviewee: Record<string, any>,
  subject: SubjectArea,
  weights: GradeWeights,
) {
  const categories: (keyof GradeWeights)[] = [
    "preboard",
    "pretest",
    "posttest",
    "quiz",
    "dailyEvaluation",
    "removal",
    "diagnostic",
  ];

  let totalEarned = 0;
  let totalPossible = 0;
  let completedCount = 0;
  const breakdown: any[] = [];

  for (const cat of categories) {
    const score = getResolvedDetailedScore(reviewee, String(cat), String(subject));
    
    if (score.earnedScore !== null) {
      totalEarned += score.earnedScore;
      totalPossible += score.possiblePoints;
      completedCount += 1;
      
      const catStr = String(cat);
      breakdown.push({
        category: cat,
        label: catStr.charAt(0).toUpperCase() + catStr.slice(1),
        score: (score.earnedScore / score.possiblePoints) * 100,
        weight: Number(weights[cat]) || 0,
        contribution: 0 // Will be computed or ignored based on new formula
      });
    }
  }

  const percentage = totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0;

  return {
    percentage,
    totalEarned,
    totalPossible,
    breakdown,
  };
}

export function calculateAreaDashboardData(
  reviewees: Record<string, any>[],
  subject: SubjectArea,
  weights: GradeWeights,
) {
  const individualResults =
    reviewees.map(reviewee => ({
      revieweeId:
        reviewee.doc_id ??
        reviewee.uid ??
        reviewee.id,
      percentage:
        calculateRevieweeArea(
          reviewee,
          subject,
          weights,
        ).percentage,
    }));

  const validPercentages = individualResults
    .map(result => result.percentage)
    .filter(p => p !== null && p !== undefined && p > 0);
  
  const percentage = validPercentages.length > 0 
    ? validPercentages.reduce((a, b) => a + b, 0) / validPercentages.length 
    : 0;

  return {
    percentage,
    revieweeCount:
      individualResults.length,
    individualResults,
  };
}
