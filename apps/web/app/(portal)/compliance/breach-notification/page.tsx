import { CheckCircle2, Clock3, FileWarning, UsersRound } from "lucide-react";
import { DataClassificationBadge, StatusPill } from "@/components/badges";
import { DeliverableReadiness, DemoCallout } from "@/components/demo-context";
import { ErrorState } from "@/components/empty-loading";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Timeline } from "@/components/timeline";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getBreachTimeline, getIncidents } from "@/lib/api/client";
import { settledErrors, settledValue } from "@/lib/async-data";
import { ensureArray } from "@/lib/normalize";
import type { Incident, TimelineEvent } from "@/lib/types";

const checklist = [
  { label: "Incident classification completed", status: "complete" },
  { label: "Affected data categories mapped", status: "complete" },
  { label: "Customer notification draft prepared", status: "in-progress" },
  { label: "Legal review", status: "review" },
  { label: "Management approval", status: "pending" },
];

const emptyIncident: Incident = {
  id: "Unknown",
  title: "No notification incident available",
  severity: "info",
  affectedSystems: [],
  owner: "Unassigned",
  sla: "Unknown",
  status: "pending",
  pdpNotificationRequired: false,
  affectedData: [],
};

export default async function BreachNotificationPage() {
  const results = await Promise.allSettled([getBreachTimeline(), getIncidents()]);
  const [timelineResult, incidentsResult] = results;
  const errors = settledErrors(results);
  const timeline = ensureArray<TimelineEvent>(settledValue(timelineResult, []));
  const incidents = ensureArray<Incident>(settledValue(incidentsResult, []));
  const incident = incidents[0] ?? emptyIncident;
  const affectedData = ensureArray<Incident["affectedData"][number]>(incident.affectedData);

  return (
    <RoleGuard allowed={["auditor", "admin"]}>
      <PageHeader
        eyebrow="PDP-03 breach notification"
        title="3 x 24 hours readiness simulation"
        description="A controlled timeline for privacy incident notification readiness, affected-data mapping, checklist state, and management approval."
      />
      <DemoCallout
        title="PDP-03 notification clock for a simulated privacy incident"
        description="This view demonstrates the management workflow behind the 3 x 24 hours requirement: classify, map affected data, prepare communication, obtain approval, and preserve evidence."
        icon={Clock3}
        tone="warning"
      >
        <DeliverableReadiness
          items={[
            { label: "Incident classification", status: "complete" },
            { label: "Affected data worksheet", status: "complete" },
            { label: "Legal and executive approval", status: "pending" },
          ]}
        />
      </DemoCallout>
      {errors.length ? <div className="mt-6"><ErrorState description={`Backend live breach-notification data is partially unavailable: ${errors.slice(0, 2).join(" | ")}`} /></div> : null}
      <section className="mt-6 grid gap-4 md:grid-cols-4">
        <MetricCard label="Countdown status" value="Within window" icon={Clock3} tone="warning" description="Deadline: 2026-05-30 09:05 UTC" />
        <MetricCard label="Open notification incident" value={incident.id} icon={FileWarning} tone="danger" />
        <MetricCard label="Affected categories" value={`${affectedData.length}`} icon={UsersRound} tone="info" />
        <MetricCard label="Checklist complete" value="40%" icon={CheckCircle2} tone="success" />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader title="Incident timeline" description="Synthetic response timeline measured against the 3 x 24 hours requirement." />
          <div className="p-5">
            <Timeline events={timeline} />
          </div>
        </Card>
        <div className="grid gap-6">
          <Card>
            <CardHeader title="Affected data categories" description="Classification labels for notification impact assessment." />
            <div className="flex flex-wrap gap-2 p-5">
              {affectedData.length ? affectedData.map((classification) => (
                <DataClassificationBadge key={classification} classification={classification} />
              )) : <p className="text-sm text-muted-foreground">No affected data categories are available.</p>}
            </div>
          </Card>
          <Card>
            <CardHeader title="Notification readiness checklist" description="Operational checklist before notification package is ready." />
            <div className="divide-y divide-border">
              {checklist.map((item) => (
                <div key={item.label} className="flex items-center justify-between gap-3 p-4">
                  <p className="text-sm font-semibold text-foreground">{item.label}</p>
                  <StatusPill status={item.status} />
                </div>
              ))}
            </div>
          </Card>
          <Card className="p-5">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">Management approval</p>
            <h2 className="mt-2 font-display text-xl font-semibold text-foreground">Pending legal and executive sign-off</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              The simulated package is ready for review but cannot be marked notification-ready until approval metadata is attached.
            </p>
          </Card>
        </div>
      </section>
    </RoleGuard>
  );
}
