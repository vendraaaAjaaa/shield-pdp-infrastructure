import { KeyRound, Laptop, ShieldAlert, ShieldCheck } from "lucide-react";
import { RiskBadge, StatusPill } from "@/components/badges";
import { ErrorState } from "@/components/empty-loading";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getSecurityEvents, getSessions } from "@/lib/api/client";
import { settledErrors, settledValue } from "@/lib/async-data";
import { formatDateTime } from "@/lib/formatters";
import { ensureArray } from "@/lib/normalize";
import type { ActiveSession, SecurityEvent } from "@/lib/types";

export default async function SecurityPage() {
  const results = await Promise.allSettled([getSessions(), getSecurityEvents()]);
  const [sessionsResult, eventsResult] = results;
  const errors = settledErrors(results);
  const sessions = ensureArray<ActiveSession>(settledValue(sessionsResult, []));
  const events = ensureArray<SecurityEvent>(settledValue(eventsResult, []));
  const trusted = sessions.filter((session) => session.trusted).length;
  const challenged = events.filter((event) => event.result === "challenged").length;

  return (
    <RoleGuard allowed={["customer", "admin"]}>
      <PageHeader
        eyebrow="Security center"
        title="Sessions, access events, and MFA"
        description="A privacy-aware security view showing active sessions, login history, access-control decisions, and device trust state."
      />
      {errors.length ? <div className="mb-6"><ErrorState description={`Backend live data is partially unavailable: ${errors.slice(0, 2).join(" | ")}`} /></div> : null}
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="MFA status" value="Ready" icon={KeyRound} tone="success" />
        <MetricCard label="Active sessions" value={`${sessions.length}`} icon={Laptop} tone="info" />
        <MetricCard label="Trusted devices" value={`${trusted}`} icon={ShieldCheck} tone="primary" />
        <MetricCard label="Challenged events" value={`${challenged}`} icon={ShieldAlert} tone="warning" />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader title="Active sessions" description="Device trust and MFA state for current synthetic sessions." />
          <div className="divide-y divide-border">
            {sessions.length ? sessions.map((session) => (
              <div key={session.id} className="p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-foreground">{session.device}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{session.location} - {session.ip}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Last seen {formatDateTime(session.lastSeen)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill status={session.trusted ? "trusted" : "review"} />
                    <StatusPill status={session.mfa ? "mfa" : "challenged"} />
                  </div>
                </div>
              </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No active sessions are available from the configured backend.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Login and access-control history" description="Security events include allowed, denied, and challenged decisions." />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Actor</th>
                  <th className="px-4 py-3 font-semibold">Source</th>
                  <th className="px-4 py-3 font-semibold">Result</th>
                  <th className="px-4 py-3 font-semibold">Risk</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.length ? events.map((event) => (
                  <tr key={event.id} className="bg-card">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-foreground">{event.event}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{event.detail}</p>
                    </td>
                    <td className="px-4 py-4 text-muted-foreground">{event.actor}</td>
                    <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{event.source}</td>
                    <td className="px-4 py-4"><StatusPill status={event.result} /></td>
                    <td className="px-4 py-4"><RiskBadge level={event.risk} /></td>
                    <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</td>
                  </tr>
                )) : (
                  <tr className="bg-card">
                    <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No security events are available from the configured backend.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </RoleGuard>
  );
}
