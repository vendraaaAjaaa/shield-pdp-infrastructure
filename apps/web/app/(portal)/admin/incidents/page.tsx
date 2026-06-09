import { Clock3, Siren, UsersRound } from "lucide-react";
import { DataClassificationBadge, SeverityBadge, StatusPill } from "@/components/badges";
import { ErrorState } from "@/components/empty-loading";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getIncidents } from "@/lib/api/client";
import { errorMessage, ensureArray, ensureString } from "@/lib/normalize";
import type { Incident } from "@/lib/types";

export default async function IncidentsPage() {
  const incidentsResult = await getIncidents()
    .then((value) => ({ status: "fulfilled" as const, value }))
    .catch((reason: unknown) => ({ status: "rejected" as const, reason }));
  const incidents = ensureArray<Incident>(incidentsResult.status === "fulfilled" ? incidentsResult.value : []);

  return (
    <RoleGuard allowed={["admin", "auditor"]}>
      <PageHeader
        eyebrow="Incident queue"
        title="Privacy and security incident triage"
        description="Incident list with severity, affected systems, assigned owner, SLA, status, and PDP notification requirement."
      />
      {incidentsResult.status === "rejected" ? (
        <div className="mb-6">
          <ErrorState description={`Backend live incidents are unavailable: ${errorMessage(incidentsResult.reason)}`} />
        </div>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Open incidents" value={`${incidents.length}`} icon={Siren} tone="danger" />
        <MetricCard label="PDP notification required" value={`${incidents.filter((incident) => incident.pdpNotificationRequired).length}`} icon={UsersRound} tone="warning" />
        <MetricCard label="SLA tracked" value="100%" icon={Clock3} tone="success" />
      </section>
      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Incident list" description="Synthetic incident records for operations, compliance, and notification simulation." />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Incident</th>
                <th className="px-4 py-3 font-semibold">Severity</th>
                <th className="px-4 py-3 font-semibold">Affected systems</th>
                <th className="px-4 py-3 font-semibold">Owner</th>
                <th className="px-4 py-3 font-semibold">SLA</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">PDP notification</th>
                <th className="px-4 py-3 font-semibold">Affected data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {incidents.length ? incidents.map((incident) => {
                const affectedSystems = ensureArray<string>(incident.affectedSystems);
                const affectedData = ensureArray<Incident["affectedData"][number]>(incident.affectedData);
                return (
                <tr key={incident.id} className="bg-card align-top">
                  <td className="px-4 py-4">
                    <p className="font-mono text-xs text-primary">{ensureString(incident.id, "INC-UNKNOWN")}</p>
                    <p className="mt-1 font-semibold text-foreground">{ensureString(incident.title, "Untitled incident")}</p>
                  </td>
                  <td className="px-4 py-4"><SeverityBadge severity={incident.severity} /></td>
                  <td className="px-4 py-4 text-muted-foreground">{affectedSystems.length ? affectedSystems.join(", ") : "Unknown"}</td>
                  <td className="px-4 py-4 text-muted-foreground">{ensureString(incident.owner, "Unassigned")}</td>
                  <td className="px-4 py-4 text-muted-foreground">{ensureString(incident.sla, "Unknown")}</td>
                  <td className="px-4 py-4"><StatusPill status={incident.status} /></td>
                  <td className="px-4 py-4"><StatusPill status={incident.pdpNotificationRequired ? "required" : "not-required"} /></td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      {affectedData.length ? affectedData.map((classification) => (
                        <DataClassificationBadge key={classification} classification={classification} />
                      )) : <span className="text-sm text-muted-foreground">Unknown</span>}
                    </div>
                  </td>
                </tr>
              );
              }) : (
                <tr className="bg-card">
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No incident records are available from the configured backend.
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
