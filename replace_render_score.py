import re

with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

replacement = """  const renderScoreCell = (u: any, subject: string, weight: number) => {
    const currentCategory = selectedCategories[0] || 'preboard';
    const isAreaActivated = isScoreAreaActivated({
      category: currentCategory,
      subject,
      activatedAreas,
      importHistory,
      reviewees: allUsers
    });
    
    const canEdit = hasScoreEditPermission(currentUser);
    
    return (
      <EditableScoreCell
        reviewee={u}
        category={currentCategory}
        subject={subject}
        weight={weight}
        isAreaActivated={isAreaActivated}
        canEditScores={canEdit}
        onEdit={handleOpenManualEditModal}
      />
    );
  };"""

pattern = r"  const renderScoreCell = \(u: any, subject: string, weight: number\) => \{\s+const currentCategory = selectedCategories\[0\] \|\| 'preboard';\s+const isAreaActivated = isScoreAreaActivated\(\{\s+category: currentCategory,\s+subject,\s+activatedAreas,\s+importHistory,\s+reviewees: allUsers\s+\}\);\s+const canEdit = hasScoreEditPermission\(currentUser\);\s+return \(\s+<EditableScoreCell\s+reviewee=\{u\}\s+category=\{currentCategory\}\s+subject=\{subject\}\s+isAreaActivated=\{isAreaActivated\}\s+canEditScores=\{canEdit\}\s+onEdit=\{handleOpenManualEditModal\}\s+/>\s+\);\s+\};"

content = re.sub(pattern, replacement, content, flags=re.MULTILINE)

with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
