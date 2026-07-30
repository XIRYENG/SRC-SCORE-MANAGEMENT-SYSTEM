import { GradeWeights, GradeCategoryKey, normalizeCategoryKey, GRADE_CATEGORY_LABELS } from "../utils/gradeCalculation";
import { normalizeScoreCategory, normalizeScoreSubject } from "../utils/scoreFieldResolver";
import { ScoreFolder } from "../types";

export type CalculationEvent = {
  eventId: string;
  category: string;
  subject: string;
  folderId: string;
  totalItems: number;
};

/**
 * Extracts all unique score events from a cohort of reviewees.
 * This infers the existence of events without needing to fetch the score_events collection.
 */
export function extractCohortEvents(
  reviewees: Record<string, any>[],
  targetFolderId?: string | string[] | null,
  validFolders?: (ScoreFolder | string)[] | null
): CalculationEvent[] {
  if (validFolders !== undefined && validFolders !== null) {
    if (validFolders.length === 0) {
      return [];
    }
  }

  const validFolderSet = validFolders && validFolders.length > 0
    ? new Set(validFolders.map(f => typeof f === 'string' ? f : f.id))
    : null;

  const eventMap = new Map<string, CalculationEvent>();
  
  for (const r of reviewees) {
    if (r.assessmentRecords) {
      for (const [eventId, record] of Object.entries(r.assessmentRecords as Record<string, any>)) {
        if (!record) continue;
        const folderId = record.scoreFolderId || record.folderId || "main";
        
        if (validFolderSet && !validFolderSet.has(folderId)) {
          continue;
        }

        const isFolderValid = !targetFolderId || targetFolderId === 'all' || (Array.isArray(targetFolderId) ? targetFolderId.includes(folderId) : folderId === targetFolderId);
        if (!isFolderValid) {
          continue;
        }
        
        if (!eventMap.has(eventId)) {
          eventMap.set(eventId, {
            eventId,
            category: normalizeScoreCategory(record.category || ""),
            subject: normalizeScoreSubject(record.subject || record.subjectCode || ""),
            folderId,
            totalItems: Number(record.totalScore || record.possiblePoints) || 100
          });
        } else {
          // Update totalItems if we find a higher one (though they should be the same)
          const existing = eventMap.get(eventId)!;
          const items = Number(record.totalScore || record.possiblePoints) || 100;
          if (items > existing.totalItems) {
            existing.totalItems = items;
          }
        }
      }
    }
    
    if (r.scoresByDate) {
      for (const [recordKey, record] of Object.entries(r.scoresByDate as Record<string, any>)) {
        if (!record || !record.scoreEventId) continue;
        const eventId = record.scoreEventId;
        const folderId = record.folderId || record.scoreFolderId || "main";
        
        if (validFolderSet && !validFolderSet.has(folderId)) {
          continue;
        }

        const isFolderValid = !targetFolderId || targetFolderId === 'all' || (Array.isArray(targetFolderId) ? targetFolderId.includes(folderId) : folderId === targetFolderId);
        if (!isFolderValid) {
          continue;
        }
        
        if (!eventMap.has(eventId)) {
          eventMap.set(eventId, {
            eventId,
            category: normalizeScoreCategory(record.category || record.categoryKey || ""),
            subject: normalizeScoreSubject(record.subject || ""),
            folderId,
            totalItems: Number(record.possiblePoints || record.totalItems) || 100
          });
        }
      }
    }
  }
  
  return Array.from(eventMap.values());
}

/**
 * Calculates a reviewee's score for a specific category and subject, correctly handling
 * "no event", "unentered event", and "actual zero".
 */
export function calculateRevieweeCategoryScore(
  reviewee: Record<string, any>,
  category: string,
  subject: string,
  cohortEvents: CalculationEvent[],
  noScoreHandling: 'include' | 'exclude'
) {
  const normCat = normalizeScoreCategory(category);
  const normSubj = normalizeScoreSubject(subject);
  
  // Find all events for this category and subject
  const relevantEvents = cohortEvents.filter(e => e.category === normCat && e.subject === normSubj);
  
  // If there are no events at all for this category/subject in the cohort, it's "no event"
  if (relevantEvents.length === 0) {
    return { hasEvent: false, hasScore: false, earned: 0, possible: 0, percentage: null };
  }
  
  let totalEarned = 0;
  let totalPossible = 0;
  let hasScore = false;
  
  for (const event of relevantEvents) {
    // Check if the reviewee has an entry for this event
    let entry = reviewee?.assessmentRecords?.[event.eventId];
    if (!entry && reviewee?.scoresByDate) {
      // Try to find by scoreEventId in scoresByDate
      entry = Object.values(reviewee.scoresByDate).find((e: any) => e && e.scoreEventId === event.eventId);
    }
    
    const earned = entry?.score ?? entry?.earnedPoints ?? entry?.rawScore;
    
    if (earned !== null && earned !== undefined && String(earned).trim() !== "") {
      // "actual zero" or actual score
      totalEarned += Number(earned);
      totalPossible += event.totalItems;
      hasScore = true;
    } else {
      // "unentered event"
      if (noScoreHandling === 'include') {
        totalPossible += event.totalItems;
      }
    }
  }
  
  // If the user has no entered scores and noScoreHandling is exclude, they have no score
  if (!hasScore && noScoreHandling === 'exclude') {
    return { hasEvent: true, hasScore: false, earned: 0, possible: 0, percentage: null };
  }
  
  return {
    hasEvent: true,
    hasScore,
    earned: totalEarned,
    possible: totalPossible > 0 ? totalPossible : 100,
    percentage: totalPossible > 0 ? (totalEarned / totalPossible) * 100 : 0
  };
}

