const arrayEnvelopeKeys = [
  "items",
  "data",
  "results",
  "rows",
  "records",
  "entries",
  "list",
  "values",
  "series",
  "trend",
  "monthlyActivity",
  "spending",
  "accounts",
  "transactions",
  "events",
  "logs",
  "findings",
  "controls",
  "incidents",
  "reports",
  "paths",
  "sessions",
  "gaps",
] as const;

const objectEnvelopeKeys = ["data", "item", "record", "payload", "summary", "result"] as const;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function ensureArray<T>(value: unknown, fallback: T[] = []): T[] {
  const extracted = extractArray(value);
  return extracted ? (extracted as T[]) : fallback;
}

export function normalizeApiItems<T>(value: unknown): T[] {
  return ensureArray<T>(value);
}

export function ensureObject<T extends Record<string, unknown>>(value: unknown, fallback: T): T {
  const extracted = extractObject(value);
  return extracted ? (extracted as T) : fallback;
}

export function ensureNumber(value: unknown, fallback = 0): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function ensureString(value: unknown, fallback = ""): string {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? trimmed : fallback;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  return fallback;
}

export function ensureBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n"].includes(normalized)) return false;
  }
  return fallback;
}

export function ensureDateString(value: unknown, fallback = "1970-01-01T00:00:00.000Z"): string {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value.toISOString();
  }

  const candidate = ensureString(value);
  if (!candidate) return fallback;
  const parsed = new Date(candidate);
  return Number.isNaN(parsed.getTime()) ? fallback : candidate;
}

export function errorMessage(value: unknown, fallback = "Backend request failed"): string {
  if (value instanceof Error && value.message) return value.message;
  if (isRecord(value) && typeof value.message === "string") return value.message;
  if (isRecord(value) && typeof value.detail === "string") return value.detail;
  return fallback;
}

function extractArray(value: unknown, depth = 0): unknown[] | undefined {
  if (Array.isArray(value)) return value;
  if (!isRecord(value) || depth > 2) return undefined;

  for (const key of arrayEnvelopeKeys) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate;
  }

  for (const key of arrayEnvelopeKeys) {
    const candidate = value[key];
    if (isRecord(candidate)) {
      const nested = extractArray(candidate, depth + 1);
      if (nested) return nested;
    }
  }

  return undefined;
}

function extractObject(value: unknown, depth = 0): Record<string, unknown> | undefined {
  if (isRecord(value)) {
    for (const key of objectEnvelopeKeys) {
      const candidate = value[key];
      if (isRecord(candidate)) {
        return depth < 2 ? extractObject(candidate, depth + 1) ?? candidate : candidate;
      }
    }
    return value;
  }
  return undefined;
}
