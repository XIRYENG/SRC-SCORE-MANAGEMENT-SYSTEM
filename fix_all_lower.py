import re

with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

content = re.sub(r"\{\(r\.last_name \|\| r\['Last Name'\] \|\| ''\)\.toLowerCase\(\)\}", r"{String(r.last_name || r['Last Name'] || '').toLowerCase()}", content)
content = re.sub(r"\{\(r\.first_name \|\| r\['First Name'\] \|\| ''\)\.toLowerCase\(\)\}", r"{String(r.first_name || r['First Name'] || '').toLowerCase()}", content)

with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
