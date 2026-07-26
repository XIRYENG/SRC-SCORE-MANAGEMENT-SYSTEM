import { RevieweeData } from "../types";

export type UserRole = "Admin" | "Staff" | "Reviewee";

export function getDisplayIdNumber(
  role: UserRole,
  profile: RevieweeData | any
): string {
  if (!profile) return "";

  const found = 
    profile.seqId ||
    profile.seq_id ||
    profile.idNumber ||
    profile.id_number ||
    profile.adminId ||
    profile.staffId ||
    profile.employeeId ||
    profile.studentId ||
    profile.student_id ||
    profile.revieweeId ||
    "";

  return found ? String(found).trim() : "";
}
