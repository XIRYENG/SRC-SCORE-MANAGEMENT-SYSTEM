export const SCHOOL_NAME_ALIASES: Record<string, string> = {
  lanaoschoolofscienceandtechnologyinc: 'Lanao School of Science and Technology, Inc.',
  lakelanaocollegeincorporated: 'Lake Lanao College Incorporated',
  northcentralmindanaocollege: 'North Central Mindanao College',
  colegiodekapatagan: 'Colegio de Kapatagan',
  stmichaelscollegeofiligancity: 'St. Michael’s College of Iligan City',
  christthekingcollegedemarandinginc: 'Christ the King College de Maranding, Inc.',
  ckcm: 'CKCM',
  lssti: 'LSSTI',
  ncmc: 'NCMC',
  cdek: 'CDEK',
  smc: 'SMC',
  unassigned: 'Unassigned School',
  unassignedschool: 'Unassigned School',
};

export function normalizeSchoolName(name: string): string {
  if (!name || typeof name !== 'string') return '';
  return name.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function formatLegacySchoolName(raw: string): string {
  if (!raw) return 'Unassigned School';
  const trimmed = raw.trim();
  const norm = normalizeSchoolName(trimmed);

  if (SCHOOL_NAME_ALIASES[norm]) {
    return SCHOOL_NAME_ALIASES[norm];
  }

  return trimmed;
}

export function getSchoolDisplayName(
  school: {
    displayName?: string | null;
    officialName?: string | null;
    schoolName?: string | null;
    name?: string | null;
    code?: string | null;
    normalizedName?: string | null;
  } | string | null | undefined
): string {
  if (!school) return 'Unassigned School';

  if (typeof school === 'string') {
    const norm = normalizeSchoolName(school);
    if (SCHOOL_NAME_ALIASES[norm]) {
      return SCHOOL_NAME_ALIASES[norm];
    }
    return formatLegacySchoolName(school);
  }

  const displayName =
    school.displayName?.trim() ||
    school.officialName?.trim() ||
    school.schoolName?.trim() ||
    school.name?.trim() ||
    school.code?.trim();

  if (displayName) {
    const norm = normalizeSchoolName(displayName);
    if (SCHOOL_NAME_ALIASES[norm]) {
      return SCHOOL_NAME_ALIASES[norm];
    }
    return displayName;
  }

  if (school.normalizedName) {
    const norm = normalizeSchoolName(school.normalizedName);
    if (SCHOOL_NAME_ALIASES[norm]) {
      return SCHOOL_NAME_ALIASES[norm];
    }
    return formatLegacySchoolName(school.normalizedName);
  }

  return 'Unassigned School';
}
