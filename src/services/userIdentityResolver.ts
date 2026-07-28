export type CanonicalUserIdentity = {
  userDocId: string;
  firebaseUid: string;
  idNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  fullName: string;
  email: string;
  role: string;
  school: string;
  branch: string;
  profilePicture?: string;
  isArchived?: boolean;
};

export const INVALID_MIDDLE_NAME_VALUES = new Set([
  "",
  "blank",
  "null",
  "undefined",
  "n/a",
  "none",
  "na",
  "-",
  "—",
  "[object object]",
]);

export function cleanOptionalName(value: unknown): string {
  const cleaned = String(value ?? "").trim();
  if (INVALID_MIDDLE_NAME_VALUES.has(cleaned.toLowerCase())) {
    return "";
  }
  return cleaned;
}

export function formatMiddleName(value: unknown): string {
  const cleaned = cleanOptionalName(value);
  return cleaned || "-";
}

export function normalizeForSort(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase();
}

export function normalizeIdNumber(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function formatFullName({
  firstName,
  middleName,
  lastName,
}: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
}): string {
  const first = String(firstName || "").trim().toUpperCase();
  const middle = cleanOptionalName(middleName).toUpperCase();
  const last = String(lastName || "").trim().toUpperCase();

  const middleInitial = middle ? `${middle.charAt(0)}.` : "";
  return [
    first,
    middleInitial,
    last,
  ]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function formatFormalName({
  firstName,
  middleName,
  lastName,
  suffix,
  fallbackFullName,
}: {
  firstName?: unknown;
  middleName?: unknown;
  lastName?: unknown;
  suffix?: unknown;
  fallbackFullName?: unknown;
}): string {
  const first = String(firstName ?? "").trim().toUpperCase();
  const middle = cleanOptionalName(middleName).toUpperCase();
  const last = String(lastName ?? "").trim().toUpperCase();
  const suf = String(suffix ?? "").trim().toUpperCase();
  const fallback = String(fallbackFullName ?? "").trim().toUpperCase();

  const middleInitial = middle ? `${middle.charAt(0)}.` : "";
  const lastWithSuffix = [last, suf].filter(Boolean).join(" ");

  if (lastWithSuffix && first) {
    return `${lastWithSuffix}, ${first}${middleInitial ? ` ${middleInitial}` : ""}`
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }
  if (lastWithSuffix) {
    return lastWithSuffix.toUpperCase();
  }
  if (first) {
    return `${first}${middleInitial ? ` ${middleInitial}` : ""}`.replace(/\s+/g, " ").trim().toUpperCase();
  }
  if (fallback) {
    const cleanFallback = fallback
      .replace(/\b(BLANK|NULL|UNDEFINED|N\/A|NONE|\[OBJECT OBJECT\])\b/gi, "")
      .replace(/,\s*-?\s*\.?$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return (cleanFallback || "UNKNOWN USER").toUpperCase();
  }
  return "UNKNOWN USER";
}

export function compareUsersAlphabetically(a: any, b: any): number {
  const aNorm = resolveCanonicalUserIdentity(a);
  const bNorm = resolveCanonicalUserIdentity(b);

  const lastNameCompare = normalizeForSort(aNorm.lastName).localeCompare(
    normalizeForSort(bNorm.lastName)
  );
  if (lastNameCompare !== 0) return lastNameCompare;

  const firstNameCompare = normalizeForSort(aNorm.firstName).localeCompare(
    normalizeForSort(bNorm.firstName)
  );
  if (firstNameCompare !== 0) return firstNameCompare;

  const middleNameCompare = normalizeForSort(cleanOptionalName(aNorm.middleName)).localeCompare(
    normalizeForSort(cleanOptionalName(bNorm.middleName))
  );
  if (middleNameCompare !== 0) return middleNameCompare;

  return normalizeForSort(aNorm.idNumber || aNorm.userDocId || a?.doc_id || a?.uid).localeCompare(
    normalizeForSort(bNorm.idNumber || bNorm.userDocId || b?.doc_id || b?.uid)
  );
}

export function isValidRevieweeRecord(user: any): boolean {
  if (!user) return false;

  // Account status check
  const status = String(user.accountStatus || user.status || "").toLowerCase();
  if (status === "merged" || status === "deleted" || user.isDeleted || user.deleted || user.is_deleted) {
    return false;
  }

  const idNumber = String(
    user.seq_id ??
    user.seqId ??
    user.id_number ??
    user.idNumber ??
    user.student_id ??
    user.studentId ??
    user.srcId ??
    ""
  ).trim();

  const firstName = String(user.first_name ?? user.firstName ?? "").trim();
  const middleName = String(user.middle_name ?? user.middleName ?? "").trim();
  const lastName = String(user.last_name ?? user.lastName ?? "").trim();
  const fullName = String(user.full_name ?? user.fullName ?? user.displayName ?? user.name ?? "").trim();

  const hasId = Boolean(idNumber && idNumber !== "—" && idNumber !== "-" && idNumber !== "N/A");

  // Check if formatted name is comma-only or blank
  // e.g. ", ", ",", or both last and first names are empty and full name is empty/comma
  const isCommaOnlyName =
    (!lastName && !firstName && (!fullName || fullName === "," || fullName === ", " || fullName.trim() === ",")) ||
    fullName.trim() === "," ||
    fullName.trim() === ", ";

  const hasName = Boolean((firstName || lastName || fullName) && !isCommaOnlyName);

  // A valid reviewee record MUST have both a non-blank ID and a valid (non-comma-only) name
  return Boolean(hasId && hasName && !isCommaOnlyName);
}

export function isValidUserRecord(user: any): boolean {
  if (!user) return false;

  const status = String(user.accountStatus || user.status || "").toLowerCase();
  if (status === "merged" || status === "deleted" || user.isDeleted || user.deleted || user.is_deleted) {
    return false;
  }

  const role = String(user.role || user.role_name || "").toLowerCase();
  const isReviewee = role === "reviewee" || role === "student" || (!role && !user.isAdmin && !user.isStaff);

  if (isReviewee) {
    return isValidRevieweeRecord(user);
  }

  const firstName = String(user.first_name ?? user.firstName ?? "").trim();
  const lastName = String(user.last_name ?? user.lastName ?? "").trim();
  const fullName = String(user.full_name ?? user.fullName ?? user.displayName ?? user.name ?? "").trim();
  const email = String(user.email ?? "").trim();

  const isCommaOnlyName =
    (!lastName && !firstName && (!fullName || fullName === "," || fullName === ", " || fullName.trim() === ",")) ||
    fullName.trim() === "," ||
    fullName.trim() === ", ";

  if (isCommaOnlyName) {
    return false;
  }

  return Boolean(email || firstName || lastName || fullName);
}

export function isValidScoreManagementUser(user: CanonicalUserIdentity | null | undefined): boolean {
  if (!user) return false;
  const idNumber = String(user.idNumber ?? "").trim();
  const firstName = String(user.firstName ?? "").trim();
  const middleName = String(user.middleName ?? "").trim();
  const lastName = String(user.lastName ?? "").trim();
  const fullName = String(user.fullName ?? "").trim();

  const isCommaOnlyName =
    (!lastName && !firstName && (!fullName || fullName === "," || fullName === ", " || fullName.trim() === ",")) ||
    fullName.trim() === "," ||
    fullName.trim() === ", ";

  const hasValidName = Boolean((firstName || middleName || lastName || fullName) && !isCommaOnlyName);
  const hasId = Boolean(idNumber && idNumber !== "—" && idNumber !== "-" && idNumber !== "N/A");

  return Boolean(hasId && hasValidName && !isCommaOnlyName);
}

/**
 * Resolves any user record (from Firestore users collection, score metadata, or CSV row)
 * into a robust CanonicalUserIdentity.
 */
export function resolveCanonicalUserIdentity(user: any): CanonicalUserIdentity {
  if (!user) {
    return {
      userDocId: "",
      firebaseUid: "",
      idNumber: "",
      firstName: "",
      middleName: "",
      lastName: "",
      fullName: "",
      email: "",
      role: "Reviewee",
      school: "",
      branch: "",
      isArchived: false,
    };
  }

  const userDocId = String(user.doc_id || user.userDocId || user.id || user.uid || "").trim();
  const firebaseUid = String(user.firebaseUid || user.uid || user.user_uid || "").trim();
  
  const idNumber = normalizeIdNumber(
    user.idNumber ??
    user.id_number ??
    user.revieweeId ??
    user.reviewee_id ??
    user.staffId ??
    user.staff_id ??
    user.adminId ??
    user.admin_id ??
    user.seq_id ??
    user.seqId ??
    ""
  );

  const firstName = String(
    user.firstName ??
    user.first_name ??
    user.givenName ??
    user.given_name ??
    ""
  ).trim().toUpperCase();

  const middleName = cleanOptionalName(
    user.middleName ??
    user.middle_name ??
    user.middleInitial ??
    user.middle_initial ??
    ""
  ).toUpperCase();

  const lastName = String(
    user.lastName ??
    user.last_name ??
    user.surname ??
    user.familyName ??
    user.family_name ??
    ""
  ).trim().toUpperCase();

  const email = String(
    user.email ??
    user.emailAddress ??
    user.email_address ??
    user.normalizedEmail ??
    ""
  ).trim();

  const role = String(
    user.role ??
    user.userRole ??
    user.accountType ??
    "Reviewee"
  ).trim();

  const school = String(
    user.school ??
    user.schoolName ??
    user.school_name ??
    ""
  ).trim();

  const branch = String(
    user.branch ??
    user.reviewBranch ??
    user.review_branch ??
    ""
  ).trim();

  const profilePicture = user.profilePicture || user.profile_picture || user.avatar || user.photoURL || "";
  const isArchived = Boolean(user.isArchived || user.is_archived);

  const rawFullName = String(
    user.fullName ??
    user.full_name ??
    user.displayName ??
    user.display_name ??
    user.name ??
    ""
  ).trim();

  const fullName = formatFormalName({
    firstName,
    middleName,
    lastName,
    suffix: user.suffix || user.nameExtension,
    fallbackFullName: rawFullName,
  });

  return {
    userDocId,
    firebaseUid,
    idNumber,
    firstName,
    middleName,
    lastName,
    fullName,
    email,
    role,
    school,
    branch,
    profilePicture,
    isArchived,
  };
}