export function calculateRevieweeAreaWithEvents(
  reviewee: Record<string, any>,
  subject: string,
  weights: GradeWeights,
  noScoreHandling: 'include' | 'exclude',
  cohortEvents: CalculationEvent[]
) {
  const categories: GradeCategoryKey[] = [
    "preboard", "pretest", "posttest", "quiz", "dailyEvaluation", "removal", "diagnostic"
  ];
  
  let totalEarned = 0;
  let totalPossible = 0;
  let finalPercentage = 0;
  let hasAnyScoresAtAll = false;
  const breakdown: any[] = [];
  
  // Calculate total active weight (only sum weights for categories that have at least one event)
  const activeWeight = categories.reduce((total, cat) => {
    const normKey = normalizeCategoryKey(cat);
    const rawWeight = weights[cat] ?? weights[normKey] ?? weights[cat.toLowerCase()] ?? 0;
    const catWeight = Math.max(0, Number(rawWeight) || 0);
    
    const catResult = calculateRevieweeCategoryScore(reviewee, cat, subject, cohortEvents, noScoreHandling);
    
    // If there is no event for this category at all, DO NOT count its weight!
    if (!catResult.hasEvent) return total;
    
    // If we are excluding unentered scores, and the user has no score, DO NOT count its weight!
    if (noScoreHandling === 'exclude' && !catResult.hasScore) return total;
    
    return total + catWeight;
  }, 0);
  
  for (const cat of categories) {
    const normKey = normalizeCategoryKey(cat);
    const rawWeight = weights[cat] ?? weights[normKey] ?? weights[cat.toLowerCase()] ?? 0;
    const catWeight = Math.max(0, Number(rawWeight) || 0);
    
    const catResult = calculateRevieweeCategoryScore(reviewee, cat, subject, cohortEvents, noScoreHandling);
    
    let catRating = 0;
    if (catResult.percentage !== null) {
      catRating = catResult.percentage;
      hasAnyScoresAtAll = true;
      totalEarned += catResult.earned;
      totalPossible += catResult.possible;
    }
    
    const contribution = activeWeight > 0 && catResult.percentage !== null
      ? catRating * (catWeight / activeWeight)
      : 0;
      
    finalPercentage += contribution;
    
    breakdown.push({
      category: cat,
      label: cat,
      earned: catResult.earned,
      possible: catResult.possible > 0 ? catResult.possible : 100,
      score: catRating,
      weight: catWeight,
      contribution,
      hasScores: catResult.hasScore,
      hasEvent: catResult.hasEvent
    });
  }
  
  if (!hasAnyScoresAtAll && noScoreHandling === 'exclude') {
    return { percentage: null, totalEarned: 0, totalPossible: 0, breakdown };
  }
  
  return {
    percentage: Math.min(100, Math.max(0, finalPercentage)),
    totalEarned,
    totalPossible: totalPossible > 0 ? totalPossible : 100,
    breakdown
  };
}

export function calculateAreaDashboardDataWithEvents(
  reviewees: Record<string, any>[],
  subject: string,
  weights: GradeWeights,
  noScoreHandling: 'include' | 'exclude',
  folderId?: string | string[] | null,
  validFolders?: (ScoreFolder | string)[] | null
) {
  const cohortEvents = extractCohortEvents(reviewees, folderId, validFolders);
  
  const individualResults = reviewees.map(reviewee => {
    const result = calculateRevieweeAreaWithEvents(reviewee, subject, weights, noScoreHandling, cohortEvents);
    return {
      revieweeId: reviewee.doc_id ?? reviewee.uid ?? reviewee.id,
      percentage: result.percentage
    };
  });
  
  const validPercentages = individualResults
    .map(r => r.percentage)
    .filter(p => p !== null && Number.isFinite(p)) as number[];
    
  const percentage = validPercentages.length > 0
    ? validPercentages.reduce((a, b) => a + b, 0) / (noScoreHandling === 'exclude' ? validPercentages.length : individualResults.length)
    : 0;
    
  return {
    percentage,
    revieweeCount: individualResults.length,
    activeRevieweeCount: validPercentages.length,
    individualResults,
    cohortEvents
  };
}
