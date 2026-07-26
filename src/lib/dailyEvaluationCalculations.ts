export type SingleScoreEntry = {
  earned: number | null;
  possible: number | null;
};

export type AggregateResult = {
  totalEarned: number;
  totalPossible: number;
  rating: number | null; // percentage e.g. 72.73 or null if no valid scores
  ratingFormatted: string; // "72.73%" or "N/A"
  combinedFormatted: string; // "120/165" or "0/0"
  validCount: number;
  missingCount: number;
};

/**
 * Calculates aggregate earned, total possible, and rating percentage
 * strictly excluding missing scores (where earned === null).
 * Saved zero scores (earned === 0) are included in the denominator and numerator.
 */
export function calculateDailyEvaluationAggregate(scores: SingleScoreEntry[]): AggregateResult {
  let totalEarned = 0;
  let totalPossible = 0;
  let validCount = 0;
  let missingCount = 0;

  scores.forEach(s => {
    if (s.earned !== null && s.earned !== undefined && !isNaN(s.earned)) {
      const possible = s.possible !== null && s.possible !== undefined && !isNaN(s.possible) && s.possible > 0
        ? s.possible
        : 100;
      
      totalEarned += s.earned;
      totalPossible += possible;
      validCount++;
    } else {
      missingCount++;
    }
  });

  if (validCount === 0 || totalPossible === 0) {
    return {
      totalEarned: 0,
      totalPossible: 0,
      rating: null,
      ratingFormatted: 'N/A',
      combinedFormatted: '0/0',
      validCount: 0,
      missingCount,
    };
  }

  const rating = (totalEarned / totalPossible) * 100;

  return {
    totalEarned,
    totalPossible,
    rating,
    ratingFormatted: `${rating.toFixed(2)}%`,
    combinedFormatted: `${totalEarned}/${totalPossible}`,
    validCount,
    missingCount,
  };
}
