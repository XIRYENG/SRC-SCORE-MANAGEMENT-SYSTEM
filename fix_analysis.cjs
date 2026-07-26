const fs = require('fs');
let content = fs.readFileSync('src/components/AnalysisDashboard.tsx', 'utf8');

// Replace the potentialCheats useMemo block
const potentialCheatsRegex = /  const potentialCheats = useMemo\(\(\) => \{[\s\S]*?\}, \[users, sortConfig, similarityThreshold, selectedCategory, selectedSubject\]\);\n/g;
content = content.replace(potentialCheatsRegex, '');

// Remove suspiciousCount prop being passed to UXDashboardCards
content = content.replace(/        suspiciousCount=\{potentialCheats\.length\}\n/g, '');

// Remove the whole suspicious answer similarities block 
// From <div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-0 lg:min-w-0 analysis-two-column analysis-grid">
// to the closing div of that block
const similaritiesUIRegex = /        <div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-0 lg:min-w-0 analysis-two-column analysis-grid">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<div className="bg-white rounded-2xl sm:rounded-3xl border/g;

// Actually it's probably easier to just replace from the UI block down to where <div className="bg-white rounded-2xl sm:rounded-3xl border
const similaritiesUIRegex2 = /        <div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-0 lg:min-w-0 analysis-two-column analysis-grid">[\s\S]*?(?=        <div className="bg-white rounded-2xl sm:rounded-3xl border)/;
content = content.replace(similaritiesUIRegex2, '');

fs.writeFileSync('src/components/AnalysisDashboard.tsx', content);
