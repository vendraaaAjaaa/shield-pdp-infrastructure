"use client";

import { BookMarked, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AuditLogTable } from "@/components/audit-log-table";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { browserApiFetch, getStoredAuthSession, isBackendConfigured } from "@/lib/api/client";
import { mockAuditLogs } from "@/lib/api/mock";
import { ensureDateString, ensureObject, ensureString, normalizeApiItems } from "@/lib/normalize";
import type { AuditLog, DataClassification, RiskLevel, Role } from "@/lib/types";

function normalizeAuditLog(value: unknown, index: number): AuditLog {
  const source = ensureObject<Record<string, unknown>>(value, {});
  const role = String(source.actorRole ?? source.role ?? "service");
  const risk = String(source.risk ?? "low");
  const result = String(source.result ?? source.outcome ?? "success");
  const action = ensureString(source.action ?? source.event_type, "audit.event");
  const classification: DataClassification = action.includes("account") || action.includes("transaction") || action.includes("transfer") ? "Confidential" : action.includes("profile") ? "Sensitive Personal Data" : "Internal";
  return {
    id: ensureString(source.auditEventId ?? source.id, `AUD-BE-${index}`),
    actor: ensureString(source.actorUsername ?? source.actor_username, "system"),
    role: ["customer", "admin", "auditor", "pentester"].includes(role) ? (role as Role) : "service",
    action,
    resource: [source.resourceType ?? source.target_type, source.resourceId ?? source.target_id].filter(Boolean).join(":") || "backend",
    timestamp: ensureDateString(source.timestamp ?? source.created_at),
    result: ["success", "denied", "challenged", "failure"].includes(result) ? (result as AuditLog["result"]) : "success",
    risk: ["critical", "high", "medium", "low"].includes(risk) ? (risk as RiskLevel) : "low",
    classification,
  };
}

export default function AuditLogsPage() {
  const backendConfigured = isBackendConfigured();
  const [logs, setLogs] = useState<AuditLog[]>(backendConfigured ? [] : mockAuditLogs);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!backendConfigured) return;
    if (!getStoredAuthSession()) {
      setError("Backend is configured. Sign in as admin or auditor to view audit events.");
      return;
    }
    browserApiFetch<unknown>("/api/v1/vulnerable/audit/events?limit=50")
      .then((body) => setLogs(normalizeApiItems<Record<string, unknown>>(body).map(normalizeAuditLog)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load audit events"));
  }, [backendConfigured]);

  return (
    <RoleGuard allowed={["admin", "auditor"]}>
      <PageHeader
        eyebrow="Audit logs"
        title="Sensitive access and policy decisions"
        description="Audit events are read from PostgreSQL when backend is live. Filters remain client-side for quick review."
      />
      {error ? (
        <Card className="mb-6 border-danger/35 bg-danger/10 p-5">
          <p className="font-semibold text-danger">Backend request error</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link className="mt-3 inline-flex text-sm font-semibold text-primary" href="/login">Go to login</Link>
        </Card>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Audit events" value={`${logs.length}`} icon={BookMarked} tone="primary" />
        <MetricCard label="Denied or challenged" value={`${logs.filter((log) => ["denied", "challenged", "failure"].includes(log.result)).length}`} icon={ShieldAlert} tone="warning" />
        <MetricCard label="Sensitive data events" value={`${logs.filter((log) => log.classification === "Sensitive Personal Data").length}`} icon={ShieldAlert} tone="danger" />
      </section>
      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Audit log table" description={backendConfigured ? "Backend live: records are fetched from /api/v1/vulnerable/audit/events?limit=50." : "Mock adapter: configure backend for PostgreSQL-backed audit logs."} />
        <AuditLogTable logs={logs} />
      </Card>
    </RoleGuard>
  );
}
