const fs = require('fs');
let content = fs.readFileSync('src/components/AnalysisDashboard.tsx', 'utf8');

// Replace everything inside the first `div className="overflow-x-auto pb-2"` with nothing, since it seems to be related to similarity UI.
// But wait, the original `similaritiesUIRegex2` left some stuff behind.
// Let's replace the whole `overflow-x-auto pb-2` div for `potentialCheats`.

const uiBlockRegex = /      <div className="overflow-x-auto pb-2">[\s\S]*?(?=      <div className="bg-white rounded-2xl sm:rounded-3xl border)/;
content = content.replace(uiBlockRegex, '');

fs.writeFileSync('src/components/AnalysisDashboard.tsx', content);
