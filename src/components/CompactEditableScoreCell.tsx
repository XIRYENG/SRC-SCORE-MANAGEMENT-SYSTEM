import React from "react";
import { Pencil, Plus } from "lucide-react";
import {
  getResolvedDetailedScore,
  ScoreValue,
} from "../utils/scoreFieldResolver";
import {
  calculateAreaContribution,
  formatContribution,
  formatRawPercentage,
  SubjectKey,
} from "../utils/categoryRating";

export type DetailedEditableScoreCellProps = {
  score: ScoreValue;
  revieweeName: string;
  category: string;
  subject: string;
  isAreaActivated: boolean;
  canEditScores: boolean;
  onEdit: () => void;
};

export function formatPercentage(value: number): string {
  const rounded = Number(value.toFixed(2));
  return Number.isInteger(rounded)
    ? `${rounded}%`
    : `${rounded.toFixed(2)}%`;
}

export function DetailedEditableScoreCell({
  score,
  revieweeName,
  category,
  subject,
  isAreaActivated,
  canEditScores,
  onEdit,
}: DetailedEditableScoreCellProps) {
  const subjectKey = (subject || "clj").toLowerCase() as SubjectKey;

  const result = calculateAreaContribution(
    score.earnedScore,
    score.possiblePoints,
    subjectKey
  );

  const hasSavedScore = score.earnedScore !== null;
  const allowEditing = isAreaActivated && canEditScores;

  const actionLabel = hasSavedScore
    ? `Edit ${subject.toUpperCase()} ${category} score for ${revieweeName}`
    : `Add ${subject.toUpperCase()} ${category} score for ${revieweeName}`;

  const tooltipText = [
    `Raw score: ${formatRawPercentage(result.rawPercentage)}`,
    `Area weight: ${result.subjectWeight}%`,
    `Grade contribution: ${formatContribution(result.weightedContribution)}`,
  ].join("\n");

  const isDailyEval = String(category || "").toLowerCase().includes("daily");

  const displayScoreText = !isAreaActivated
    ? "—"
    : hasSavedScore
      ? `${result.earnedScore}/${result.possiblePoints}`
      : `__/${score.possiblePoints > 0 ? score.possiblePoints : "total"}`;

  const displayRating = !isAreaActivated
    ? "—"
    : isDailyEval
      ? (score.earnedScore !== null && score.possiblePoints > 0 
          ? `${((score.earnedScore / score.possiblePoints) * 100).toFixed(2)}%`
          : "0.00%")
      : formatContribution(result.weightedContribution);

  return (
    <div className="flex min-w-[65px] sm:min-w-[75px] flex-col items-center justify-center py-0.5">
      <div className="flex items-center justify-center gap-1 whitespace-nowrap text-[11px]">
        <span className="font-bold text-slate-900">
          {displayScoreText}
        </span>

        {allowEditing && (
          <button
            type="button"
            onClick={onEdit}
            title={actionLabel}
            aria-label={actionLabel}
            className={[
              "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded transition cursor-pointer border",
              hasSavedScore
                ? "border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700"
                : "border-teal-200 bg-teal-50 text-teal-700 hover:border-teal-400 hover:bg-teal-100",
            ].join(" ")}
          >
            {hasSavedScore ? (
              <Pencil size={10} />
            ) : (
              <Plus size={11} />
            )}
          </button>
        )}
      </div>

      <span
        className="text-[10px] font-bold text-teal-700 cursor-help leading-tight"
        title={isDailyEval ? `Daily Evaluation Rating` : tooltipText}
      >
        {displayRating}
      </span>
    </div>
  );
}

export type CompactEditableScoreCellProps = {
  reviewee: Record<string, any>;
  category: string;
  subject: string;
  isAreaActivated: boolean;
  canEditScores: boolean;
  onEdit: (data: {
    reviewee: Record<string, any>;
    category: string;
    subject: string;
    currentScore: number | null;
    possiblePoints?: number;
  }) => void;
  overrideScore?: ScoreValue;
};

export function CompactEditableScoreCell({
  reviewee,
  category,
  subject,
  isAreaActivated,
  canEditScores,
  onEdit,
  overrideScore,
}: CompactEditableScoreCellProps) {
  const detailedScore = overrideScore || getResolvedDetailedScore(reviewee, category, subject);

  const revieweeName =
    reviewee.fullName ||
    [
      reviewee.first_name,
      reviewee.middle_name,
      reviewee.last_name,
    ]
      .filter(Boolean)
      .join(" ") ||
    "reviewee";

  return (
    <DetailedEditableScoreCell
      score={detailedScore}
      revieweeName={revieweeName}
      category={category}
      subject={subject}
      isAreaActivated={isAreaActivated}
      canEditScores={canEditScores}
      onEdit={() =>
        onEdit({
          reviewee,
          category,
          subject,
          currentScore: detailedScore.earnedScore,
          possiblePoints: detailedScore.possiblePoints,
        })
      }
    />
  );
}
