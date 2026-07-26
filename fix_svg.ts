import * as fs from 'fs';
let svg = fs.readFileSync('public/logo.svg', 'utf8');

// remove white rectangles
svg = svg.replace(/<rect[^>]*fill="#ffffff"[^>]*\/>/gi, '');
svg = svg.replace(/<rect[^>]*fill="white"[^>]*\/>/gi, '');
svg = svg.replace(/<rect x="0" width="72" y="0" height="72"\/>/gi, '');

// Since we know the jpeg embedded has a white background,
// we can't easily alter it here, but we will remove the rect
fs.writeFileSync('public/favicon.svg', svg);
