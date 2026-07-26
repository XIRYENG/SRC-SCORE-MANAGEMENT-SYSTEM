import * as fs from 'fs';

let code = fs.readFileSync('src/components/SyncModal.tsx', 'utf8');

// 1. Add activity tab type
code = code.replace(
  `const [activeTab, setActiveTab] = useState<'details' | 'scores' | 'archived' | 'analysis'>('details');`,
  `const [activeTab, setActiveTab] = useState<'details' | 'scores' | 'archived' | 'analysis' | 'activity'>('details');\n  const [activityLogs, setActivityLogs] = useState<any[]>([]);\n  const [loadingLogs, setLoadingLogs] = useState(false);`
);

// 2. Add fetchActivityLogs function
const fetchLogsFunc = `
  const fetchActivityLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/activity-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminId: currentUser?.seqId || "000126",
          adminName: currentUser ? \`\${currentUser.first_name} \${currentUser.last_name}\` : "Ariel Orcia Pesalver",
          adminRole: currentUser?.role || "",
          password: ""
        })
      });
      const data = await res.json();
      if (res.ok) {
        setActivityLogs(data.logs || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'activity') {
      fetchActivityLogs();
    }
  }, [activeTab]);
`;

code = code.replace(
  `const uniqueSchoolsList = useMemo(() => {`,
  fetchLogsFunc + `\n  const uniqueSchoolsList = useMemo(() => {`
);

fs.writeFileSync('src/components/SyncModal.tsx', code);
