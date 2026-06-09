import { Activity, AlertTriangle, Gauge, LogIn, ReceiptText, UsersRound } from "lucide-react";
import { RiskBadge, StatusPill } from "@/components/badges";
import { DemoCallout } from "@/components/demo-context";
import { ErrorState } from "@/components/empty-loading";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getAdminMetrics, getCustomers, getIncidents, getSystemHealth, getTransactions } from "@/lib/api/client";
import { settledErrors, settledValue } from "@/lib/async-data";
import { formatCurrency } from "@/lib/formatters";
import { ensureArray, ensureNumber, ensureString } from "@/lib/normalize";
import type { Incident, Transaction } from "@/lib/types";

type AdminMetrics = Awaited<ReturnType<typeof getAdminMetrics>>;
type Customer = Awaited<ReturnType<typeof getCustomers>>[number];
type HealthService = Awaited<ReturnType<typeof getSystemHealth>>[number];

const emptyMetrics: AdminMetrics = {
  customers: 0,
  transactionVolume: 0,
  failedLogins: 0,
  suspiciousApiCalls: 0,
  openIncidents: 0,
};

export default async function AdminPage() {
  const results = await Promise.allSettled([
    getAdminMetrics(),
    getCustomers(),
    getIncidents(),
    getSystemHealth(),
    getTransactions(),
  ]);
  const [metricsResult, customersResult, incidentsResult, healthResult, transactionsResult] = results;
  const errors = settledErrors(results);
  const metrics = settledValue(metricsResult, emptyMetrics);
  const customers = ensureArray<Customer>(settledValue(customersResult, []));
  const incidents = ensureArray<Incident>(settledValue(incidentsResult, []));
  const health = ensureArray<HealthService>(settledValue(healthResult, []));
  const transactions = ensureArray<Transaction>(settledValue(transactionsResult, []));
  const riskTransactions = transactions.filter((transaction) => transaction.risk !== "low");
  const openIncidents = ensureNumber(metrics.openIncidents, incidents.length);

  return (
    <RoleGuard allowed={["admin"]}>
      <PageHeader
        eyebrow="Admin operations"
        title="Customer, transaction, API, and incident monitoring"
        description="A role-scoped operations console for customer overview, transaction volume, failed logins, suspicious API calls, open incidents, and system health."
      />
      <DemoCallout
        title="Operations cockpit with privacy-aware boundaries"
        description="Admins can monitor risk and incidents without turning the portal into unrestricted customer-data access. Masking, audit logs, and incident queues keep operational workflows accountable."
        icon={Gauge}
        tone="warning"
      >
        <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
          <p className="rounded-md border border-border bg-card px-3 py-2">Customer identifiers remain masked in overview views.</p>
          <p className="rounded-md border border-border bg-card px-3 py-2">Suspicious API calls and failed logins surface operational risk.</p>
          <p className="rounded-md border border-border bg-card px-3 py-2">Audit logs and incidents provide handoff to compliance review.</p>
        </div>
      </DemoCallout>
      {errors.length ? <div className="mt-6"><ErrorState description={`Backend live admin data is partially unavailable: ${errors.slice(0, 2).join(" | ")}`} /></div> : null}
      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Customers" value={ensureNumber(metrics.customers).toLocaleString("id-ID")} icon={UsersRound} tone="primary" />
        <MetricCard label="Transaction volume" value={formatCurrency(metrics.transactionVolume)} icon={ReceiptText} tone="info" />
        <MetricCard label="Failed logins" value={`${metrics.failedLogins}`} icon={LogIn} tone="warning" />
        <MetricCard label="Suspicious API calls" value={`${metrics.suspiciousApiCalls}`} icon={AlertTriangle} tone="danger" />
        <MetricCard label="Open incidents" value={`${openIncidents || incidents.length}`} icon={Gauge} tone="warning" />
      </section>
      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader title="Customer overview" description="Masked customer identifiers and operational risk labels." />
          <div className="divide-y divide-border">
            {customers.length ? customers.map((customer) => (
              <div key={customer.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-foreground">{ensureString(customer.name, "Unknown customer")}</p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{ensureString(customer.id, "USER-UNKNOWN")} - {ensureString(customer.maskedNik, "masked")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <StatusPill status={customer.status} />
                  <RiskBadge level={customer.risk as "low" | "medium" | "high" | "critical"} />
                </div>
              </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No customer records are available from the configured backend.</p>}
          </div>
        </Card>
        <Card>
          <CardHeader title="System health" description="Key Shield-PDP frontend and backend simulation services." />
          <div className="divide-y divide-border">
            {health.length ? health.map((service) => (
              <div key={service.service} className="grid gap-3 p-4 md:grid-cols-[1fr_auto_auto] md:items-center">
                <div className="flex items-center gap-3">
                  <Activity aria-hidden className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-semibold text-foreground">{ensureString(service.service, "Service")}</p>
                    <p className="text-xs text-muted-foreground">Owner: {ensureString(service.owner, "Unknown")}</p>
                  </div>
                </div>
                <StatusPill status={service.status} />
                <p className="font-mono text-xs text-muted-foreground">{ensureString(service.latency, "unknown")}</p>
              </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No system health records are available from the configured backend.</p>}
          </div>
        </Card>
      </section>
      <Card className="mt-6">
        <CardHeader title="Transaction monitoring sample" description="Latest high-value and suspicious wallet events." />
        <div className="divide-y divide-border">
          {riskTransactions.length ? riskTransactions.map((transaction) => (
            <div key={transaction.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">{ensureString(transaction.merchant, "Unknown merchant")}</p>
                <p className="mt-1 font-mono text-xs text-muted-foreground">{ensureString(transaction.id, "TRX-UNKNOWN")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <RiskBadge level={transaction.risk} />
                <StatusPill status={transaction.status} />
                <p className="font-mono text-sm font-semibold text-foreground">{formatCurrency(transaction.amount)}</p>
              </div>
            </div>
          )) : <p className="p-4 text-sm text-muted-foreground">No elevated-risk transaction sample is available.</p>}
        </div>
      </Card>
    </RoleGuard>
  );
}
