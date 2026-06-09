import { ListChecks } from "lucide-react";
import { RiskBadge, StatusPill } from "@/components/badges";
import { DemoCallout, PdpControlStrip } from "@/components/demo-context";
import { ErrorState } from "@/components/empty-loading";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getGapAnalysis } from "@/lib/api/client";
import { errorMessage, ensureArray } from "@/lib/normalize";
import type { GapAnalysisItem } from "@/lib/types";

export default async function GapAnalysisPage() {
  const gapResult = await getGapAnalysis()
    .then((value) => ({ status: "fulfilled" as const, value }))
    .catch((reason: unknown) => ({ status: "rejected" as const, reason }));
  const gaps = ensureArray<GapAnalysisItem>(gapResult.status === "fulfilled" ? gapResult.value : []);

  return (
    <RoleGuard allowed={["auditor", "pentester", "admin"]}>
      <PageHeader
        eyebrow="Compliance gap analysis"
        title="Technical findings mapped to UU PDP obligations"
        description="Each row links a technical weakness to impacted data, PDP requirement, evidence, remediation, and current status."
      />
      <DemoCallout
        title="Audit mapping from vulnerability to legal obligation"
        description="Use this table to explain how API authorization, encryption evidence, breach communication, and audit-log detail become concrete PDP remediation work."
        icon={ListChecks}
        tone="info"
      >
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
          <p className="rounded-md border border-border bg-card px-3 py-2"><span className="font-semibold text-foreground">Technical:</span> endpoint, asset, and evidence source.</p>
          <p className="rounded-md border border-border bg-card px-3 py-2"><span className="font-semibold text-foreground">Privacy:</span> impacted data category and PDP requirement.</p>
          <p className="rounded-md border border-border bg-card px-3 py-2"><span className="font-semibold text-foreground">Action:</span> risk, remediation, and status for owners.</p>
        </div>
      </DemoCallout>
      {gapResult.status === "rejected" ? (
        <div className="mt-6">
          <ErrorState description={`Backend live gap analysis is unavailable: ${errorMessage(gapResult.reason)}`} />
        </div>
      ) : null}
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Mapped findings" value={`${gaps.length}`} icon={ListChecks} tone="primary" />
        <MetricCard label="Critical PDP gaps" value={`${gaps.filter((gap) => gap.risk === "critical").length}`} icon={ListChecks} tone="danger" />
        <MetricCard label="In remediation" value={`${gaps.filter((gap) => gap.status === "in-progress").length}`} icon={ListChecks} tone="warning" />
      </section>
      <section className="mt-6">
        <PdpControlStrip />
      </section>
      <Card className="mt-6 overflow-hidden">
        <CardHeader title="UU PDP mapping table" description="Finding ID, technical finding, impacted data, PDP requirement, risk, evidence, remediation, and status." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Finding ID</th>
                <th className="px-4 py-3 font-semibold">Technical Finding</th>
                <th className="px-4 py-3 font-semibold">Impacted Data</th>
                <th className="px-4 py-3 font-semibold">PDP Requirement</th>
                <th className="px-4 py-3 font-semibold">Risk</th>
                <th className="px-4 py-3 font-semibold">Evidence</th>
                <th className="px-4 py-3 font-semibold">Remediation</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {gaps.length ? gaps.map((gap) => (
                <tr key={gap.id} className="bg-card align-top">
                  <td className="px-4 py-4 font-mono text-xs text-foreground">{gap.id}</td>
                  <td className="max-w-xs px-4 py-4 font-semibold text-foreground">{gap.technicalFinding}</td>
                  <td className="max-w-xs px-4 py-4 text-muted-foreground">{gap.impactedData}</td>
                  <td className="max-w-xs px-4 py-4 text-muted-foreground">{gap.pdpRequirement}</td>
                  <td className="px-4 py-4"><RiskBadge level={gap.risk} /></td>
                  <td className="max-w-xs px-4 py-4 text-muted-foreground">{gap.evidence}</td>
                  <td className="max-w-sm px-4 py-4 text-muted-foreground">{gap.remediation}</td>
                  <td className="px-4 py-4"><StatusPill status={gap.status} /></td>
                </tr>
              )) : (
                <tr className="bg-card">
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No compliance gap records are available from the configured backend.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </RoleGuard>
  );
}
