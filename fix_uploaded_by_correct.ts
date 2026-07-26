import fs from 'fs';
const content = fs.readFileSync('./src/components/SyncModal.tsx', 'utf8');
const lines = content.split('\n');

// Replace the condition in line 2910 and 3004 (using the correct indices which are 2910 and 3004)
lines[2910] = lines[2910].replace(/\{(u as any)\.uploaded_by && \(/, '{(false) && (');
lines[3004] = lines[3004].replace(/\{(u as any)\.uploaded_by && \(/, '{(false) && (');

fs.writeFileSync('./src/components/SyncModal.tsx', lines.join('\n'));
console.log('Successfully disabled uploaded_by logic');
