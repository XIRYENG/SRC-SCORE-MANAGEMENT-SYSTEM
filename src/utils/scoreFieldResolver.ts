export type ScoreValue = {
  earnedScore: number | null;
  possiblePoints: number;
};

export function parseOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getResolvedDetailedScore(
  reviewee: Record<string, any>,
  category: string,
  subject: string,
  folderId?: string | null
): ScoreValue {
  const catKey = normalizeScoreCategory(category);
  const subjKey = normalizeScoreSubject(subject);

  // 1. Check scoresByDate for any entry belonging to this category and subject
  if (reviewee?.scoresByDate && typeof reviewee.scoresByDate === "object") {
    const entries = Object.values(reviewee.scoresByDate).filter((entry: any) => {
      if (!entry || typeof entry !== "object") return false;
      
      if (folderId) {
         const entryFolder = entry.folderId || entry.scoreFolderId || "main";
         if (entryFolder !== folderId) return false;
      }

      const entryCat = String(entry.category || "").toLowerCase();
      const entryCatKey = normalizeScoreCategory(entry.categoryKey || entryCat);

      if (entryCatKey !== catKey && !entryCat.includes(catKey)) return false;

      const entrySubjKey = normalizeScoreSubject(entry.subject || entryCat);
      const subjMatches =
        entrySubjKey === subjKey ||
        entryCat.includes(subjKey) ||
        String(entry.subject || "").toLowerCase().includes(subjKey);

      return subjMatches;
    });

    if (entries.length > 0) {
      entries.sort((a: any, b: any) => {
        const timeA = new Date(a.updatedAt || a.date || 0).getTime();
        const timeB = new Date(b.updatedAt || b.date || 0).getTime();
        return timeB - timeA;
      });

      const bestEntry: any = entries[0];
      const earned = parseOptionalNumber(
        bestEntry.earnedPoints ?? bestEntry.rawScore ?? bestEntry.score
      );
      const possible = parseOptionalNumber(
        bestEntry.possiblePoints ?? bestEntry.totalItems
      );

      if (earned !== null) {
        return {
          earnedScore: earned,
          possiblePoints: possible !== null && possible > 0 ? possible : 100,
        };
      }
    }
  }

  // 2. Check flat fields for earned score (only if in main folder or no folder specified)
  if (!folderId || folderId === "main") {
    const scoreField = getScoreFieldName(category, subject);
    let flatFieldKeys: string[] = [scoreField];
    if (catKey === "preboard") {
      flatFieldKeys = [`preboard_${subjKey}`, `score_${subjKey}_preboard`];
    } else if (catKey === "pretest") {
      flatFieldKeys = [`pretest_${subjKey}`, `score_${subjKey}_pretest`, `score_${subjKey}`];
    } else if (catKey === "posttest") {
      flatFieldKeys = [`post_${subjKey}`, `posttest_${subjKey}`, `score_${subjKey}_posttest`, `score_${subjKey}_post`];
    } else if (catKey === "quiz") {
      flatFieldKeys = [`score_${subjKey}_quiz`, `score_${subjKey}_quizzes`, `quiz_${subjKey}`];
    } else if (catKey === "dailyevaluation") {
      flatFieldKeys = [
        `score_${subjKey}_dailyevaluation`,
        `score_${subjKey}_evaluation`,
        `score_${subjKey}_daily_evaluation`,
        `score_clj_dailyevaluation`,
        `score_${subjKey}_daily`
      ];
    } else if (catKey === "removal") {
      flatFieldKeys = [`score_${subjKey}_removal`, `score_removal_${subjKey}`];
    } else if (catKey === "diagnostic") {
      flatFieldKeys = [`diag_${subjKey}`, `diagnostic_${subjKey}`, `score_${subjKey}_diagnostic`];
    }

    let earnedScore: number | null = null;
    for (const fk of flatFieldKeys) {
      const val = reviewee?.[fk];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        const num = Number(val);
        if (Number.isFinite(num)) {
          earnedScore = num;
          break;
        }
      }
    }

    const metadataKey = `${catKey}_${subjKey}`;
    const latestRecord =
      reviewee?.latestScores?.[metadataKey] ??
      reviewee?.latestScores?.[catKey] ??
      reviewee?.manualScores?.[metadataKey];

    const possiblePoints =
      parseOptionalNumber(
        latestRecord?.possiblePoints ??
          latestRecord?.totalItems ??
          latestRecord?.perfectScore ??
          latestRecord?.maxScore ??
          reviewee?.scoreMetadata?.[metadataKey]?.possiblePoints ??
          reviewee?.[`possible_points_${subjKey}`] ??
          reviewee?.[`total_items_${subjKey}`]
      ) ?? 100;

    return {
      earnedScore,
      possiblePoints: possiblePoints > 0 ? possiblePoints : 100,
    };
  }

  return { earnedScore: null, possiblePoints: 100 };
}

