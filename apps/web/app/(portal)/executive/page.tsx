import { Banknote, BarChart3, BriefcaseBusiness, Scale, ShieldAlert } from "lucide-react";
import { RiskDonut } from "@/components/charts";
import { DemoCallout, PdpControlStrip } from "@/components/demo-context";
import { ErrorState } from "@/components/empty-loading";
import { SeverityBadge, StatusPill } from "@/components/badges";
import { MetricCard } from "@/components/metric-card";
import { RiskMatrix } from "@/components/risk-matrix";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getDashboardSummary, getExecutiveExposure, getFindings, getRiskMatrix } from "@/lib/api/client";
import { settledErrors, settledValue } from "@/lib/async-data";
import { normalizeDashboardSummary } from "@/lib/chart-data";
import { formatCurrency } from "@/lib/formatters";
import { ensureArray, ensureNumber, ensureString } from "@/lib/normalize";
import { severityOrder } from "@/lib/risk";
import type { Finding, RiskMatrixCell } from "@/lib/types";

type ExecutiveExposure = Awaited<ReturnType<typeof getExecutiveExposure>>;

const emptyExposure: ExecutiveExposure = {
  regulatoryImpact: "Unknown",
  operationalRisk: "Unknown",
  financialExposure: 0,
  readinessScore: 0,
  remediationProgress: 0,
};

export default async function ExecutivePage() {
  const results = await Promise.allSettled([
    getDashboardSummary(),
    getExecutiveExposure(),
    getFindings(),
    getRiskMatrix(),
  ]);
  const [summaryResult, exposureResult, findingsResult, riskMatrixResult] = results;
  const errors = settledErrors(results);
  const summary = normalizeDashboardSummary(settledValue(summaryResult, undefined));
  const exposure = settledValue(exposureResult, emptyExposure);
  const findings = ensureArray<Finding>(settledValue(findingsResult, []));
  const riskMatrix = ensureArray<RiskMatrixCell>(settledValue(riskMatrixResult, []));
  const topFindings = findings
    .slice()
    .sort((a, b) => (severityOrder[b.severity] ?? 0) - (severityOrder[a.severity] ?? 0) || ensureNumber(b.cvss) - ensureNumber(a.cvss))
    .slice(0, 5);
  const remediationProgress = Math.max(0, Math.min(100, ensureNumber(exposure.remediationProgress)));

  return (
    <RoleGuard allowed={["admin", "auditor"]}>
      <PageHeader
        eyebrow="Executive dashboard"
        title="Business risk and compliance readiness"
        description="A board-ready view of potential regulatory impact, operational risk, financial exposure, top findings, and remediation progress."
      />
      <DemoCallout
        title="Management view of fintech cyber and privacy risk"
        description="Use this view to move the demo from technical findings to business decisions: potential regulatory exposure, operational risk, remediation progress, and PDP readiness."
        icon={BarChart3}
        tone="warning"
      >
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
          <p className="rounded-md border border-border bg-card px-3 py-2">What customer trust risk exists?</p>
          <p className="rounded-md border border-border bg-card px-3 py-2">Which PDP obligations need evidence?</p>
          <p className="rounded-md border border-border bg-card px-3 py-2">Which remediations reduce business exposure first?</p>
        </div>
      </DemoCallout>
      {errors.length ? <div className="mt-6"><ErrorState description={`Backend live executive data is partially unavailable: ${errors.slice(0, 2).join(" | ")}`} /></div> : null}
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Compliance readiness" value={`${summary.complianceScore}%`} icon={Scale} tone="success" />
        <MetricCard label="Financial exposure" value={formatCurrency(exposure.financialExposure)} icon={Banknote} tone="warning" />
        <MetricCard label="Operational risk" value={ensureString(exposure.operationalRisk, "Unknown")} icon={BriefcaseBusiness} tone="danger" description={ensureString(exposure.operationalRisk, "Unknown")} />
        <MetricCard label="Open critical findings" value={`${findings.filter((finding) => finding.severity === "critical").length}`} icon={ShieldAlert} tone="danger" />
      </section>

      <section className="mt-6">
        <PdpControlStrip />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader title="Risk distribution" description="Aggregate finding count by risk level." />
          <RiskDonut data={riskMatrix} />
        </Card>
        <Card>
          <CardHeader title="Risk matrix" description="Likelihood and impact view for executive prioritization." />
          <div className="p-5">
            <RiskMatrix data={riskMatrix} />
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Top 5 critical findings" description="Highest severity items with business and PDP implications." />
          <div className="divide-y divide-border">
            {topFindings.length ? topFindings.map((finding) => (
              <div key={finding.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-mono text-xs font-semibold text-primary">{ensureString(finding.id, "FIND-UNKNOWN")}</p>
                    <h3 className="mt-1 font-semibold text-foreground">{ensureString(finding.title, "Untitled finding")}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{ensureString(finding.businessImpact, "Business impact unavailable.")}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <SeverityBadge severity={finding.severity} />
                    <StatusPill status={finding.status} />
                  </div>
                </div>
              </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No critical findings are available from the configured backend.</p>}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
              <BarChart3 aria-hidden className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Remediation progress</p>
              <h2 className="font-display text-2xl font-semibold text-foreground">{remediationProgress}%</h2>
            </div>
          </div>
          <div className="mt-5 h-3 rounded-full bg-muted">
            <div className="h-3 rounded-full bg-primary" style={{ width: `${remediationProgress}%` }} />
          </div>
          <div className="mt-5 grid gap-3">
            <p className="rounded-md border border-border bg-muted/45 p-3 text-sm text-muted-foreground">{ensureString(exposure.regulatoryImpact, "Unknown")}</p>
            <p className="rounded-md border border-border bg-muted/45 p-3 text-sm text-muted-foreground">Next governance checkpoint: PDP-02 object authorization verification.</p>
          </div>
        </Card>
      </section>
    </RoleGuard>
  );
}
