import fs from 'fs';
const file = './src/components/SyncModal.tsx';
let content = fs.readFileSync(file, 'utf8');

// Remove the 'UP: ...' section
const regex1 = /\{(u as any)\.uploaded_by && \(\n\s+<div className="text-\[7\.5px\] font-bold text-blue-500 mt-0\.5 tracking-wider">UP: \{(u as any)\.uploaded_by\}<\/div>\n\s+\)\}/g;
content = content.replace(regex1, '');

// Remove the 'UPLOADED BY: ...' section
const regex2 = /\{(u as any)\.uploaded_by && \(\n\s+<div className="text-\[8px\] font-bold text-blue-500 mt-1">UPLOADED BY: \{(u as any)\.uploaded_by\}<\/div>\n\s+\)\}/g;
content = content.replace(regex2, '');

fs.writeFileSync(file, content);
console.log('Successfully removed uploaded_by logic');
