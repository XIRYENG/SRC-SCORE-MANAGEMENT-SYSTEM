const fs = require('fs');
let content = fs.readFileSync('src/components/SyncModal.tsx', 'utf8');

const oldBlock = `                                      getRatingTextColorClass(
                                        selectedCategories.length <= 1
                                          ? (() => {
                                              const currentCat = selectedCategories[0] || 'preboard';
                                              const detailed = getCategoryDetailedScores(u, currentCat);
                                              return SUBJECT_KEYS.reduce((sum, s) => sum + calculateAreaContribution(detailed[s].earnedScore, detailed[s].possiblePoints, s).weightedContribution, 0);
                                            })()
                                          : selectedCategories.reduce((acc, cat) => {
                                              const detailed = getCategoryDetailedScores(u, cat);
                                              const catRating = SUBJECT_KEYS.reduce((s, subj) => s + calculateAreaContribution(detailed[subj].earnedScore, detailed[subj].possiblePoints, subj).weightedContribution, 0);
                                              const weight = gradeWeights[cat] ?? 0;
                                              return acc + (catRating * (weight / 100));
                                            }, 0)
                                      )`;

const newBlock = `                                      getRatingTextColorClass(
                                        selectedCategories.length <= 1
                                          ? (() => {
                                              const currentCat = selectedCategories[0] || 'preboard';
                                              const detailed = getCategoryDetailedScores(u, currentCat);
                                              return SUBJECT_KEYS.reduce((sum, subj) => sum + calculateAreaContribution(detailed[subj].earnedScore, detailed[subj].possiblePoints, subj).weightedContribution, 0);
                                            })()
                                          : selectedCategories.reduce((acc, cat) => {
                                              const detailed = getCategoryDetailedScores(u, cat);
                                              const catRating = SUBJECT_KEYS.reduce((sum, subj) => sum + calculateAreaContribution(detailed[subj].earnedScore, detailed[subj].possiblePoints, subj).weightedContribution, 0);
                                              const weight = gradeWeights[cat] ?? 0;
                                              return acc + (catRating * (weight / 100));
                                            }, 0)
                                      )`;

if (!content.includes(oldBlock)) {
  console.error('oldBlock not found');
} else {
  content = content.replace(oldBlock, newBlock);
  fs.writeFileSync('src/components/SyncModal.tsx', content, 'utf8');
  console.log('Fixed successfully!');
}
