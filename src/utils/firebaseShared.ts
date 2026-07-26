
export type FirebasePublicConfig = {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  appId?: string;
  messagingSenderId?: string;
  storageBucket?: string;
  measurementId?: string;
  firestoreDatabaseId?: string;
};

export const REQUIRED_FIREBASE_FIELDS: Array<keyof FirebasePublicConfig> = [
  "apiKey",
  "authDomain",
  "projectId",
  "appId",
  "messagingSenderId",
];

export function normalizeConfigValue(value: unknown): string {
  if (typeof value !== "string") return "";

  const normalized = value.trim();

  if (
    normalized === "" ||
    normalized.toLowerCase() === "undefined" ||
    normalized.toLowerCase() === "null" ||
    normalized.startsWith("remixed-") ||
    normalized.toLowerCase().startsWith("your_") ||
    normalized.toLowerCase().startsWith("your-") ||
    normalized.toLowerCase() === "placeholder"
  ) {
    return "";
  }

  return normalized;
}

export function validateFirebaseConfig(config: FirebasePublicConfig) {
  const normalizedConfig = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [
      key,
      normalizeConfigValue(value),
    ])
  ) as FirebasePublicConfig;

  const missingFields = REQUIRED_FIREBASE_FIELDS.filter(
    field => !normalizedConfig[field]
  );

  return {
    valid: missingFields.length === 0,
    missingFields,
    config: normalizedConfig,
  };
}

export function mergeNonEmptyConfig(
  ...sources: FirebasePublicConfig[]
): FirebasePublicConfig {
  const result: FirebasePublicConfig = {};

  for (const source of sources) {
    if (!source) continue;
    for (const [key, value] of Object.entries(source)) {
      const normalized = normalizeConfigValue(value);

      if (normalized && !result[key as keyof FirebasePublicConfig]) {
        result[key as keyof FirebasePublicConfig] = normalized;
      }
    }
  }

  return result;
}
