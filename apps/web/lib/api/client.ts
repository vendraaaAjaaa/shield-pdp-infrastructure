import type {
  Account,
  ActiveSession,
  ApiAccessEvent,
  AuditLog,
  Beneficiary,
  ComplianceControl,
  DashboardSummary,
  DataClassification,
  Finding,
  GapAnalysisItem,
  Incident,
  PrivacyProfile,
  Report,
  RiskLevel,
  RiskMatrixCell,
  SecurityEvent,
  SegmentationPath,
  Severity,
  SpendingPoint,
  Status,
  TimelineEvent,
  Transaction,
} from "@/lib/types";
import {
  mockAccounts,
  mockAdminMetrics,
  mockApiAccessEvents,
  mockAuditLogs,
  mockBeneficiaries,
  mockBreachTimeline,
  mockComplianceControls,
  mockCustomers,
  mockExecutiveExposure,
  mockFindings,
  mockGapAnalysis,
  mockIncidents,
  mockPrivacyProfile,
  mockReports,
  mockRiskMatrix,
  mockSecurityEvents,
  mockSegmentationPaths,
  mockSessions,
  mockSpendingSeries,
  mockSummary,
  mockSystemHealth,
  mockTransactions,
} from "@/lib/api/mock";
import { normalizeSpendingSeries } from "@/lib/chart-data";
import { ensureDateString, ensureNumber, ensureString, normalizeApiItems } from "@/lib/normalize";
import { safeClientId } from "@/lib/safe-id";

type BackendMode = "mock" | "connected";
export type BackendConnectionState = "mock" | "connected" | "error";
type AuthScope = "none" | "customer" | "admin";

type TokenCacheEntry = {
  accessToken: string;
  expiresAt: number;
};

type LegacyAuditEvent = {
  id?: number | string;
  event_type?: string;
  actor_username?: string | null;
  target_type?: string | null;
  target_id?: string | null;
  outcome?: string;
  request_id?: string | null;
  created_at?: string;
};

type LegacyDashboardSummary = {
  risk_score?: number;
  compliance_score?: number;
  active_incidents?: number;
  protected_records?: number;
  services?: Record<string, string>;
  controls?: Array<Record<string, unknown>>;
  incidents?: Array<Record<string, unknown>>;
};

const configuredBaseUrl = (
  process.env.NEXT_PUBLIC_SHIELD_API_BASE_URL ||
  process.env.SHIELD_API_BASE_URL ||
  ""
).replace(/\/$/, "");

function normalizeGatewayRoot(value: string) {
  return value
    .replace(/\/$/, "")
    .replace(/\/api\/v1\/vulnerable$/, "")
    .replace(/\/api\/v1\/secure$/, "")
    .replace(/\/api\/v1\/pentest$/, "");
}

const gatewayRoot = configuredBaseUrl ? normalizeGatewayRoot(configuredBaseUrl) : "";
const baseUrl = gatewayRoot ? `${gatewayRoot}/api/v1/vulnerable` : "";
const bearerToken = process.env.SHIELD_API_BEARER_TOKEN;

const demoCredentials = {
  customer: {
    username: process.env.SHIELD_API_CUSTOMER_USER || process.env.SHIELD_PDP_DEMO_USER || "budi",
    password: process.env.SHIELD_API_CUSTOMER_PASSWORD || process.env.SHIELD_PDP_DEMO_PASSWORD || "password123",
  },
  admin: {
    username: process.env.SHIELD_API_ADMIN_USER || process.env.SHIELD_PDP_ADMIN_USER || "admin",
    password: process.env.SHIELD_API_ADMIN_PASSWORD || process.env.SHIELD_PDP_ADMIN_PASSWORD || "admin12345",
  },
};

const tokenCache: Partial<Record<Exclude<AuthScope, "none">, TokenCacheEntry>> = {};

function requestId() {
  return safeClientId("req");
}

export const authSessionStorageKey = "shield-pdp-auth-session";

export type AuthSession = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  user: {
    username: string;
    role: "customer" | "admin" | "auditor" | "pentester";
    customerId?: string;
    profileId?: string;
    accountIds?: string[];
  };
};

export class BackendApiError extends Error {
  status?: number;
  body?: unknown;

  constructor(message: string, status?: number, body?: unknown) {
    super(message);
    this.name = "BackendApiError";
    this.status = status;
    this.body = body;
  }
}

