import type { RiskLevel, Severity } from "@/lib/types";
import { ensureString } from "@/lib/normalize";

export const severityOrder: Record<Severity, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1,
};

export function riskLabel(level: RiskLevel | Severity) {
  return ensureString(level, "unknown")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function riskTone(level: RiskLevel | Severity) {
  switch (ensureString(level).toLowerCase()) {
    case "critical":
      return "border-risk-critical/40 bg-risk-critical/10 text-risk-critical";
    case "high":
      return "border-risk-high/40 bg-risk-high/10 text-risk-high";
    case "medium":
      return "border-risk-medium/45 bg-risk-medium/10 text-risk-medium";
    case "low":
      return "border-risk-low/40 bg-risk-low/10 text-risk-low";
    default:
      return "border-info/35 bg-info/10 text-info";
  }
}

export function statusTone(status: string) {
  const normalized = ensureString(status).toLowerCase();
  if (["ready", "complete", "mitigated", "active", "settled", "success", "allowed", "trusted", "mfa", "not-required"].includes(normalized)) {
    return "border-success/35 bg-success/10 text-success";
  }
  if (["open", "review", "in-progress", "pending", "challenged", "required", "watch"].includes(normalized)) {
    return "border-warning/40 bg-warning/10 text-warning";
  }
  if (["blocked", "denied", "failure", "gap"].includes(normalized)) {
    return "border-danger/40 bg-danger/10 text-danger";
  }
  return "border-border bg-muted text-muted-foreground";
}
