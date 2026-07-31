import { getSchoolDisplayName } from '../utils/schoolDisplayName';

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

export const INVALID_NAME_VALUES = new Set([
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
  ",",
  ", ",
]);

export function cleanIdentityValue(value: unknown): string {
  if (value === undefined || value === null) return "";
  const cleaned = String(value).trim();
  if (INVALID_NAME_VALUES.has(cleaned.toLowerCase())) {
    return "";
  }
  return cleaned;
}

export function cleanOptionalName(value: unknown): string {
  return cleanIdentityValue(value);
}

export function firstMeaningfulValue(...values: unknown[]): string {
  for (const value of values) {
    const cleaned = cleanIdentityValue(value);
    if (cleaned) {
      return cleaned;
    }
  }
  return "";
}

export function formatMiddleName(value: unknown): string {
  const cleaned = cleanIdentityValue(value);
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
  suffix,
}: {
  firstName?: string;
  middleName?: string;
  lastName?: string;
  suffix?: string;
}): string {
  const first = String(firstName || "").trim().toUpperCase();
  const middle = cleanIdentityValue(middleName).toUpperCase();
  const last = String(lastName || "").trim().toUpperCase();
  const suf = String(suffix || "").trim().toUpperCase();

  const lastWithSuffix = [last, suf].filter(Boolean).join(" ");

  return [
    lastWithSuffix ? `${lastWithSuffix},` : "",
    first,
    middle,
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
  let first = cleanIdentityValue(firstName).toUpperCase();
  let middle = cleanIdentityValue(middleName).toUpperCase();
  let last = cleanIdentityValue(lastName).toUpperCase();
  const suf = cleanIdentityValue(suffix).toUpperCase();
  const fallback = cleanIdentityValue(fallbackFullName).toUpperCase();

  if ((!first || !last) && fallback && !fallback.includes("@")) {
    if (fallback.includes(",")) {
      const parts = fallback.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        if (!last) last = parts[0];
        const rest = parts[1].split(/\s+/);
        if (!first && rest.length > 0) first = rest[0];
        if (!middle && rest.length > 1) {
          middle = rest.slice(1).join(" ");
        }
      } else if (parts.length === 1 && !last) {
        last = parts[0];
      }
    } else {
      const tokens = fallback.split(/\s+/).filter(Boolean);
      if (tokens.length === 1) {
        if (!last) last = tokens[0];
      } else if (tokens.length === 2) {
        if (!first) first = tokens[0];
        if (!last) last = tokens[1];
      } else if (tokens.length >= 3) {
        if (!first) first = tokens[0];
        if (!last) last = tokens[tokens.length - 1];
        if (!middle) {
          middle = tokens.slice(1, tokens.length - 1).join(" ");
        }
      }
    }
  }

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

  const status = String(user.accountStatus || user.status || "").toLowerCase();
  if (status === "merged" || status === "deleted" || user.isDeleted || user.deleted || user.is_deleted) {
    return false;
  }

  const canonical = resolveCanonicalUserIdentity(user);
  const hasName = Boolean(canonical.firstName || canonical.lastName || canonical.fullName);
  const isUnknown = canonical.fullName === "UNKNOWN USER" || canonical.fullName === "";
  
  const hasIdNumber = Boolean(canonical.idNumber && canonical.idNumber !== "-" && canonical.idNumber !== "—" && canonical.idNumber.toLowerCase() !== "na" && canonical.idNumber.toLowerCase() !== "none");
  const hasSchool = Boolean(canonical.school && canonical.school !== "-" && canonical.school !== "—" && canonical.school.toLowerCase() !== "unknown school");

  return Boolean(hasName && !isUnknown && hasIdNumber && hasSchool);
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

  const canonical = resolveCanonicalUserIdentity(user);
  const email = String(user.email ?? "").trim();
  const isCommaOnlyName = canonical.fullName === "," || canonical.fullName === ", ";

  if (isCommaOnlyName) {
    return false;
  }

  return Boolean(email || canonical.firstName || canonical.lastName || canonical.fullName);
}