function buildBackendUrl(path: string) {
  if (!gatewayRoot) return "";
  if (path.startsWith("/api/v1/")) return `${gatewayRoot}${path}`;
  return `${baseUrl}${path}`;
}

function parseAuthSession(value: string | null): AuthSession | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as AuthSession;
    if (parsed?.accessToken && parsed?.user?.username) return parsed;
  } catch {
    return null;
  }
  return null;
}

export function isBackendConfigured() {
  return Boolean(gatewayRoot);
}

export function getGatewayRoot() {
  return gatewayRoot;
}

export function getStoredAuthSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  return parseAuthSession(window.localStorage.getItem(authSessionStorageKey));
}

export function clearStoredAuthSession() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(authSessionStorageKey);
  }
}

export async function loginWithBackend(username: string, password: string): Promise<AuthSession> {
  if (!gatewayRoot) throw new BackendApiError("Backend URL is not configured. Set NEXT_PUBLIC_SHIELD_API_BASE_URL.");
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Request-ID": requestId(),
    },
    body: new URLSearchParams({ username, password }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new BackendApiError(`Login failed with HTTP ${response.status}`, response.status, body);
  }
  const accessToken = asString(body.access_token);
  if (!accessToken) throw new BackendApiError("Login response did not include an access token.", response.status, body);
  const user = isRecord(body.user) ? body.user : {};
  const role = normalizeRole(body.role ?? user.role);
  const session: AuthSession = {
    accessToken,
    refreshToken: asOptionalString(body.refresh_token),
    expiresAt: Date.now() + Number(body.expires_in ?? 1800) * 1000,
    user: {
      username: asString(user.username, username),
      role,
      customerId: asOptionalString(body.customerId ?? user.customerId),
      profileId: asOptionalString(body.profileId ?? user.profileId),
      accountIds: Array.isArray(body.accountIds) ? body.accountIds.map((item: unknown) => String(item)) : undefined,
    },
  };
  if (typeof window !== "undefined") {
    window.localStorage.setItem(authSessionStorageKey, JSON.stringify(session));
  }
  return session;
}

export async function browserApiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!gatewayRoot) throw new BackendApiError("Backend URL is not configured.");
  const session = getStoredAuthSession();
  const response = await fetch(buildBackendUrl(path), {
    ...options,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Request-ID": requestId(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(session?.accessToken ? { Authorization: `Bearer ${session.accessToken}` } : {}),
      ...options.headers,
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json") ? await response.json().catch(() => undefined) : await response.text();
  if (!response.ok) {
    throw new BackendApiError(`Backend request failed with HTTP ${response.status}`, response.status, body);
  }
  return body as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown, fallback = "") {
  return ensureString(value, fallback);
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function normalizeRole(value: unknown): AuthSession["user"]["role"] {
  const role = String(value ?? "").toLowerCase();
  if (["admin", "auditor", "pentester", "customer"].includes(role)) return role as AuthSession["user"]["role"];
  return "customer";
}

function maskDigits(value: unknown) {
  const raw = String(value ?? "");
  if (!raw) return "****";
  return raw.replace(/\d(?=\d{4})/g, "*");
}

function listFromResponse<T>(value: unknown): T[] {
  return normalizeApiItems<T>(value);
}

function normalizeStatus(value: unknown, fallback: Status = "open"): Status {
  const status = String(value ?? "").toLowerCase();
  const allowed: Status[] = [
    "active",
    "blocked",
    "pending",
    "review",
    "ready",
    "complete",
    "in-progress",
    "open",
    "closed",
    "mitigated",
    "accepted",
  ];
  return allowed.includes(status as Status) ? (status as Status) : fallback;
}

function normalizeRisk(value: unknown, fallback: RiskLevel = "medium"): RiskLevel {
  const risk = String(value ?? "").toLowerCase();
  return ["critical", "high", "medium", "low"].includes(risk) ? (risk as RiskLevel) : fallback;
}

function normalizeSeverity(value: unknown, fallback: Severity = "medium"): Severity {
  const severity = String(value ?? "").toLowerCase();
  return ["critical", "high", "medium", "low", "info"].includes(severity) ? (severity as Severity) : fallback;
}

function classificationForAudit(action: string): DataClassification {
  if (action.includes("biometric") || action.includes("nik") || action.includes("profile") || action.includes("idor")) {
    return "Sensitive Personal Data";
  }
  if (action.includes("account") || action.includes("bola")) return "Confidential";
  if (action.includes("admin")) return "Internal";
  return "Internal";
}

function riskForAudit(outcome: unknown, action = ""): RiskLevel {
  const normalized = String(outcome ?? "").toLowerCase();
  if (action.includes("lab.") && normalized === "success") return "critical";
  if (normalized === "denied" || normalized === "failure") return "high";
  if (action.includes("admin") || action.includes("profile") || action.includes("account")) return "medium";
  return "low";
}

function resultForAudit(outcome: unknown): AuditLog["result"] {
  const normalized = String(outcome ?? "").toLowerCase();
  if (normalized === "success") return "success";
  if (normalized === "denied") return "denied";
  if (normalized === "challenged") return "challenged";
  return "failure";
}

async function getAccessToken(scope: Exclude<AuthScope, "none">): Promise<string | undefined> {
  if (!baseUrl) return undefined;
  if (bearerToken) return bearerToken;

  const cached = tokenCache[scope];
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.accessToken;

  const credentials = demoCredentials[scope];
  const response = await fetch(`${baseUrl}/login`, {
    method: "POST",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Request-ID": requestId(),
    },
    body: new URLSearchParams(credentials),
  });

  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new BackendApiError(`Backend login failed with HTTP ${response.status}`, response.status, body);
  }
  const accessToken = asString(body.access_token);
  if (!accessToken) {
    throw new BackendApiError("Backend login response did not include an access token.", response.status, body);
  }

  tokenCache[scope] = {
    accessToken,
    expiresAt: Date.now() + Number(body.expires_in ?? 1800) * 1000,
  };
  return accessToken;
}

