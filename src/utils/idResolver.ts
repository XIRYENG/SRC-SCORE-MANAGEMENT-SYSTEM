import { RevieweeData } from "../types";
import { resolveCanonicalUserIdentity } from "../services/userIdentityResolver";

export type UserRole = "Admin" | "Staff" | "Reviewee";

export function getDisplayIdNumber(
  role: UserRole,
  profile: RevieweeData | any
): string {
  if (!profile) return "";

  const canonical = resolveCanonicalUserIdentity(profile);
  if (canonical.idNumber) {
    return canonical.idNumber;
  }

  const found = 
    profile.idNumber ||
    profile.id_number ||
    profile.seqId ||
    profile.seq_id ||
    profile.srcId ||
    profile.src_id ||
    profile.studentId ||
    profile.student_id ||
    profile.adminId ||
    profile.staffId ||
    profile.employeeId ||
    profile.revieweeId ||
    "";

  return found ? String(found).trim() : "";
}
