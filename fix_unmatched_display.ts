import fs from 'fs';
const file = './src/components/SyncModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const targetLine = 'unmatchedEntries.push({ id: studentId, name: getCsvValue(row, ["Name", "Student", "Student Name", "StudentName"]) || \'Unknown\', updateData, rawScore: scoreValue });';
const replacement = `const csvName = getCsvValue(row, ["Name", "Student", "Student Name", "StudentName"]);
                  let nameToDisplay;
                  if (csvName) {
                    nameToDisplay = studentId ? \`\${csvName} (ID: \${studentId})\` : csvName;
                  } else {
                    nameToDisplay = studentId ? \`Unknown (ID: \${studentId})\` : 'Unknown';
                  }
                  unmatchedEntries.push({ id: studentId, name: nameToDisplay, updateData, rawScore: scoreValue });`;

// Be careful with spaces!
content = content.replace(targetLine, replacement);

fs.writeFileSync(file, content);
console.log('Successfully updated SyncModal.tsx');
