import * as fs from 'fs';

let code = fs.readFileSync('server.ts', 'utf8');

const regex = /is_archived: req.body.is_archived \|\| false,\n\s*is_synced: false,\n\s*\.\.\.\(req\.body\.adminName \? \{ uploaded_by: req\.body\.adminName \} : \{\}\)\n\s*\}\);/g;

code = code.replace(regex, `is_archived: req.body.is_archived || false,
        is_synced: false,
        ...(req.body.adminName ? { uploaded_by: req.body.adminName } : {}),
        ...(req.body.role !== undefined ? { role: req.body.role } : {})
      });`);

fs.writeFileSync('server.ts', code);
