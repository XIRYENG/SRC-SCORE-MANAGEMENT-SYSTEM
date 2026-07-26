import re

with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

replacement = """      // Prepare latestScores object to keep compatibility
      const existingLatestScores = reviewee.latestScores || {};
      const updatedLatestScores = {
        ...existingLatestScores,
        [scoreField]: newScore,
        [`${category.toLowerCase()}_${subject.toLowerCase()}`]: newScore
      };

      const existingManualFlags = reviewee.manualScores || {};
      const updatedManualFlags = {
        ...existingManualFlags,
        [scoreField]: true,
        [`${category.toLowerCase()}_${subject.toLowerCase()}`]: true
      };

      const updatePayload: any = {
        [scoreField]: newScore,
        last_score_update: serverTimestamp(),
        lastScoreEditedByUid: currentUser.uid,
        lastScoreEditedByName: currentUserName,
        lastScoreEditReason: reason || "Added missing score",
        latestScores: updatedLatestScores,
        manualScores: updatedManualFlags,
        updated_at: new Date().toISOString()
      };"""

content = re.sub(
    r"      // Prepare latestScores object to keep compatibility\s+const existingLatestScores = reviewee\.latestScores \|\| \{\};\s+const updatedLatestScores = \{\s+\.\.\.existingLatestScores,\s+\[scoreField\]: newScore,\s+\[`\$\{category\.toLowerCase\(\)\}_\$\{subject\.toLowerCase\(\)\}`\]: newScore\s+\};\s+const updatePayload: any = \{\s+\[scoreField\]: newScore,\s+last_score_update: serverTimestamp\(\),\s+lastScoreEditedByUid: currentUser\.uid,\s+lastScoreEditedByName: currentUserName,\s+lastScoreEditReason: reason \|\| \"Added missing score\",\s+latestScores: updatedLatestScores,\s+updated_at: new Date\(\)\.toISOString\(\)\s+\};",
    replacement,
    content,
    flags=re.MULTILINE
)

with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
