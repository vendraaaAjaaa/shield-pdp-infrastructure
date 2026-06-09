export type Role = "customer" | "admin" | "auditor" | "pentester";

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type RiskLevel = "critical" | "high" | "medium" | "low";
export type DataClassification =
  | "Public"
  | "Internal"
  | "Confidential"
  | "Personal Data"
  | "Sensitive Personal Data";

export type Status =
  | "active"
  | "blocked"
  | "pending"
  | "review"
  | "ready"
  | "complete"
  | "in-progress"
  | "open"
  | "closed"
  | "mitigated"
  | "accepted";

export interface RoleProfile {
  id: Role;
  label: string;
  userName: string;
  title: string;
  clearance: string;
  homePath: string;
  description: string;
}

export interface Account {
  id: string;
  type: "Primary Wallet" | "Savings Pocket" | "Linked Bank" | "Escrow";
  name: string;
  maskedNumber: string;
  bank: string;
  status: Status;
  balance: number;
  currency: "IDR";
  classification: DataClassification;
  lastActivity: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  transferId?: string;
  merchant: string;
  counterparty?: string;
  category: string;
  amount: number;
  currency: "IDR";
  direction: "in" | "out";
  status: "settled" | "pending" | "blocked" | "review";
  occurredAt: string;
  channel: "Wallet" | "QRIS" | "Virtual Account" | "Bank Transfer";
  risk: RiskLevel;
  note?: string;
  suspiciousReason?: string;
}

export interface Beneficiary {
  id: string;
  accountId: string;
  name: string;
  bank: string;
  maskedAccount: string;
  trustLevel: "trusted" | "new" | "review";
}

export interface ConsentRecord {
  id: string;
  purpose: string;
  status: "granted" | "revoked" | "pending-review";
  grantedAt: string;
  retention: string;
}

export interface PrivacyProfile {
  customerId: string;
  displayName: string;
  maskedNik: string;
  maskedPhone: string;
  emailAlias: string;
  biometricStatus: "Template enrolled" | "Not enrolled" | "Pending re-verification";
  retentionStatus: string;
  deletionRequestStatus: string;
  dataCategories: Array<{
    name: string;
    classification: DataClassification;
    location: string;
    retention: string;
    accessPolicy: string;
  }>;
  consents: ConsentRecord[];
}

export interface SecurityEvent {
  id: string;
  event: string;
  actor: string;
  role: Role | "service";
  source: string;
  timestamp: string;
  result: "allowed" | "denied" | "challenged";
  risk: RiskLevel;
  detail: string;
}

export interface ActiveSession {
  id: string;
  device: string;
  location: string;
  ip: string;
  lastSeen: string;
  trusted: boolean;
  mfa: boolean;
}

export interface ComplianceControl {
  id: "PDP-01" | "PDP-02" | "PDP-03";
  title: string;
  score: number;
  status: "ready" | "gap" | "watch";
  owner: string;
  summary: string;
  evidence: string[];
}

export interface GapAnalysisItem {
  id: string;
  technicalFinding: string;
  impactedData: string;
  pdpRequirement: string;
  risk: RiskLevel;
  evidence: string;
  remediation: string;
  status: Status;
}

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  description: string;
  status: Status;
}

export interface Incident {
  id: string;
  title: string;
  severity: Severity;
  affectedSystems: string[];
  owner: string;
  sla: string;
  status: Status;
  pdpNotificationRequired: boolean;
  affectedData: DataClassification[];
}

export interface Finding {
  id: string;
  title: string;
  severity: Severity;
  cvss: number;
  affectedAsset: string;
  affectedEndpoint: string;
  affectedData: string;
  businessImpact: string;
  pdpImpact: string;
  reproductionSummary: string;
  evidence: string[];
  remediation: string;
  status: Status;
}

export interface AuditLog {
  id: string;
  actor: string;
  role: Role | "service";
  action: string;
  resource: string;
  timestamp: string;
  result: "success" | "denied" | "challenged" | "failure";
  risk: RiskLevel;
  classification: DataClassification;
}

export interface Report {
  id: string;
  title: string;
  description: string;
  status: Status;
  owner: string;
  updatedAt: string;
  classification: DataClassification;
  sections: string[];
  audience?: string;
  controlRefs?: Array<"PDP-01" | "PDP-02" | "PDP-03" | "RoE" | "CVSS">;
  exportReadiness?: string;
}

export interface DashboardSummary {
  walletBalance: number;
  monthlySpending: number;
  privacyScore: number;
  securityScore: number;
  complianceScore: number;
  openFindings: number;
  suspiciousEvents: number;
  transactionVolume: number;
}

export interface RiskMatrixCell {
  likelihood: string;
  impact: string;
  level: RiskLevel;
  count: number;
}

export interface SegmentationPath {
  id: string;
  source: string;
  target: string;
  protocol: string;
  result: "allowed" | "blocked";
  evidence: string;
  timestamp: string;
}

export interface SpendingPoint {
  month: string;
  spending: number;
  income: number;
}

export interface ApiAccessEvent {
  id: string;
  endpoint: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  actor: string;
  role: Role | "service";
  decision: "allowed" | "denied" | "challenged";
  objectOwner: string;
  requestedObject: string;
  timestamp: string;
  evidence: string;
}

export interface TransferDraft {
  beneficiaryId: string;
  amount: number;
  note: string;
  sourceAccountId: string;
  risk: RiskLevel;
}