export function isValidScoreManagementUser(user: CanonicalUserIdentity | null | undefined): boolean {
  if (!user) return false;
  const firstName = String(user.firstName ?? "").trim();
  const middleName = String(user.middleName ?? "").trim();
  const lastName = String(user.lastName ?? "").trim();
  const fullName = String(user.fullName ?? "").trim();

  const isCommaOnlyName = fullName === "," || fullName === ", ";
  const hasValidName = Boolean((firstName || middleName || lastName || fullName) && !isCommaOnlyName && fullName !== "UNKNOWN USER");

  return hasValidName;
}

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
      profilePicture: "",
      isArchived: false,
    };
  }

  const userDocId = String(user.doc_id || user.userDocId || user.id || user.uid || "").trim();
  const firebaseUid = String(user.firebaseUid || user.uid || user.user_uid || "").trim();
  
  const idNumber = normalizeIdNumber(
    firstMeaningfulValue(
      user.idNumber,
      user.id_number,
      user.seqId,
      user.seq_id,
      user.srcId,
      user.src_id,
      user.studentId,
      user.student_id,
      user.studentNumber,
      user.student_number,
      user.revieweeId,
      user.reviewee_id,
      user.officialIdNumber,
      user.official_id_number,
      user.employeeId,
      user.employee_id,
      user.registrationId,
      user.registration_id,
      user.staffId,
      user.staff_id,
      user.adminId,
      user.admin_id,
      user.profile?.idNumber,
      user.profile?.seqId,
      user.profile?.id_number,
      user.profile?.studentId,
      user.personalInfo?.idNumber,
      user.personalInfo?.seqId
    )
  );

  let firstName = firstMeaningfulValue(
    user.firstName,
    user.first_name,
    user.firstname,
    user.givenName,
    user.given_name,
    user.studentFirstName,
    user.student_firstname,
    user.student_first_name,
    user.revieweeFirstName,
    user.reviewee_first_name,
    user.s_firstname,
    user.s_first_name,
    user.fname,
    user.first,
    user.profile?.firstName,
    user.profile?.first_name,
    user.personalInfo?.firstName
  );

  let middleName = firstMeaningfulValue(
    user.middleName,
    user.middle_name,
    user.middlename,
    user.middleInitial,
    user.middle_initial,
    user.studentMiddleName,
    user.student_middlename,
    user.student_middle_name,
    user.revieweeMiddleName,
    user.reviewee_middle_name,
    user.s_middlename,
    user.s_middle_name,
    user.mname,
    user.middle,
    user.profile?.middleName,
    user.profile?.middle_name,
    user.personalInfo?.middleName
  );

  let lastName = firstMeaningfulValue(
    user.lastName,
    user.last_name,
    user.lastname,
    user.surname,
    user.familyName,
    user.family_name,
    user.studentLastName,
    user.student_lastname,
    user.student_last_name,
    user.revieweeLastName,
    user.reviewee_last_name,
    user.s_lastname,
    user.s_last_name,
    user.lname,
    user.last,
    user.profile?.lastName,
    user.profile?.last_name,
    user.personalInfo?.lastName
  );

  const rawFullName = firstMeaningfulValue(
    user.fullName,
    user.full_name,
    user.completeName,
    user.complete_name,
    user.displayName,
    user.display_name,
    user.studentName,
    user.student_name,
    user.revieweeName,
    user.reviewee_name,
    user.registeredName,
    user.registered_name,
    user.name,
    user.profile?.fullName,
    user.profile?.full_name,
    user.personalInfo?.fullName
  );

  if ((!firstName || !lastName) && rawFullName && !rawFullName.includes("@")) {
    if (rawFullName.includes(",")) {
      const parts = rawFullName.split(",").map(p => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        if (!lastName) lastName = parts[0];
        const rest = parts[1].split(/\s+/);
        if (!firstName && rest.length > 0) firstName = rest[0];
        if (!middleName && rest.length > 1) {
          middleName = rest.slice(1).join(" ");
        }
      } else if (parts.length === 1 && !lastName) {
        lastName = parts[0];
      }
    } else {
      const tokens = rawFullName.split(/\s+/).filter(Boolean);
      if (tokens.length === 1) {
        if (!lastName) lastName = tokens[0];
      } else if (tokens.length === 2) {
        if (!firstName) firstName = tokens[0];
        if (!lastName) lastName = tokens[1];
      } else if (tokens.length >= 3) {
        if (!firstName) firstName = tokens[0];
        if (!lastName) lastName = tokens[tokens.length - 1];
        if (!middleName) {
          middleName = tokens.slice(1, tokens.length - 1).join(" ");
        }
      }
    }
  }

  const email = firstMeaningfulValue(
    user.email,
    user.emailAddress,
    user.email_address,
    user.normalizedEmail
  );

  const role = firstMeaningfulValue(
    user.role,
    user.role_name,
    user.userRole,
    user.accountType,
    "Reviewee"
  );

  const rawSchool = firstMeaningfulValue(
    user.school,
    user.schoolName,
    user.school_name,
    user.school_college,
    user.schoolCollege,
    user.college,
    user.institution,
    user.university,
    user.schoolBranch,
    user.school_branch,
    user.school_id,
    user.schoolId,
    user.schoolFolder,
    user.assignedSchool,
    user.profile?.school,
    user.profile?.schoolName,
    user.profile?.school_name,
    user.personalInfo?.school,
    user.personalInfo?.schoolName
  );

  const school = rawSchool ? getSchoolDisplayName(rawSchool) : "";

  const branch = firstMeaningfulValue(
    user.branch,
    user.reviewBranch,
    user.review_branch,
    user.branchName,
    user.branch_name,
    user.assignedBranch,
    user.schoolBranch,
    user.reviewCenterBranch,
    user.profile?.reviewBranch,
    user.profile?.branch,
    user.personalInfo?.reviewBranch
  );

  const profilePicture = firstMeaningfulValue(
    user.photoURL,
    user.photo_url,
    user.photoUrl,
    user.profilePicture,
    user.profile_picture,
    user.avatar
  );

  const isArchived = Boolean(user.isArchived || user.is_archived);

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
    firstName: firstName.toUpperCase(),
    middleName: middleName.toUpperCase(),
    lastName: lastName.toUpperCase(),
    fullName,
    email,
    role,
    school,
    branch,
    profilePicture,
    isArchived,
  };
}
