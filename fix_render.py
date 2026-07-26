import re
with open('src/components/SyncModal.tsx', 'r') as f:
    content = f.read()

replacement = """  const renderScoreCell = (u: any, subject: string, weight: number) => {
    if (!u) return null;
    const currentCategory = selectedCategories[0] || 'preboard';"""
pattern = r"  const renderScoreCell = \(u: any, subject: string, weight: number\) => \{\s+const currentCategory = selectedCategories\[0\] \|\| 'preboard';"
content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
with open('src/components/SyncModal.tsx', 'w') as f:
    f.write(content)
