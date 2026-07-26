import re

with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

replacement = """type EditableScoreCellProps = {
  reviewee: Record<string, any>;
  category: string;
  subject: string;
  weight: number;
  isAreaActivated: boolean;
  canEditScores: boolean;
  onEdit: (data: {
    reviewee: Record<string, any>;
    category: string;
    subject: string;
    currentScore: number | null;
  }) => void;
};

const EditableScoreCell: React.FC<EditableScoreCellProps> = ({
  reviewee,
  category,
  subject,
  weight,
  isAreaActivated,
  canEditScores,
  onEdit,
}) => {
  const resolvedScore = getResolvedScore(reviewee, category, subject);
  
  const scoreField = getScoreFieldName(category, subject);
  const isManuallyAdded = !!reviewee.manualScores?.[scoreField] || !!reviewee.manualScores?.[`${category.toLowerCase()}_${subject.toLowerCase()}`];

  if (!isAreaActivated) {
    return (
      <div className="flex flex-col items-center justify-center gap-0 text-slate-400 group/inactive relative cursor-help">
        <span className="font-bold text-[11.5px]">_/100</span>
        <span className="text-[9px] text-slate-400 opacity-80">0.00%</span>
        <Lock size={10} className="absolute -top-1 -right-2 opacity-40 group-hover/inactive:opacity-100 transition-opacity" />
        <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-[9px] px-2 py-1 rounded shadow-md opacity-0 group-hover/inactive:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 font-bold uppercase tracking-wide">
          No uploaded score batch for this area
        </div>
      </div>
    );
  }

  const hasScore = resolvedScore !== null && resolvedScore !== undefined;
  const displayVal = hasScore ? resolvedScore : "_";
  const percentageVal = hasScore ? (resolvedScore * weight).toFixed(2) : "0.00";
  
  const textColorClass = isManuallyAdded ? "text-red-600 print:text-black" : "text-slate-800";

  return (
    <div className="flex flex-col items-center justify-center gap-0.5 py-1">
      <span className={`font-bold text-[12px] ${textColorClass}`}>{displayVal}/100</span>
      <span className="text-[9px] text-slate-500">{percentageVal}%</span>
      {canEditScores && (
        <button
          type="button"
          onClick={() => onEdit({ reviewee, category, subject, currentScore: resolvedScore })}
          className={`print:hidden mt-0.5 flex items-center gap-1 px-1.5 py-0.5 text-[8.5px] font-black uppercase tracking-wider rounded-md transition-all cursor-pointer ${
            hasScore
              ? "bg-slate-100 hover:bg-slate-200 text-slate-700 hover:shadow-sm"
              : "bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200/40 hover:shadow-sm"
          }`}
        >
          {hasScore ? (
            <>
              <Edit size={8} />
              <span>Edit</span>
            </>
          ) : (
            <>
              <Clock size={8} />
              <span>Add Score</span>
            </>
          )}
        </button>
      )}
    </div>
  );
};"""

pattern = r"type EditableScoreCellProps = \{[\s\S]*?const EditableScoreCell: React\.FC<EditableScoreCellProps> = \(\{[\s\S]*?^\};\n"

content = re.sub(pattern, replacement + "\n", content, flags=re.MULTILINE | re.DOTALL)

with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
