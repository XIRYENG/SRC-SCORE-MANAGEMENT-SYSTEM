const fs = require('fs');
let content = fs.readFileSync('src/components/SyncModal.tsx', 'utf8');
const search = '<Search size={12} /> Search DB';
const pos = content.indexOf(search);
console.log("Found at:", pos);
let nextDiv = content.indexOf('</div>', pos);
let nextAnimate = content.indexOf('<AnimatePresence>', pos);
console.log("Next div:", nextDiv, "Next animate:", nextAnimate);

if (pos > -1) {
  content = content.slice(0, nextAnimate) + '</div>\n                  ' + content.slice(nextAnimate);
  fs.writeFileSync('src/components/SyncModal.tsx', content);
}
