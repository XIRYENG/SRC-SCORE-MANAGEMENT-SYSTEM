export type GradeCategoryKey =
  | "preboard"
  | "pretest"
  | "posttest"
  | "quiz"
  | "dailyEvaluation"
  | "removal"
  | "diagnostic";

export type SubjectArea =
  | "clj"
  | "lea"
  | "cdi"
  | "fs"
  | "crim"
  | "ca";

export const SUBJECT_AREA_KEYS: SubjectArea[] = ["clj", "lea", "cdi", "fs", "crim", "ca"];

export type GradeWeights = Record<
  GradeCategoryKey,
  number
> & {
  [key: string]: number | undefined;
};

export type CategoryScores = Record<
  GradeCategoryKey,
  number | null | undefined
>;

export const DEFAULT_GRADE_WEIGHTS: GradeWeights = {
  preboard: 30,
  pretest: 5,
  posttest: 10,
  quiz: 10,
  dailyEvaluation: 30,
  removal: 10,
  diagnostic: 5,
};

export const GRADE_CATEGORY_LABELS: Record<
  GradeCategoryKey,
  string
> = {
  preboard: "Preboard",
  pretest: "Pretest",
  posttest: "Posttest",
  quiz: "Quiz",
  dailyEvaluation: "Daily Evaluation",
  removal: "Removal",
  diagnostic: "Diagnostic",
};

const CATEGORY_KEYS =
  Object.keys(
    DEFAULT_GRADE_WEIGHTS,
  ) as GradeCategoryKey[];

export function normalizeCategoryKey(category: string): GradeCategoryKey {
  const normalized = String(category || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (normalized.includes("preboard")) return "preboard";
  if (normalized.includes("pretest")) return "pretest";
  if (normalized.includes("posttest") || normalized === "post") return "posttest";
  if (normalized.includes("quiz")) return "quiz";
  if (normalized.includes("dailyevaluation") || normalized.includes("evaluation") || normalized.includes("daily")) return "dailyEvaluation";
  if (normalized.includes("removal")) return "removal";
  if (normalized.includes("diagnostic") || normalized === "diag") return "diagnostic";
  return "dailyEvaluation";
}

export function clampPercentage(
  value: unknown,
): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, parsed),
  );
}

export function getTotalWeight(
  weights: GradeWeights,
): number {
  return CATEGORY_KEYS.reduce(
    (total, key) =>
      total +
      (Number.isFinite(
        Number(weights[key]),
      )
        ? Number(weights[key])
        : 0),
    0,
  );
}

export function validateGradeWeights(
  weights: GradeWeights,
): {
  valid: boolean;
  total: number;
  remaining: number;
  errors: string[];
} {
  const errors: string[] = [];

  for (const key of CATEGORY_KEYS) {
    const value = Number(weights[key]);

    if (!Number.isFinite(value)) {
      errors.push(
        `${GRADE_CATEGORY_LABELS[key]} must be numeric.`,
      );
      continue;
    }

    if (value < 0) {
      errors.push(
        `${GRADE_CATEGORY_LABELS[key]} cannot be negative.`,
      );
    }

    if (value > 100) {
      errors.push(
        `${GRADE_CATEGORY_LABELS[key]} cannot exceed 100%.`,
      );
    }
  }

  const total = getTotalWeight(weights);
  const remaining = 100 - total;

  if (Math.abs(total - 100) >= 0.001) {
    errors.push(
      `The total percentage must equal 100%. Current total: ${total.toFixed(2)}%.`,
    );
  }

  return {
    valid: errors.length === 0 && Math.abs(total - 100) < 0.001,
    total,
    remaining,
    errors,
  };
}

export function normalizeScoreToPercentage(
  score: unknown,
  possiblePoints?: unknown,
): number {
  const earned = Number(score);

  if (!Number.isFinite(earned)) {
    return 0;
  }

  const possible = Number(possiblePoints);

  if (
    Number.isFinite(possible) &&
    possible > 0
  ) {
    return clampPercentage(
      (earned / possible) * 100,
    );
  }

  return clampPercentage(earned);
}

export type WeightedCategoryResult = {
  category: GradeCategoryKey;
  label: string;
  score: number;
  weight: number;
  contribution: number;
};

