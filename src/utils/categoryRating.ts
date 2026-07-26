import {
  getResolvedDetailedScore,
} from "./scoreFieldResolver";

export type SubjectKey =
  | "clj"
  | "lea"
  | "crim"
  | "cdi"
  | "fs"
  | "ca";

export type SubjectWeights = Record<SubjectKey, number>;
export type SubjectScores = Record<SubjectKey, number>;
export type SubjectPercentages = Record<SubjectKey, number>;

export const CLE_SUBJECT_WEIGHTS: SubjectWeights = {
  clj: 20,
  lea: 20,
  crim: 20,
  cdi: 15,
  fs: 15,
  ca: 10,
};

export const DEFAULT_SUBJECT_WEIGHTS: SubjectWeights = CLE_SUBJECT_WEIGHTS;

export const SUBJECT_KEYS: SubjectKey[] = [
  "clj",
  "lea",
  "crim",
  "cdi",
  "fs",
  "ca",
];

export type ScoreComputation = {
  earnedScore: number | null;
  possiblePoints: number;
  rawPercentage: number;
  subjectWeight: number;
  weightedContribution: number;
};

export function clampPercentage(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return Math.min(100, Math.max(0, parsed));
}

export function calculateScorePercentage(
  earnedScore: number | null | undefined,
  totalItems: number | null | undefined
): number {
  if (
    earnedScore === null ||
    earnedScore === undefined ||
    String(earnedScore).trim() === ""
  ) {
    return 0;
  }

  const earned = Number(earnedScore);
  const total = Number(totalItems);

  if (
    !Number.isFinite(earned) ||
    !Number.isFinite(total) ||
    total <= 0
  ) {
    return 0;
  }

  if (earned < 0) {
    return 0;
  }

  return (earned / total) * 100;
}

export function getScorePercentage(
  earnedScore: number | null | undefined,
  possiblePoints: number | null | undefined
): number {
  return calculateScorePercentage(earnedScore, possiblePoints);
}

export function calculateAreaContribution(
  earnedScore: number | null | undefined,
  possiblePoints: number | null | undefined,
  subject: SubjectKey,
  weights: SubjectWeights = CLE_SUBJECT_WEIGHTS
): ScoreComputation {
  const validPossiblePoints =
    Number.isFinite(Number(possiblePoints)) &&
    Number(possiblePoints) > 0
      ? Number(possiblePoints)
      : 100;

  const hasScore =
    earnedScore !== null &&
    earnedScore !== undefined &&
    String(earnedScore).trim() !== "";

  const earned = hasScore ? Number(earnedScore) : null;
  const subjectWeight = weights[subject] ?? CLE_SUBJECT_WEIGHTS[subject] ?? 0;

  if (earned === null || !Number.isFinite(earned)) {
    return {
      earnedScore: null,
      possiblePoints: validPossiblePoints,
      rawPercentage: 0,
      subjectWeight,
      weightedContribution: 0,
    };
  }

  const rawPercentage = calculateScorePercentage(earned, validPossiblePoints);
  const weightedContribution = rawPercentage * (subjectWeight / 100);

  return {
    earnedScore: earned,
    possiblePoints: validPossiblePoints,
    rawPercentage,
    subjectWeight,
    weightedContribution,
  };
}

export function formatContribution(value: number): string {
  return `${value.toFixed(2)}%`;
}

export function formatRawPercentage(value: number): string {
  const rounded = Number(value.toFixed(2));
  return `${rounded.toFixed(2)}%`;
}

export function getCategoryScores(
  reviewee: Record<string, any>,
  category: string
): SubjectPercentages {
  const getSubjPercentage = (subj: SubjectKey) => {
    const detailed = getResolvedDetailedScore(reviewee, category, subj);
    return calculateScorePercentage(detailed.earnedScore, detailed.possiblePoints);
  };

  return {
    clj: getSubjPercentage("clj"),
    lea: getSubjPercentage("lea"),
    crim: getSubjPercentage("crim"),
    cdi: getSubjPercentage("cdi"),
    fs: getSubjPercentage("fs"),
    ca: getSubjPercentage("ca"),
  };
}

export type DetailedScore = {
  earnedScore: number | null;
  possiblePoints: number;
};

export type CategoryDetailedScores = Record<SubjectKey, DetailedScore>;

