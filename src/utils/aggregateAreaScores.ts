import { parseScores } from './scoreParser';

export const areaTitleMap: Record<string, string> = {
  "CLJ": "Criminal Law and Jurisprudence",
  "LEA": "Law Enforcement Administration",
  "CDI": "Crime Detection and Investigation",
  "FS": "Forensic Science",
  "CRIM": "Criminology",
  "COR-AD": "Correctional Administration",
};

export const areaLabels = ["CLJ", "LEA", "CDI", "FS", "CRIM", "COR-AD"];

export const aggregateAreaScores = (users: any[]) => {
  const areaTotals: Record<string, { sum: number; count: number }> = {};

  areaLabels.forEach(area => {
    areaTotals[area] = { sum: 0, count: 0 };
  });

  users.forEach(user => {
    const scores = parseScores(user);
    scores.forEach(s => {
      if (areaTotals[s.area]) {
        areaTotals[s.area].sum += s.percentage;
        areaTotals[s.area].count += 1;
      }
    });
  });

  return areaLabels.map(area => {
    const data = areaTotals[area];
    return {
      area,
      title: areaTitleMap[area] || area,
      percent: data.count > 0 ? (data.sum / data.count) : 0,
      count: `${data.count} encoded`
    };
  });
};

export const buildOverallTrend = (users: any[]) => {
  const dateMap: Record<string, { sum: number; count: number }> = {};

  users.forEach(user => {
    const scores = parseScores(user);
    scores.forEach(s => {
      if (s.date) {
        const d = s.date;
        if (!dateMap[d]) dateMap[d] = { sum: 0, count: 0 };
        dateMap[d].sum += s.percentage;
        dateMap[d].count += 1;
      }
    });
  });

  return Object.entries(dateMap)
    .map(([date, data]) => ({
      date,
      score: Number((data.sum / data.count).toFixed(2)),
      timestamp: new Date(date).getTime()
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .map(({ date, score }) => ({ date, score }))
    .slice(-10); // Last 10 days/sessions
};