export function calculateWeightedAreaPerformance(
  categoryScores: CategoryScores,
  weights: GradeWeights,
  noScoreHandling: 'include' | 'exclude' = 'include'
): {
  percentage: number;
  breakdown: WeightedCategoryResult[];
} {
  const categories = CATEGORY_KEYS;
  
  const takenCategories = categories.filter(
    category =>
      categoryScores[category] !== null &&
      categoryScores[category] !== undefined,
  );

  const totalTakenWeight = noScoreHandling === 'exclude'
    ? takenCategories.reduce((total, category) => total + (Number(weights[category]) || 0), 0)
    : categories.reduce((total, category) => total + (Number(weights[category]) || 0), 0);

  const breakdown = categories.map(category => {
    const scoreValue = categoryScores[category];
    const hasScore = scoreValue !== null && scoreValue !== undefined;
    
    const score = clampPercentage(scoreValue ?? 0);
    const weight = Math.max(0, Number(weights[category]) || 0);

    // Only contribute if category was taken OR if we are including no-scores as 0%
    const shouldContribute = noScoreHandling === 'include' || hasScore;
    
    const contribution =
      totalTakenWeight > 0 && shouldContribute
        ? score * (weight / totalTakenWeight)
        : 0;

    return {
      category,
      label: GRADE_CATEGORY_LABELS[category],
      score,
      weight,
      contribution,
    };
  });

  const percentage =
    totalTakenWeight > 0
      ? clampPercentage(
          breakdown.reduce(
            (total, item) => total + item.contribution,
            0,
          ),
        )
      : 0;

  return {
    percentage,
    breakdown,
  };
}

export function calculateDashboardAreaAverage(
  revieweePercentages: (number | null)[],
  noScoreHandling: 'include' | 'exclude' = 'include'
): number {
  const validPercentages = revieweePercentages.filter(p => p !== null && Number.isFinite(p)) as number[];

  if (noScoreHandling === 'exclude') {
    if (validPercentages.length === 0) return 0;
    return clampPercentage(
      validPercentages.reduce((total, p) => total + p, 0) / validPercentages.length,
    );
  }

  // Include as 0.00% means we count all reviewees (the input should include 0 for those with no scores)
  const allPercentages = revieweePercentages.map(p => p ?? 0);
  if (allPercentages.length === 0) return 0;
  
  return clampPercentage(
    allPercentages.reduce((total, p) => total + p, 0) / allPercentages.length,
  );
}

export type PerformanceLevel =
  | "excellent"
  | "veryGood"
  | "good"
  | "needsImprovement"
  | "critical";

export function getPerformanceLevel(
  percentage: number,
): {
  level: PerformanceLevel;
  label: string;
} {
  if (percentage >= 90) {
    return {
      level: "excellent",
      label: "Excellent",
    };
  }

  if (percentage >= 80) {
    return {
      level: "veryGood",
      label: "Very Good",
    };
  }

  if (percentage >= 75) {
    return {
      level: "good",
      label: "Good",
    };
  }

  if (percentage >= 60) {
    return {
      level: "needsImprovement",
      label: "Needs Improvement",
    };
  }

  return {
    level: "critical",
    label: "Critical",
  };
}

export function getPerformanceColorClasses(percentage: number): {
  stroke: string;
  text: string;
  bg: string;
  border: string;
  badge: string;
} {
  const { level } = getPerformanceLevel(percentage);
  switch (level) {
    case "excellent":
      return {
        stroke: "#059669",
        text: "text-emerald-700",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      };
    case "veryGood":
      return {
        stroke: "#0d9488",
        text: "text-teal-700",
        bg: "bg-teal-50",
        border: "border-teal-200",
        badge: "bg-teal-50 text-teal-700 dark:bg-teal-500/20 dark:text-teal-300",
      };
    case "good":
      return {
        stroke: "#2563eb",
        text: "text-blue-700",
        bg: "bg-blue-50",
        border: "border-blue-200",
        badge: "bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      };
    case "needsImprovement":
      return {
        stroke: "#d97706",
        text: "text-amber-700",
        bg: "bg-amber-50",
        border: "border-amber-200",
        badge: "bg-amber-50 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      };
    case "critical":
    default:
      return {
        stroke: "#dc2626",
        text: "text-red-700",
        bg: "bg-red-50",
        border: "border-red-200",
        badge: "bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-300",
      };
  }
}