export function getResolvedScore(
  reviewee: Record<string, any>,
  category: string,
  subject: string,
  folderId?: string | null
): number | null {
  const { earnedScore, possiblePoints } = getResolvedDetailedScore(
    reviewee,
    category,
    subject,
    folderId
  );

  if (earnedScore === null || earnedScore === undefined) {
    return null;
  }

  if (possiblePoints > 0) {
    return (earnedScore / possiblePoints) * 100;
  }

  return earnedScore;
}

export function normalizeScoreCategory(category: string): string {
  const cat = String(category || "").toLowerCase().trim();
  if (cat.includes("preboard")) return "preboard";
  if (cat.includes("pretest")) return "pretest";
  if (cat.includes("posttest") || cat === "post") return "posttest";
  if (cat.includes("quiz")) return "quiz";
  if (cat.includes("dailyevaluation") || cat.includes("daily evaluation") || cat.includes("evaluation") || cat.includes("daily")) return "dailyevaluation";
  if (cat.includes("removal")) return "removal";
  if (cat.includes("diagnostic") || cat === "diag") return "diagnostic";
  return cat;
}

export function normalizeScoreSubject(subject: string): string {
  const subj = String(subject || "").toLowerCase().trim();
  if (subj === "clj" || subj === "criminal law") return "clj";
  if (subj === "lea" || subj === "law enforcement") return "lea";
  if (subj === "cdi" || subj === "crime detection") return "cdi";
  if (subj === "fs" || subj === "forensic science") return "fs";
  if (subj === "crim" || subj === "criminology") return "crim";
  if (subj === "ca" || subj === "cor-ad" || subj === "correctional") return "ca";
  return subj;
}

export function getScoreFieldName(category: string, subject: string): string {
  const catKey = normalizeScoreCategory(category);
  const subjKey = normalizeScoreSubject(subject);
  
  if (catKey === "preboard") {
    return `preboard_${subjKey}`;
  } else if (catKey === "pretest" || catKey === "diagnostic") {
    return `diag_${subjKey}`;
  } else if (catKey === "posttest") {
    return `post_${subjKey}`;
  } else {
    return `score_${subjKey}_${catKey}`;
  }
}

export type ScoreAreaActivation = {
  category: string;
  subject: string;
  activated: boolean;
};

export type IsScoreAreaActivatedArgs = {
  category: string;
  subject: string;
  activatedAreas: ScoreAreaActivation[];
  importHistory: Array<{
    category?: string;
    subject?: string;
    status?: string;
  }>;
  reviewees: Record<string, any>[];
};

export function isScoreAreaActivated({
  category,
  subject,
  activatedAreas,
  importHistory,
  reviewees,
}: IsScoreAreaActivatedArgs): boolean {
  const categoryKey = normalizeScoreCategory(category);
  const subjectKey = normalizeScoreSubject(subject);

  const explicitlyActivated = activatedAreas.some(
    area =>
      area.activated &&
      normalizeScoreCategory(area.category) === categoryKey &&
      normalizeScoreSubject(area.subject) === subjectKey
  );

  if (explicitlyActivated) {
    return true;
  }

  const hasSuccessfulImport = importHistory.some(
    history =>
      normalizeScoreCategory(history.category || "") === categoryKey &&
      normalizeScoreSubject(history.subject || "") === subjectKey &&
      ["SUCCESS", "COMPLETED", "CONFIRMED"].includes(
        String(history.status ?? "").toUpperCase()
      )
  );

  if (hasSuccessfulImport) {
    return true;
  }

  const scoreField = getScoreFieldName(category, subject);

  return reviewees.some(
    reviewee =>
      reviewee?.[scoreField] !== null &&
      reviewee?.[scoreField] !== undefined &&
      reviewee?.[scoreField] !== ""
  );
}
