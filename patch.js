const fs = require('fs');
let content = fs.readFileSync('src/components/SyncModal.tsx', 'utf8');
content = content.replace(
  '<Search size={12} /> Search DB\n                    </button>\n                  </div>\n                  <AnimatePresence>',
  '<Search size={12} /> Search DB\n                    </button>\n                  </div>\n                  </div>\n                  <AnimatePresence>'
);
fs.writeFileSync('src/components/SyncModal.tsx', content);
