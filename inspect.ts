import fs from 'fs';
const content = fs.readFileSync('./src/components/SyncModal.tsx', 'utf8');
const lines = content.split('\n');

// Find the lines by context if needed, but let's just inspect them
console.log('Line 2910:', JSON.stringify(lines[2910]));
console.log('Line 2911:', JSON.stringify(lines[2911]));
console.log('Line 3004:', JSON.stringify(lines[3004]));
console.log('Line 3005:', JSON.stringify(lines[3005]));