async function fetchJson<T>(path: string, auth: AuthScope = "none"): Promise<T | undefined> {
  if (!baseUrl) return undefined;

  const scopedToken = auth === "none" ? undefined : await getAccessToken(auth);
  const response = await fetch(buildBackendUrl(path), {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Request-ID": requestId(),
      ...(scopedToken ? { Authorization: `Bearer ${scopedToken}` } : {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("json") ? await response.json().catch(() => undefined) : await response.text();
  if (!response.ok) {
    throw new BackendApiError(`Backend request failed with HTTP ${response.status}: ${path}`, response.status, body);
  }
  return body as T;
}

async function firstAvailable<T>(paths: string[], fallback: T, auth: AuthScope = "none"): Promise<T> {
  if (!baseUrl) return fallback;
  for (const path of paths) {
    const data = await fetchJson<T>(path, auth);
    if (data !== undefined && data !== null) return data;
  }
  throw new BackendApiError(`Backend returned no data for ${paths.join(", ")}.`);
}

async function tryFetchJson<T>(path: string, auth: AuthScope = "none"): Promise<T | undefined> {
  try {
    return await fetchJson<T>(path, auth);
  } catch {
    return undefined;
  }
}

async function getLegacyDashboardSummary(): Promise<LegacyDashboardSummary | undefined> {
  return fetchJson<LegacyDashboardSummary>("/dashboard/summary");
}

async function getLegacyAuditEvents(): Promise<LegacyAuditEvent[]> {
  const legacy = await fetchJson<unknown>("/audit/events?limit=200", "admin");
  const items = listFromResponse<Record<string, unknown>>(legacy);
  if (items.length && items.every((item) => isRecord(item) && "action" in item)) {
    return items.map((event, index) => ({
      id: String(event.id ?? event.auditEventId ?? index),
      event_type: asString(event.action ?? event.event_type, "audit.event"),
      actor_username: asOptionalString(event.actorUsername ?? event.actor_username),
      target_type: asOptionalString(event.resourceType ?? event.target_type),
      target_id: asOptionalString(event.resourceId ?? event.target_id),
      outcome: asString(event.result ?? event.outcome, "success"),
      request_id: asOptionalString(event.correlationId ?? event.request_id),
      created_at: asString(event.timestamp ?? event.created_at, new Date().toISOString()),
    }));
  }
  return items as LegacyAuditEvent[];
}

function dashboardToSummary(summary: LegacyDashboardSummary): DashboardSummary {
  return {
    walletBalance: 0,
    monthlySpending: 0,
    privacyScore: ensureNumber(summary.compliance_score),
    securityScore: Math.max(0, 100 - ensureNumber(summary.risk_score, 100)),
    complianceScore: ensureNumber(summary.compliance_score),
    openFindings: ensureNumber(summary.active_incidents),
    suspiciousEvents: ensureNumber(summary.active_incidents),
    transactionVolume: 0,
  };
}

function backendAccountToAccount(account: Record<string, unknown>, index: number): Account {
  if ("maskedNumber" in account || "accountId" in account) {
    return {
      id: asString(account.id ?? account.accountId, `ACC-BACKEND-${index + 1}`),
      type: normalizeAccountType(account.type, index),
      name: asString(account.name, `Backend account ${index + 1}`),
      maskedNumber: asString(account.maskedNumber ?? account.accountNumberMasked, maskDigits(account.account_number)),
      bank: asString(account.bank, "Dana Sejahtera Wallet"),
      status: normalizeStatus(account.status, "active"),
      balance: ensureNumber(account.balance),
      currency: "IDR",
      classification: normalizeClassification(account.classification),
      lastActivity: ensureDateString(account.lastActivity),
    };
  }
  return {
    id: asString(account.account_id, `acct-backend-${String(account.id ?? index + 1)}`),
    type: index === 0 ? "Primary Wallet" : "Linked Bank",
    name: index === 0 ? "Shield-PDP backend wallet" : `Backend account ${String(account.id ?? index + 1)}`,
    maskedNumber: maskDigits(account.account_number),
    bank: "Shield-PDP API",
    status: "active",
    balance: ensureNumber(account.balance),
    currency: "IDR",
    classification: "Confidential",
    lastActivity: ensureDateString(account.lastActivity),
  };
}

function normalizeAccountType(value: unknown, index: number): Account["type"] {
  const raw = String(value ?? "");
  if (["Primary Wallet", "Savings Pocket", "Linked Bank", "Escrow"].includes(raw)) return raw as Account["type"];
  return index === 0 ? "Primary Wallet" : "Linked Bank";
}

function normalizeClassification(value: unknown): DataClassification {
  const raw = String(value ?? "");
  if (["Public", "Internal", "Confidential", "Personal Data", "Sensitive Personal Data"].includes(raw)) return raw as DataClassification;
  return "Confidential";
}

function backendTransactionToTransaction(transaction: Record<string, unknown>): Transaction {
  return {
    id: asString(transaction.id ?? transaction.transactionId, "TRX-BACKEND"),
    accountId: asString(transaction.accountId, "ACC-BACKEND"),
    transferId: asOptionalString(transaction.transferId),
    merchant: asString(transaction.merchant ?? transaction.counterparty, "Synthetic transaction"),
    counterparty: asOptionalString(transaction.counterparty),
    category: asString(transaction.category, "Transfer"),
    amount: ensureNumber(transaction.amount),
    currency: "IDR",
    direction: String(transaction.direction ?? "out") === "in" ? "in" : "out",
    status: normalizeTransactionStatus(transaction.status),
    occurredAt: ensureDateString(transaction.occurredAt),
    channel: normalizeChannel(transaction.channel),
    risk: normalizeRisk(transaction.risk, "low"),
    note: asOptionalString(transaction.note),
    suspiciousReason: asOptionalString(transaction.suspiciousReason),
  };
}

function normalizeTransactionStatus(value: unknown): Transaction["status"] {
  const raw = String(value ?? "").toLowerCase();
  if (["settled", "pending", "blocked", "review"].includes(raw)) return raw as Transaction["status"];
  if (raw === "posted") return "settled";
  return "settled";
}

function normalizeChannel(value: unknown): Transaction["channel"] {
  const raw = String(value ?? "");
  if (["Wallet", "QRIS", "Virtual Account", "Bank Transfer"].includes(raw)) return raw as Transaction["channel"];
  return "Wallet";
}

function segmentationStatusToPaths(statusPayload: Record<string, unknown>): SegmentationPath[] {
  const timestamp = ensureDateString(statusPayload.createdAt);
  const evidence = asString(statusPayload.pdpImpact, "Remote PostgreSQL segmentation evidence returned by backend.");
  return [
    {
      id: "SEG-FRONTEND-GATEWAY",
      source: "Frontend/Cloud Portal",
      target: "API Gateway",
      protocol: "HTTP 3000",
      result: "allowed",
      evidence: "Frontend traffic reaches the API gateway for BurpSuite-visible lab requests.",
      timestamp,
    },
    {
      id: "SEG-GATEWAY-API",
      source: "API Gateway",
      target: "Backend API",
      protocol: "Docker internal HTTP",
      result: "allowed",
      evidence: "Gateway proxies only approved API namespaces to the backend service.",
      timestamp,
    },
    {
      id: asString(statusPayload.evidenceId, "EVD-SEG-REMOTE-DB-001"),
      source: "Backend API",
      target: "shield-db PostgreSQL",
      protocol: "PostgreSQL 5432 over Tailscale",
      result: "allowed",
      evidence,
      timestamp,
    },
    {
      id: "SEG-PUBLIC-DB-BLOCKED",
      source: "Public network",
      target: "shield-db PostgreSQL",
      protocol: "PostgreSQL 5432",
      result: "blocked",
      evidence: asString(statusPayload.firewallPolicy, "5432 is allowed only from shield-cloud over tailscale0."),
      timestamp,
    },
  ];
}

function auditEventToLog(event: LegacyAuditEvent): AuditLog {
  const action = asString(event.event_type, "audit.event");
  const resource = [event.target_type, event.target_id].filter(Boolean).join(":") || asString(event.request_id, "unknown-resource");
  return {
    id: `AUD-${String(event.id ?? event.request_id ?? "backend")}`,
    actor: asString(event.actor_username, "system"),
    role: action.includes("admin") ? "admin" : action.includes("lab.") ? "pentester" : "customer",
    action,
    resource,
    timestamp: ensureDateString(event.created_at),
    result: resultForAudit(event.outcome),
    risk: riskForAudit(event.outcome, action),
    classification: classificationForAudit(action),
  };
}

function auditEventToSecurityEvent(event: LegacyAuditEvent): SecurityEvent {
  const action = asString(event.event_type, "audit.event");
  const result = resultForAudit(event.outcome);
  return {
    id: `SEC-${String(event.id ?? event.request_id ?? "backend")}`,
    event: action.replace(/\./g, " "),
    actor: asString(event.actor_username, "system"),
    role: action.includes("admin") ? "admin" : action.includes("lab.") ? "pentester" : "customer",
    source: [event.target_type, event.target_id].filter(Boolean).join(":") || "backend audit stream",
    timestamp: ensureDateString(event.created_at),
    result: result === "success" ? "allowed" : result === "denied" || result === "failure" ? "denied" : "challenged",
    risk: riskForAudit(event.outcome, action),
    detail: `Backend audit event ${action} returned ${String(event.outcome ?? "unknown")} with request ${event.request_id ?? "n/a"}.`,
  };
}

function auditEventToAccessEvidence(event: LegacyAuditEvent): ApiAccessEvent | undefined {
  const action = asString(event.event_type);
  if (!["profile.read", "account.read", "lab.idor.profile_exfiltration", "lab.bola.account_exfiltration"].includes(action)) {
    return undefined;
  }

  const isAccount = action.includes("account") || action.includes("bola");
  const result = resultForAudit(event.outcome);
  return {
    id: `BOLA-${String(event.id ?? event.request_id ?? "backend")}`,
    endpoint: isAccount ? `/api/v1/vulnerable/accounts/${event.target_id ?? ":id"}` : `/api/v1/vulnerable/profiles/${event.target_id ?? ":id"}`,
    method: "GET",
    actor: asString(event.actor_username, "unknown"),
    role: action.includes("lab.") ? "pentester" : "customer",
    decision: result === "success" ? "allowed" : result === "denied" || result === "failure" ? "denied" : "challenged",
    objectOwner: `${event.target_type ?? "object"}:${event.target_id ?? "unknown"}`,
    requestedObject: `${event.target_type ?? "object"}:${event.target_id ?? "unknown"}`,
    timestamp: ensureDateString(event.created_at),
    evidence: action.includes("lab.")
      ? "Backend lab audit event records a controlled vulnerable-demo access. Use only in authorized Shield-PDP scope."
      : "Backend secure endpoint recorded object-level authorization enforcement with an auditable decision.",
  };
}

function dashboardControlsToCompliance(summary: LegacyDashboardSummary): ComplianceControl[] {
  const backendEvidence = Array.isArray(summary.controls)
    ? summary.controls
    : [];
  const ids: Array<ComplianceControl["id"]> = ["PDP-01", "PDP-02", "PDP-03"];

  if (!backendEvidence.length) return [];

  return backendEvidence.slice(0, 3).map((control, index) => {
    const statusRaw = String(control.status ?? "").toLowerCase();
    const status: ComplianceControl["status"] = statusRaw.includes("gap") ? "gap" : statusRaw.includes("watch") ? "watch" : "ready";
    const title = asString(control.name, `Backend PDP control ${index + 1}`);
    const detail = asString(control.detail ?? control.status, "Backend control evidence reported.");
    return {
      id: ids[index] ?? "PDP-02",
      title,
      score: ensureNumber(summary.compliance_score),
      status,
      owner: "Backend evidence stream",
      summary: detail,
      evidence: [`${title}: ${detail}`],
    };
  });
}

function dashboardIncidentsToIncidents(summary: LegacyDashboardSummary): Incident[] {
  if (!Array.isArray(summary.incidents) || !summary.incidents.length) return [];

  return summary.incidents.map((incident, index) => ({
    id: `INC-BE-${String(index + 1).padStart(3, "0")}`,
    title: asString(incident.title, "Backend incident"),
    severity: normalizeSeverity(incident.severity, "medium"),
    affectedSystems: ["Shield-PDP API", "Authorization controls"],
    owner: index === 0 ? "Raka Operations" : "Intan Compliance",
    sla: index === 0 ? "6h response" : "12h review",
    status: "open",
    pdpNotificationRequired: String(incident.severity ?? "").toLowerCase() === "critical",
    affectedData: ["Confidential", "Sensitive Personal Data"],
  }));
}

export function getBackendMode(): BackendMode {
  return baseUrl ? "connected" : "mock";
}

export async function getBackendConnectionState(): Promise<BackendConnectionState> {
  if (!baseUrl) return "mock";
  try {
    const ready = await fetchJson<Record<string, unknown>>("/ready");
    return ready?.status === "ready" && ready?.database === "ok" ? "connected" : "error";
  } catch {
    return "error";
  }
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const legacy = await getLegacyDashboardSummary();
  if (legacy) return dashboardToSummary(legacy);

  return firstAvailable<DashboardSummary>(["/api/v1/fintech/dashboard"], mockSummary);
}

export async function getAccounts(): Promise<Account[]> {
  if (!baseUrl) return mockAccounts;
  const legacy = await fetchJson<unknown>("/me/accounts", "customer");
  const accounts = listFromResponse<Record<string, unknown>>(legacy);
  if (accounts.length) return accounts.map(backendAccountToAccount);

  return [];
}

export async function getTransactions(): Promise<Transaction[]> {
  if (!baseUrl) return mockTransactions;
  const expected = await fetchJson<unknown>("/me/transactions", "customer");
  const transactions = listFromResponse<Record<string, unknown>>(expected);
  if (transactions.length) return transactions.map(backendTransactionToTransaction);

  return [];
}

export async function getBeneficiaries(): Promise<Beneficiary[]> {
  return firstAvailable<Beneficiary[]>(["/api/v1/fintech/beneficiaries"], mockBeneficiaries, "customer");
}

export async function getPrivacyProfile(): Promise<PrivacyProfile> {
  if (!baseUrl) return mockPrivacyProfile;
  const expected = await tryFetchJson<PrivacyProfile>("/api/v1/privacy/profile", "customer");
  if (expected && isRecord(expected) && "dataCategories" in expected) return expected;

  const legacy = await fetchJson<Record<string, unknown>>("/me/profile", "customer");
  if (legacy) {
    return {
      customerId: `USER-${String(legacy.user_id ?? "Unknown")}`,
      displayName: asString(legacy.full_name, "Unknown"),
      maskedNik: maskDigits(legacy.nik),
      maskedPhone: maskDigits(legacy.phone),
      emailAlias: asString(legacy.email, "Unknown"),
      biometricStatus: "Template enrolled",
      retentionStatus: "Live backend profile loaded. Detailed retention categories are unavailable from the current backend response.",
      deletionRequestStatus: "Unknown",
      dataCategories: [],
      consents: [],
    };
  }

  throw new BackendApiError("Backend privacy profile data is unavailable.");
}

export async function getSecurityEvents(): Promise<SecurityEvent[]> {
  if (!baseUrl) return mockSecurityEvents;
  const expected = await tryFetchJson<SecurityEvent[]>("/api/v1/security/events", "admin");
  if (Array.isArray(expected) && expected.every((item) => isRecord(item) && "event" in item)) return expected;

  const auditEvents = await getLegacyAuditEvents();
  if (auditEvents.length) return auditEvents.slice(0, 12).map(auditEventToSecurityEvent);

  return [];
}

export async function getSessions(): Promise<ActiveSession[]> {
  return firstAvailable<ActiveSession[]>(["/api/v1/security/sessions"], mockSessions, "customer");
}

export async function getComplianceControls(): Promise<ComplianceControl[]> {
  if (!baseUrl) return mockComplianceControls;
  const expected = await tryFetchJson<ComplianceControl[]>("/api/v1/compliance/status", "admin");
  if (Array.isArray(expected) && expected.every((item) => isRecord(item) && "id" in item && "score" in item)) return expected;

  const legacy = await getLegacyDashboardSummary();
  if (legacy) return dashboardControlsToCompliance(legacy);

  return [];
}

export async function getGapAnalysis(): Promise<GapAnalysisItem[]> {
  if (!baseUrl) return mockGapAnalysis;
  const expected = await tryFetchJson<GapAnalysisItem[]>("/api/v1/compliance/gap-analysis", "admin");
  if (Array.isArray(expected) && expected.every((item) => isRecord(item) && "technicalFinding" in item)) return expected;

  const findings = await getFindings();
  if (!findings.length) return [];
  return findings.map((finding) => ({
    id: finding.id,
    technicalFinding: finding.title,
    impactedData: finding.affectedData,
    pdpRequirement: "PDP-02 access control and auditability for personal data access",
    risk: normalizeRisk(finding.severity, "medium"),
    evidence: finding.evidence[0] ?? "Backend finding evidence is unavailable.",
    remediation: finding.remediation,
    status: finding.status,
  }));
}

export async function getBreachTimeline(): Promise<TimelineEvent[]> {
  if (!baseUrl) return mockBreachTimeline;
  const expected = await fetchJson<TimelineEvent[]>("/api/v1/compliance/breach-notification", "admin");
  if (Array.isArray(expected) && expected.every((item) => isRecord(item) && "title" in item)) return expected;
  return [];
}

export async function getFindings(): Promise<Finding[]> {
  if (!baseUrl) return mockFindings;
  const expected = await fetchJson<unknown>("/api/v1/pentest/findings", "admin");
  const findings = listFromResponse<Finding>(expected);
  if (findings.length) return findings;

  return [];
}

export async function getApiAccessEvidence(): Promise<ApiAccessEvent[]> {
  if (!baseUrl) return mockApiAccessEvents;
  const auditEvents = await getLegacyAuditEvents();
  const evidence = auditEvents.map(auditEventToAccessEvidence).filter((event): event is ApiAccessEvent => Boolean(event));
  return evidence;
}

export async function getSegmentationPaths(): Promise<SegmentationPath[]> {
  const expected = await fetchJson<Record<string, unknown>>("/segmentation/internal-db/status");
  if (expected?.evidenceId) return segmentationStatusToPaths(expected);
  return mockSegmentationPaths;
}

export async function getIncidents(): Promise<Incident[]> {
  if (!baseUrl) return mockIncidents;
  const expected = await tryFetchJson<Incident[]>("/api/v1/incidents", "admin");
  if (Array.isArray(expected) && expected.every((item) => isRecord(item) && "severity" in item && "affectedSystems" in item)) return expected;

  const legacy = await getLegacyDashboardSummary();
  if (legacy) return dashboardIncidentsToIncidents(legacy);

  return [];
}

export async function getAuditLogs(): Promise<AuditLog[]> {
  if (!baseUrl) return mockAuditLogs;
  const auditEvents = await getLegacyAuditEvents();
  if (auditEvents.length) return auditEvents.map(auditEventToLog);

  return [];
}

export async function getReports(): Promise<Report[]> {
  return firstAvailable<Report[]>(["/api/v1/reports"], mockReports, "admin");
}

export async function getSpendingSeries(): Promise<SpendingPoint[]> {
  if (!baseUrl) return mockSpendingSeries;
  const expected = await fetchJson<unknown>("/api/v1/fintech/analytics/spending", "customer");
  return normalizeSpendingSeries(expected);
}

export async function getRiskMatrix(): Promise<RiskMatrixCell[]> {
  return firstAvailable<RiskMatrixCell[]>(["/api/v1/risk/matrix"], mockRiskMatrix, "admin");
}

export async function getAdminMetrics() {
  if (!baseUrl) return mockAdminMetrics;
  const [summary, usersResponse, audits] = await Promise.all([
    getLegacyDashboardSummary(),
    fetchJson<unknown>("/admin/users", "admin"),
    getLegacyAuditEvents(),
  ]);
  const users = listFromResponse<Record<string, unknown>>(usersResponse);

  return {
    customers: users.length ? users.length : ensureNumber(summary?.protected_records),
    transactionVolume: 0,
    failedLogins: audits.filter((event) => event.event_type === "auth.login" && event.outcome !== "success").length,
    suspiciousApiCalls: audits.filter((event) => riskForAudit(event.outcome, event.event_type) !== "low").length,
    openIncidents: ensureNumber(summary?.active_incidents, audits.filter((event) => event.outcome === "denied").length),
  };
}

export async function getSystemHealth() {
  if (!baseUrl) return mockSystemHealth;
  const [health, ready, summary] = await Promise.all([
    fetchJson<Record<string, unknown>>("/health"),
    fetchJson<Record<string, unknown>>("/ready"),
    getLegacyDashboardSummary(),
  ]);

  const services = summary?.services ?? {};
  return [
    {
      service: "API gateway",
      status: health?.status === "ok" ? "ready" : "watch",
      latency: `${Math.round(Number(health?.uptime_seconds ?? 0))}s uptime`,
      owner: "Platform",
    },
    {
      service: "Database",
      status: ready?.database === "ok" ? "ready" : "watch",
      latency: `${Number(ready?.seeded_users ?? summary?.protected_records ?? 0)} seeded users`,
      owner: "Platform",
    },
    {
      service: "Authorization controls",
      status: services.api === "ready" ? "ready" : "watch",
      latency: `${Number(summary?.active_incidents ?? 0)} denials`,
      owner: "Security",
    },
    {
      service: "Audit log pipeline",
      status: "ready",
      latency: "backend stream",
      owner: "SOC",
    },
    {
      service: "Report export",
      status: "watch",
      latency: "backend route pending",
      owner: "Compliance",
    },
  ];
}

export async function getCustomers() {
  if (!baseUrl) return mockCustomers;
  const usersResponse = await fetchJson<unknown>("/admin/users", "admin");
  const users = listFromResponse<Record<string, unknown>>(usersResponse);
  if (!users.length) return [];

  return users.map((user, index) => ({
    id: `USER-${String(user.id ?? index + 1).padStart(4, "0")}`,
    name: asString(user.username, `user-${index + 1}`),
    tier: user.role === "admin" ? "Internal" : "Standard",
    status: Number(user.is_active ?? 1) === 1 ? "active" : "blocked",
    maskedNik: `backend-user-****${String(user.id ?? index + 1).padStart(4, "0")}`,
    risk: user.role === "admin" ? "medium" : "low",
  }));
}

export async function getExecutiveExposure() {
  if (!baseUrl) return mockExecutiveExposure;
  const summary = await getLegacyDashboardSummary();
  if (!summary) {
    return {
      regulatoryImpact: "Unknown",
      operationalRisk: "Unknown",
      financialExposure: 0,
      readinessScore: 0,
      remediationProgress: 0,
    };
  }

  return {
    regulatoryImpact: Number(summary.active_incidents ?? 0) > 0 ? "PDP review required for denied sensitive access events" : "Current backend evidence shows controls operating",
    operationalRisk: Number(summary.active_incidents ?? 0) > 0 ? "High" : "Moderate",
    financialExposure: 0,
    readinessScore: ensureNumber(summary.compliance_score),
    remediationProgress: Math.max(0, Math.min(100, ensureNumber(summary.compliance_score) - 35)),
  };
}
