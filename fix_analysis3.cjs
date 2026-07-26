const fs = require('fs');
let content = fs.readFileSync('src/components/AnalysisDashboard.tsx', 'utf8');

// Replace the UI block for potential cheats
const startOfUI = /<h3 className="text-sm font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">\s*<AlertTriangle className="text-amber-500 w-5 h-5" \/>\s*Suspicious Answer Similarities\s*<\/h3>/;
const match = content.match(startOfUI);

if (match) {
  const startIdx = match.index;
  const endMarkerStr = `      <div className="space-y-2 text-xs border-l border-slate-200 pl-3">`;
  const endIdx = content.indexOf(endMarkerStr);
  
  if (endIdx !== -1) {
    // Delete from <div className="space-y-2 text-xs"> up to endIdx
    // Actually the parent is: <div className="space-y-2 text-xs">
    const parentStart = content.lastIndexOf('<div className="space-y-2 text-xs">', startIdx);
    if (parentStart !== -1) {
      content = content.substring(0, parentStart) + content.substring(endIdx);
    }
  }
}

// Remove the containing grid if we just removed the left side? 
// No, `<div className="grid grid-cols-2 gap-2 sm:gap-3 min-w-0 lg:min-w-0 analysis-two-column analysis-grid">`
// Let's change `grid-cols-2` to `grid-cols-1` and `analysis-two-column` to `analysis-one-column` since the first column is gone
content = content.replace('grid-cols-2', 'grid-cols-1').replace('analysis-two-column', 'analysis-one-column');

// Now remove unused state variables
content = content.replace(/  const \[similarityThreshold, setSimilarityThreshold\] = useState\(5\);\n/g, '');
content = content.replace(/  const \[sortConfig, setSortConfig\] = useState<\{ key: 'similarCorrect' \| 'similarWrong' \| 'total', direction: 'asc' \| 'desc' \}>\(\{ key: 'similarWrong', direction: 'desc' \}\);\n/g, '');
content = content.replace(/  const \[expandedRows, setExpandedRows\] = useState<Record<string, boolean>>\(\{\}\);\n/g, '');

// Also remove `const toggleSort = ...` and `const toggleRow = ...`
const toggleSortRegex = /  const toggleSort = [\s\S]*?  \};\n/g;
const toggleRowRegex = /  const toggleRow = [\s\S]*?  \};\n/g;
content = content.replace(toggleSortRegex, '');
content = content.replace(toggleRowRegex, '');

fs.writeFileSync('src/components/AnalysisDashboard.tsx', content);
