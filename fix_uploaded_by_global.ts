import fs from 'fs';
let content = fs.readFileSync('./src/components/SyncModal.tsx', 'utf8');

// Use a global regex to replace ALL instances in the entire string
const regex = /\{(u as any)\.uploaded_by && \(/g;
content = content.replace(regex, '{(false) && (');

fs.writeFileSync('./src/components/SyncModal.tsx', content);
console.log('Successfully disabled all uploaded_by logic');
