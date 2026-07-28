export type MajorAreaCode = "CLJ" | "LEA" | "CDI" | "FS" | "CRIM" | "CA";

export type CurriculumSubject = {
  id: string;
  areaCode: MajorAreaCode;
  subjectCode: string;
  subjectName: string;
  sortOrder: number;
};

export const MAJOR_AREAS: { code: MajorAreaCode; title: string }[] = [
  { code: "CLJ", title: "Criminal Law and Jurisprudence" },
  { code: "LEA", title: "Law Enforcement Administration" },
  { code: "CDI", title: "Crime Detection and Investigation" },
  { code: "FS", title: "Forensic Science" },
  { code: "CRIM", title: "Criminology" },
  { code: "CA", title: "Correctional Administration" },
];

export const CRIMINOLOGY_SUBJECTS: CurriculumSubject[] = [
  // CLJ
  { id: "clj_1", areaCode: "CLJ", subjectCode: "CLJ 1", subjectName: "Introduction to Philippine Criminal Justice System", sortOrder: 1 },
  { id: "clj_2", areaCode: "CLJ", subjectCode: "CLJ 2", subjectName: "Human Rights Education", sortOrder: 2 },
  { id: "clj_3", areaCode: "CLJ", subjectCode: "CLJ 3", subjectName: "Criminal Law Book 1", sortOrder: 3 },
  { id: "clj_4", areaCode: "CLJ", subjectCode: "CLJ 4", subjectName: "Criminal Law Book 2", sortOrder: 4 },
  { id: "clj_5", areaCode: "CLJ", subjectCode: "CLJ 5", subjectName: "Evidence", sortOrder: 5 },
  { id: "clj_6", areaCode: "CLJ", subjectCode: "CLJ 6", subjectName: "Criminal Procedure", sortOrder: 6 },
  { id: "clj_7", areaCode: "CLJ", subjectCode: "CLJ 7", subjectName: "Court Testimony", sortOrder: 7 },

  // LEA
  { id: "lea_1", areaCode: "LEA", subjectCode: "LEA 1", subjectName: "Law Enforcement Administration (Inter-Agency Approach)", sortOrder: 1 },
  { id: "lea_2", areaCode: "LEA", subjectCode: "LEA 2", subjectName: "Comparative Models in Policing", sortOrder: 2 },
  { id: "lea_3", areaCode: "LEA", subjectCode: "LEA 3", subjectName: "Introduction to Industrial Security Concepts", sortOrder: 3 },
  { id: "lea_4", areaCode: "LEA", subjectCode: "LEA 4", subjectName: "Law Enforcement Operation and Planning with Crime Mapping", sortOrder: 4 },
  { id: "clfm_1", areaCode: "LEA", subjectCode: "CLFM 1", subjectName: "Character Formation, Nationalism, and Patriotism", sortOrder: 5 },
  { id: "clfm_2", areaCode: "LEA", subjectCode: "CLFM 2", subjectName: "Leadership, Decision Making, Management, and Administration", sortOrder: 6 },

  // FS
  { id: "fs_1", areaCode: "FS", subjectCode: "FS 1", subjectName: "Forensic Photography", sortOrder: 1 },
  { id: "fs_2", areaCode: "FS", subjectCode: "FS 2", subjectName: "Personal Identification Techniques", sortOrder: 2 },
  { id: "fs_3", areaCode: "FS", subjectCode: "FS 3", subjectName: "Forensic Chemistry and Toxicology", sortOrder: 3 },
  { id: "fs_4", areaCode: "FS", subjectCode: "FS 4", subjectName: "Questioned Documents Examination", sortOrder: 4 },
  { id: "fs_5", areaCode: "FS", subjectCode: "FS 5", subjectName: "Lie Detection Techniques", sortOrder: 5 },
  { id: "fs_6", areaCode: "FS", subjectCode: "FS 6", subjectName: "Forensic Ballistics", sortOrder: 6 },

  // CDI
  { id: "cdi_1", areaCode: "CDI", subjectCode: "CDI 1", subjectName: "Fundamentals of Criminal Investigation and Intelligence", sortOrder: 1 },
  { id: "cdi_2", areaCode: "CDI", subjectCode: "CDI 2", subjectName: "Special Crime Investigation 1 with Legal Medicine", sortOrder: 2 },
  { id: "cdi_3", areaCode: "CDI", subjectCode: "CDI 3", subjectName: "Special Crime Investigation 2 with Simulation on Interview and Interrogation", sortOrder: 3 },
  { id: "cdi_4", areaCode: "CDI", subjectCode: "CDI 4", subjectName: "Traffic Management and Accident Investigation with Driving", sortOrder: 4 },
  { id: "cdi_5", areaCode: "CDI", subjectCode: "CDI 5", subjectName: "Technical English 1 (Investigative Report Writing and Presentation)", sortOrder: 5 },
  { id: "cdi_6", areaCode: "CDI", subjectCode: "CDI 6", subjectName: "Fire Protection and Arson Investigation", sortOrder: 6 },
  { id: "cdi_7", areaCode: "CDI", subjectCode: "CDI 7", subjectName: "Vice and Drug Education and Control", sortOrder: 7 },
  { id: "cdi_8", areaCode: "CDI", subjectCode: "CDI 8", subjectName: "Technical English 2 (Legal Forms)", sortOrder: 8 },
  { id: "cdi_9", areaCode: "CDI", subjectCode: "CDI 9", subjectName: "Introduction to Cybercrime and Environmental Laws and Protection", sortOrder: 9 },

  // CRIM
  { id: "crim_1", areaCode: "CRIM", subjectCode: "CRIM 1", subjectName: "Introduction to Criminology", sortOrder: 1 },
  { id: "crim_2", areaCode: "CRIM", subjectCode: "CRIM 2", subjectName: "Theories of Crime Causation", sortOrder: 2 },
  { id: "crim_3", areaCode: "CRIM", subjectCode: "CRIM 3", subjectName: "Human Behavior and Victimology", sortOrder: 3 },
  { id: "crim_4", areaCode: "CRIM", subjectCode: "CRIM 4", subjectName: "Professional Conduct and Ethical Standards", sortOrder: 4 },
  { id: "crim_5", areaCode: "CRIM", subjectCode: "CRIM 5", subjectName: "Juvenile Delinquency and Juvenile Justice System", sortOrder: 5 },
  { id: "crim_6", areaCode: "CRIM", subjectCode: "CRIM 6", subjectName: "Dispute Resolution and Crisis/Incident Management", sortOrder: 6 },
  { id: "crim_7", areaCode: "CRIM", subjectCode: "CRIM 7", subjectName: "Criminological Research 1 and 2", sortOrder: 7 },

  // CA
  { id: "ca_1", areaCode: "CA", subjectCode: "CA 1", subjectName: "Institutional Corrections", sortOrder: 1 },
  { id: "ca_2", areaCode: "CA", subjectCode: "CA 2", subjectName: "Non-Institutional Corrections", sortOrder: 2 },
  { id: "ca_3", areaCode: "CA", subjectCode: "CA 3", subjectName: "Therapeutic Modalities", sortOrder: 3 },
];

export function getSubjectsByArea(areaCode: string): CurriculumSubject[] {
  const normArea = areaCode.trim().toUpperCase();
  return CRIMINOLOGY_SUBJECTS.filter(s => s.areaCode === normArea).sort((a, b) => a.sortOrder - b.sortOrder);
}
