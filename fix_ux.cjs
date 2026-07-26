const fs = require('fs');
let content = fs.readFileSync('src/components/UXDashboardCards.tsx', 'utf8');
content = content.replace(/  suspiciousCount\?\: number;/g, '');
content = content.replace(/  suspiciousCount = 0,/g, '');
content = content.replace(/    \{\s*title: 'Suspicious Pairs'[\s\S]*?text: 'text-amber-700'\s*\},\s*/g, '');
content = content.replace(/xl:grid-cols-4/g, 'xl:grid-cols-3');
fs.writeFileSync('src/components/UXDashboardCards.tsx', content);
