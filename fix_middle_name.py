import re

with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

pattern = r"\{\(r\.middle_name \|\| r\['Middle Name'\]\) \? \` \$\{\(r\.middle_name \|\| r\['Middle Name'\]\)\.toLowerCase\(\)\}\` : ''\}"
replacement = """{(r.middle_name || r['Middle Name']) ? ` ${String(r.middle_name || r['Middle Name']).toLowerCase()}` : ''}"""

content = re.sub(pattern, replacement, content)

with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
