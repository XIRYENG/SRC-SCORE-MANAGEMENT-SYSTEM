
import fs from 'fs';
const file = './src/components/SyncModal.tsx';
let content = fs.readFileSync(file, 'utf8');

const normalizedLine = `
   const normalizeName = (name: string) =>
     name
       .toLowerCase()
       .replace(/[^a-z0-9]/g, "")
       .trim();

   const getPossibleMatches = (csvName: string) => {
       const normalizedCSV = normalizeName(csvName);
       if (!normalizedCSV) return [];
       return allUsers.filter(u => {
           const first = normalizeName(u.first_name || '');
           const last = normalizeName(u.last_name || '');
           const full = normalizeName(\`\${u.first_name || ''} \${u.last_name || ''}\`);
           const reverse = normalizeName(\`\${u.last_name || ''} \${u.first_name || ''}\`);
           return (
               normalizedCSV === first ||
               normalizedCSV === last ||
               normalizedCSV === full ||
               normalizedCSV === reverse ||
               full.includes(normalizedCSV) ||
               reverse.includes(normalizedCSV)
           );
       }).slice(0, 5);
   };
`;

const insertAfter = 'const [importDate, setImportDate] = useState(\'\');';
content = content.replace(insertAfter, insertAfter + normalizedLine);

// Now update the pushes
const push1Target = 'unmatchedEntries.push({ id: studentId, name: nameToDisplay, updateData, rawScore: scoreValue });';
const push1Replace = 'unmatchedEntries.push({ id: studentId, name: nameToDisplay, updateData, rawScore: scoreValue, possibleMatches: getPossibleMatches(csvName || nameToDisplay) });';
content = content.replace(push1Target, push1Replace);

const push2Target = 'unmatchedEntries.push({ id: studentId, name: row[\'Name\'] || \'Unknown\' });';
const push2Replace = 'unmatchedEntries.push({ id: studentId, name: row[\'Name\'] || \'Unknown\', possibleMatches: getPossibleMatches(row[\'Name\'] || \'Unknown\') });';
content = content.replace(push2Target, push2Replace);

fs.writeFileSync(file, content);
console.log('Successfully updated SyncModal.tsx with helper functions and unmatchedEntries updates');
