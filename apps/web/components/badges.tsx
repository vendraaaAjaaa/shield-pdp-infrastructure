import type { DataClassification, RiskLevel, Severity, Status } from "@/lib/types";
import type { ReactNode } from "react";
import { riskLabel, riskTone, statusTone } from "@/lib/risk";
import { ensureString } from "@/lib/normalize";
import { cn } from "@/lib/utils";

const classificationTone: Record<DataClassification, string> = {
  Public: "border-border bg-muted text-muted-foreground",
  Internal: "border-info/30 bg-info/10 text-info",
  Confidential: "border-primary/30 bg-primary/10 text-primary",
  "Personal Data": "border-warning/40 bg-warning/10 text-warning",
  "Sensitive Personal Data": "border-risk-critical/35 bg-risk-critical/10 text-risk-critical",
};

function BaseBadge({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span className={cn("inline-flex h-6 max-w-full items-center rounded-full border px-2.5 text-xs font-semibold", className)}>
      <span className="truncate">{children}</span>
    </span>
  );
}

export function RiskBadge({ level }: { level: RiskLevel | Severity }) {
  return <BaseBadge className={riskTone(level)}>{riskLabel(level)}</BaseBadge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  return <BaseBadge className={riskTone(severity)}>{riskLabel(severity)}</BaseBadge>;
}

export function StatusPill({ status }: { status: Status | string }) {
  const label = ensureString(status, "unknown").replace(/-/g, " ");
  return <BaseBadge className={statusTone(status)}>{label}</BaseBadge>;
}

export function DataClassificationBadge({ classification }: { classification: DataClassification }) {
  const label: DataClassification = classificationTone[classification] ? classification : "Internal";
  return <BaseBadge className={classificationTone[label]}>{label}</BaseBadge>;
}
