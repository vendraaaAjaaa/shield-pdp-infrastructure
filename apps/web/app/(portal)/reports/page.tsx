import { FileText, LockKeyhole, PackageCheck } from "lucide-react";
import { DeliverableReadiness, DemoCallout } from "@/components/demo-context";
import { ErrorState } from "@/components/empty-loading";
import { MetricCard } from "@/components/metric-card";
import { ReportCard } from "@/components/report-card";
import { RoleGuard } from "@/components/role-guard";
import { PageHeader } from "@/components/ui/primitives";
import { getReports } from "@/lib/api/client";
import { errorMessage, ensureArray } from "@/lib/normalize";
import type { Report } from "@/lib/types";

export default async function ReportsPage() {
  const reportsResult = await getReports()
    .then((value) => ({ status: "fulfilled" as const, value }))
    .catch((reason: unknown) => ({ status: "rejected" as const, reason }));
  const reports = ensureArray<Report>(reportsResult.status === "fulfilled" ? reportsResult.value : []);

  return (
    <RoleGuard allowed={["admin", "auditor", "pentester"]}>
      <PageHeader
        eyebrow="Report center"
        title="Technical, executive, PDP, and remediation reports"
        description="Report metadata and export-readiness placeholders. Exports are disabled until backend generation and encryption evidence are attached."
      />
      <DemoCallout
        title="Professional deliverable center for Shield-PDP assessment"
        description="This center packages the same synthetic evidence into role-specific reports: RoE for authorization, technical findings for engineering, executive risk for management, UU PDP mapping for auditors, and audit evidence for compliance review."
        icon={FileText}
      >
        <DeliverableReadiness
          items={[
            { label: "Rules of Engagement", status: "ready" },
            { label: "Technical Pen-Test Report", status: "in-progress" },
            { label: "Audit Evidence Package", status: "review" },
          ]}
        />
      </DemoCallout>
      {reportsResult.status === "rejected" ? (
        <div className="mt-6">
          <ErrorState description={`Backend live reports are unavailable: ${errorMessage(reportsResult.reason)}`} />
        </div>
      ) : null}
      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <MetricCard label="Report packages" value={`${reports.length}`} icon={FileText} tone="primary" />
        <MetricCard label="Ready for review" value={`${reports.filter((report) => report.status === "ready").length}`} icon={PackageCheck} tone="success" />
        <MetricCard label="Export guard" value="Required" icon={LockKeyhole} tone="warning" />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-3">
        {reports.length ? reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        )) : <p className="rounded-md border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">No report packages are available from the configured backend.</p>}
      </section>
    </RoleGuard>
  );
}