export function getCategoryDetailedScores(
  reviewee: Record<string, any>,
  category: string
): CategoryDetailedScores {
  const getSubjDetailed = (subj: SubjectKey): DetailedScore => {
    const detailed = getResolvedDetailedScore(reviewee, category, subj);
    return {
      earnedScore: detailed.earnedScore,
      possiblePoints: detailed.possiblePoints > 0 ? detailed.possiblePoints : 100,
    };
  };

  return {
    clj: getSubjDetailed("clj"),
    lea: getSubjDetailed("lea"),
    crim: getSubjDetailed("crim"),
    cdi: getSubjDetailed("cdi"),
    fs: getSubjDetailed("fs"),
    ca: getSubjDetailed("ca"),
  };
}

export function validateSubjectWeights(weights: SubjectWeights): {
  valid: boolean;
  total: number;
} {
  const total = SUBJECT_KEYS.reduce(
    (sum, subject) => sum + (Number(weights[subject]) || 0),
    0
  );

  return {
    total,
    valid: Math.abs(total - 100) < 0.001,
  };
}

export function calculateCategoryRating(
  scores: SubjectPercentages,
  weights: SubjectWeights = CLE_SUBJECT_WEIGHTS
): number {
  const rating = SUBJECT_KEYS.reduce((total, subject) => {
    const percentage = clampPercentage(scores[subject] ?? 0);
    const weight = Number(weights[subject] ?? 0);
    return total + percentage * (weight / 100);
  }, 0);

  if (!Number.isFinite(rating)) {
    return 0;
  }

  return Math.min(100, Math.max(0, rating));
}

export function calculateRatingFromDetailedScores(
  scores: CategoryDetailedScores,
  weights: SubjectWeights = CLE_SUBJECT_WEIGHTS
): {
  percentages: SubjectPercentages;
  contributions: SubjectPercentages;
  rating: number;
} {
  const percentages: SubjectPercentages = {
    clj: calculateScorePercentage(scores.clj?.earnedScore, scores.clj?.possiblePoints),
    lea: calculateScorePercentage(scores.lea?.earnedScore, scores.lea?.possiblePoints),
    crim: calculateScorePercentage(scores.crim?.earnedScore, scores.crim?.possiblePoints),
    cdi: calculateScorePercentage(scores.cdi?.earnedScore, scores.cdi?.possiblePoints),
    fs: calculateScorePercentage(scores.fs?.earnedScore, scores.fs?.possiblePoints),
    ca: calculateScorePercentage(scores.ca?.earnedScore, scores.ca?.possiblePoints),
  };

  const contributions: SubjectPercentages = {
    clj: percentages.clj * ((weights.clj ?? 20) / 100),
    lea: percentages.lea * ((weights.lea ?? 20) / 100),
    crim: percentages.crim * ((weights.crim ?? 20) / 100),
    cdi: percentages.cdi * ((weights.cdi ?? 15) / 100),
    fs: percentages.fs * ((weights.fs ?? 15) / 100),
    ca: percentages.ca * ((weights.ca ?? 10) / 100),
  };

  const rating = Object.values(contributions).reduce(
    (total, value) => total + value,
    0
  );

  return {
    percentages,
    contributions,
    rating: Number.isFinite(rating) ? Math.min(100, Math.max(0, rating)) : 0,
  };
}

export function calculateFinalCategoryRating(
  scores: CategoryDetailedScores,
  weights: SubjectWeights = CLE_SUBJECT_WEIGHTS
): {
  contributions: Record<SubjectKey, number>;
  rating: number;
} {
  const contributions = SUBJECT_KEYS.reduce((res, subj) => {
    const detailed = scores[subj] || { earnedScore: null, possiblePoints: 100 };
    res[subj] = calculateAreaContribution(detailed.earnedScore, detailed.possiblePoints, subj, weights).weightedContribution;
    return res;
  }, {} as Record<SubjectKey, number>);

  const rating = Object.values(contributions).reduce((sum, c) => sum + c, 0);

  return {
    contributions,
    rating: Number.isFinite(rating) ? Math.min(100, Math.max(0, rating)) : 0,
  };
}

export function getRevieweeCategoryRating(
  reviewee: Record<string, any>,
  category: string,
  weights: SubjectWeights = CLE_SUBJECT_WEIGHTS
): {
  scores: SubjectPercentages;
  rating: number;
} {
  const scores = getCategoryScores(reviewee, category);
  return {
    scores,
    rating: calculateCategoryRating(scores, weights),
  };
}
