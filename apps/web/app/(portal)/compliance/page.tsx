import { ClipboardCheck, FileClock, KeyRound, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { ComplianceBars } from "@/components/charts";
import { ComplianceScoreCard } from "@/components/compliance-score-card";
import { DemoCallout, DemoStepList, PdpControlStrip } from "@/components/demo-context";
import { ErrorState } from "@/components/empty-loading";
import { EvidencePanel } from "@/components/evidence-panel";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getComplianceControls, getDashboardSummary, getGapAnalysis } from "@/lib/api/client";
import { settledErrors, settledValue } from "@/lib/async-data";
import { normalizeDashboardSummary } from "@/lib/chart-data";
import { ensureArray } from "@/lib/normalize";
import type { ComplianceControl, GapAnalysisItem } from "@/lib/types";

export default async function CompliancePage() {
  const results = await Promise.allSettled([getComplianceControls(), getDashboardSummary(), getGapAnalysis()]);
  const [controlsResult, summaryResult, gapsResult] = results;
  const errors = settledErrors(results);
  const controls = ensureArray<ComplianceControl>(settledValue(controlsResult, []));
  const summary = normalizeDashboardSummary(settledValue(summaryResult, undefined));
  const gaps = ensureArray<GapAnalysisItem>(settledValue(gapsResult, []));
  const criticalGaps = gaps.filter((gap) => gap.risk === "critical").length;

  return (
    <RoleGuard allowed={["auditor", "admin"]}>
      <PageHeader
        eyebrow="UU PDP compliance"
        title="Evidence readiness and privacy controls"
        description="Control evidence for encryption, access control, audit logging, breach notification readiness, and remediation tracking."
        action={
          <Link className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground shadow-sm hover:bg-muted" href="/compliance/gap-analysis">
            Open gap analysis
          </Link>
        }
      />
      <DemoCallout
        title="PT. Dana Sejahtera compliance evidence room"
        description="This page demonstrates how a fintech privacy audit connects security controls, technical findings, and UU PDP obligations into one executive-ready evidence narrative."
        icon={ClipboardCheck}
      >
        <DemoStepList
          steps={[
            { title: "Start with PDP controls", text: "Review PDP-01, PDP-02, and PDP-03 evidence readiness before opening the mapping table." },
            { title: "Open gap analysis", text: "Trace each technical weakness to impacted data, PDP requirement, evidence, remediation, and owner status." },
            { title: "Close with reports", text: "Use the report center to show how evidence becomes audit-ready deliverables." },
          ]}
        />
      </DemoCallout>
      {errors.length ? <div className="mt-6"><ErrorState description={`Backend live compliance data is partially unavailable: ${errors.slice(0, 2).join(" | ")}`} /></div> : null}
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Compliance score" value={`${summary.complianceScore}%`} icon={ClipboardCheck} tone="success" />
        <MetricCard label="Critical gaps" value={`${criticalGaps}`} icon={ShieldCheck} tone="danger" />
        <MetricCard label="PDP-01" value={`${controls[0]?.score ?? 0}%`} icon={KeyRound} tone="primary" />
        <MetricCard label="3 x 24h readiness" value={`${controls[2]?.score ?? 0}%`} icon={FileClock} tone="warning" />
      </section>

      <section className="mt-6">
        <PdpControlStrip />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader title="PDP control score" description="Current evidence readiness for PDP-01, PDP-02, and PDP-03." />
          <div className="p-5">
            <ComplianceBars controls={controls} />
          </div>
        </Card>
        <EvidencePanel
          title="Evidence set"
          description="Representative proof points used by the compliance dashboard."
          evidence={[
            "PDP-01: database volume encryption, TLS policy, and KMS rotation ticket evidence.",
            "PDP-02: RBAC matrix, denied-access audit logs, and object authorization validation.",
            "PDP-03: incident timeline, affected-data worksheet, and notification checklist.",
          ]}
        />
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        {controls.length ? controls.map((control) => (
          <ComplianceScoreCard key={control.id} control={control} />
        )) : <p className="rounded-md border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">No compliance controls are available from the configured backend.</p>}
      </section>
    </RoleGuard>
  );
}
