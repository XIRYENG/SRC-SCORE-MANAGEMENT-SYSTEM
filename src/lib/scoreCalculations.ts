export type ScoreValue = {
  earned: number | null | undefined;
  totalItems: number | null | undefined;
  published?: boolean;
};

export type AggregatedAreaRating = {
  totalEarned: number;
  totalPossible: number;
  rating: number | null;
  completedCount: number;
};

export function calculateAggregatedAreaRating(
  scores: ScoreValue[],
): AggregatedAreaRating {
  let totalEarned = 0;
  let totalPossible = 0;
  let completedCount = 0;

  for (const score of scores) {
    if (score.published === false) {
      continue;
    }

    const earned =
      Number(score.earned);

    const totalItems =
      Number(score.totalItems);

    if (
      !Number.isFinite(earned) ||
      !Number.isFinite(totalItems) ||
      earned < 0 ||
      totalItems <= 0
    ) {
      continue;
    }

    totalEarned += earned;
    totalPossible += totalItems;
    completedCount += 1;
  }

  return {
    totalEarned,
    totalPossible,
    rating:
      totalPossible > 0
        ? (
            totalEarned /
            totalPossible
          ) * 100
        : null,
    completedCount,
  };
}
