export interface Notification {
  id: string;
  recipientId: string;
  revieweeId: string;
  type: string;
  title: string;
  message: string;
  scoreId: string;
  examId: string;
  examTitle: string;
  subject: string;
  isRead: boolean;
  createdAt: any;
  publishedAt: any;
  uniqueKey: string;
  readAt?: any;
}

export type ScoreFolderType = 
  | 'phase_1'
  | 'phase_2'
  | 'phase_3'
  | 'marathon'
  | 'final_coaching'
  | 'pre_board_series'
  | 'custom';

export interface ScoreFolder {
  id: string;
  name: string;
  normalizedName: string;
  type: ScoreFolderType;
  description?: string;
  startDate: any;
  endDate: any | null;
  publicationStatus: 'published' | 'hidden';
  isArchived: boolean;
  includeInReadiness: boolean;
  readinessWeight?: number;
  displayOrder?: number;
  createdBy: string;
  createdAt: any;
  updatedBy: string;
  updatedAt: any;
  archivedAt?: any;
  archivedBy?: string;
  restoredAt?: any;
  restoredBy?: string;
  isDeleted?: boolean;
  deletedAt?: any;
  deletedBy?: string;
  schoolScope: 'all' | 'selected';
  selectedSchoolIds: string[];
  selectedSchoolNames: string[];
  branchScope: 'all' | 'selected';
  selectedBranchIds: string[];
  selectedBranchNames: string[];
}

export interface RevieweeData {
  seqId: string;
  seq_id?: string;
  uid?: string;
  email?: string;
  name?: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  school_name: string;
  reviewBranch?: string;
  review_branch?: string;
  accountStatus?: string;
  timestamp: string;
  exists?: boolean;
  pin?: string;
  isOffline?: boolean;
  id_number?: string;
  student_id?: string;
  studentId?: string;
  institutionalId?: string;
  photo_url?: string;
  photoUrl?: string;
  score_clj?: string;
  score_lea?: string;
  score_fs?: string;
  score_cdi?: string;
  score_crim?: string;
  score_ca?: string;
  preboard_clj?: string;
  preboard_lea?: string;
  preboard_fs?: string;
  preboard_cdi?: string;
  preboard_crim?: string;
  preboard_ca?: string;
  diag_clj?: string;
  diag_lea?: string;
  diag_fs?: string;
  diag_cdi?: string;
  diag_crim?: string;
  diag_ca?: string;
  post_clj?: string;
  post_lea?: string;
  post_fs?: string;
  post_cdi?: string;
  post_crim?: string;
  post_ca?: string;
  final_clj?: string;
  final_lea?: string;
  final_fs?: string;
  final_cdi?: string;
  final_crim?: string;
  final_ca?: string;
  role?: string;
  displayName?: string;
  srcId?: string;
  assessmentRecords?: Record<string, {
    score?: number | string;
    totalScore?: number | string;
    area?: string;
    subjectId?: string;
    category?: string;
    date?: string;
    createdAt?: string;
    title?: string;
    isArchived?: boolean;
    isPublished?: boolean;
  }>;
}
