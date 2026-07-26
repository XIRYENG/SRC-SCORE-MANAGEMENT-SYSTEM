import re

with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

replacement = """const EditableScoreCell: React.FC<EditableScoreCellProps> = ({
  reviewee,
  category,
  subject,
  weight,
  isAreaActivated,
  canEditScores,
  onEdit,
}) => {
  if (!reviewee) return null;
  const resolvedScore = getResolvedScore(reviewee, category, subject);
  
  const scoreField = getScoreFieldName(category, subject);
  const isManuallyAdded = !!reviewee?.manualScores?.[scoreField] || !!reviewee?.manualScores?.[`${category?.toLowerCase()}_${subject?.toLowerCase()}`];"""

pattern = r"const EditableScoreCell: React\.FC<EditableScoreCellProps> = \(\{[\s\S]*?const isManuallyAdded = !!reviewee\.manualScores\?\.\[scoreField\] \|\| !!reviewee\.manualScores\?\.\[`\$\{category\.toLowerCase\(\)\}_\$\{subject\.toLowerCase\(\)\}`\];"

content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
