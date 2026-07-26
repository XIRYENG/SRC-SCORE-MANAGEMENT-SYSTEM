import type { RevieweeData } from '../types';

export interface ScoreRecord {
  area: string;
  category: string;
  date: string;
  score: number;
  totalItems: number;
  percentage: number;
  result: string;
  source: string;
}

const AREAS = [
  { id: 'clj', label: 'CLJ' },
  { id: 'lea', label: 'LEA' },
  { id: 'cdi', label: 'CDI' },
  { id: 'fs', label: 'FS' },
  { id: 'crim', label: 'Criminology' },
  { id: 'ca', label: 'COR-AD' },
];

const FLAT_CATEGORIES = [
  { key: 'score', label: 'Daily Evaluation' },
  { key: 'diag', label: 'Diagnostic' },
  { key: 'pretest', label: 'Pretest' },
  { key: 'post', label: 'Posttest' },
  { key: 'posttest', label: 'Posttest' },
  { key: 'preboard', label: 'Pre-board' },
  { key: 'final', label: 'Final Coaching' },
  { key: 'mock', label: 'Mock Exam' },
];

export function getResultLabel(percentage: number): string {
  if (percentage >= 90) return 'Excellent';
  if (percentage >= 80) return 'Very Good';
  if (percentage >= 75) return 'Good';
  return 'Needs Improvement';
}

export function parseScores(data: any): ScoreRecord[] {
  const records: ScoreRecord[] = [];
  
  // 1. Parse flat fields
  AREAS.forEach(area => {
    FLAT_CATEGORIES.forEach(cat => {
      const fieldName = `${cat.key}_${area.id}`;
      const scoreVal = data[fieldName];
      
      if (scoreVal !== undefined && scoreVal !== null && scoreVal !== '' && Number(scoreVal) > 0) {
        const numScore = Number(scoreVal);
        if (!isNaN(numScore)) {
          // Find the date for this flat field
          let dateStr = '';
          const possibleDateKeys = [
            `date_${area.id}_${cat.key}`,
            `date_${area.id}_${cat.label.toLowerCase().replace(/[^a-z0-9]/g, '')}`
          ];
          
          for (const dk of possibleDateKeys) {
            if (data[dk]) {
              dateStr = data[dk];
              break;
            }
          }
          
          if (!dateStr && data.timestamp) {
             // fallback to creation date if no specific date
             dateStr = data.timestamp.split('T')[0];
          }

          records.push({
            area: area.label,
            category: cat.label,
            date: dateStr,
            score: numScore,
            totalItems: 100, // Assuming raw score is out of 100 for flat fields
            percentage: numScore, 
            result: getResultLabel(numScore),
            source: 'Uploaded'
          });
        }
      }
    });
  });

  // 3. Parse assessmentRecords
  if (data.assessmentRecords && typeof data.assessmentRecords === 'object') {
    Object.values(data.assessmentRecords).forEach((entry: any) => {
      if (entry && typeof entry === 'object') {
        const numScore = Number(entry.score);
        const totalItems = Number(entry.totalScore) || 100;
        if (!isNaN(numScore) && totalItems > 0) {
           records.push({
             area: entry.area || 'General',
             category: entry.category || 'Evaluation',
             date: entry.date || entry.createdAt?.split('T')[0] || '',
             score: numScore,
             totalItems: totalItems,
             percentage: (numScore / totalItems) * 100,
             result: getResultLabel((numScore / totalItems) * 100),
             source: 'AssessmentRecord'
           });
        }
      }
    });
  }

  // Deduplicate records (if same area, category, date, and source)
  const uniqueRecords = new Map<string, ScoreRecord>();
  records.forEach(r => {
    const key = `${r.area}_${r.category}_${r.date}_${r.source}`;
    uniqueRecords.set(key, r); // Later ones (like scoresByDate) overwrite flat ones if conflict
  });

  return Array.from(uniqueRecords.values()).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
