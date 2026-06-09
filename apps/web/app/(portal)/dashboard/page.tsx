import { AlertTriangle, BadgeCheck, CreditCard, Landmark, ShieldCheck, WalletCards } from "lucide-react";
import { DataClassificationBadge, RiskBadge, StatusPill } from "@/components/badges";
import { SpendingChart } from "@/components/charts";
import { DemoCallout, DemoStepList } from "@/components/demo-context";
import { MaskedValue } from "@/components/masked-value";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { StatTrend } from "@/components/stat-trend";
import { Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { getAccounts, getDashboardSummary, getPrivacyProfile, getSecurityEvents, getSpendingSeries, getTransactions } from "@/lib/api/client";
import { ensureArray, normalizeDashboardSummary, normalizeSpendingSeries, spendingSeriesFromTransactions } from "@/lib/chart-data";
import { formatCurrency, formatDateTime, signedAmount } from "@/lib/formatters";
import type { Account, PrivacyProfile, SecurityEvent, Transaction } from "@/lib/types";

const emptyPrivacyProfile: PrivacyProfile = {
  customerId: "Unknown",
  displayName: "Unknown",
  maskedNik: "Unknown",
  maskedPhone: "Unknown",
  emailAlias: "Unknown",
  biometricStatus: "Not enrolled",
  retentionStatus: "Privacy profile data is unavailable from the configured backend.",
  deletionRequestStatus: "Unknown",
  dataCategories: [],
  consents: [],
};

export default async function DashboardPage() {
  const [summaryResult, accountsResult, transactionsResult, privacyProfileResult, securityEventsResult, spendingResult] = await Promise.allSettled([
    getDashboardSummary(),
    getAccounts(),
    getTransactions(),
    getPrivacyProfile(),
    getSecurityEvents(),
    getSpendingSeries(),
  ]);

  const backendErrors = [
    summaryResult,
    accountsResult,
    transactionsResult,
    privacyProfileResult,
    securityEventsResult,
    spendingResult,
  ]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map((result) => result.reason instanceof Error ? result.reason.message : "Backend request failed");

  const summary = normalizeDashboardSummary(summaryResult.status === "fulfilled" ? summaryResult.value : undefined);
  const accounts = ensureArray<Account>(accountsResult.status === "fulfilled" ? accountsResult.value : []);
  const transactions = ensureArray<Transaction>(transactionsResult.status === "fulfilled" ? transactionsResult.value : []);
  const privacyProfile = privacyProfileResult.status === "fulfilled" ? privacyProfileResult.value : emptyPrivacyProfile;
  const securityEvents = ensureArray<SecurityEvent>(securityEventsResult.status === "fulfilled" ? securityEventsResult.value : []);
  const derivedSpending = spendingSeriesFromTransactions(transactions, accounts);
  const spending = normalizeSpendingSeries(spendingResult.status === "fulfilled" ? spendingResult.value : [], derivedSpending);

  const walletBalance = summary.walletBalance || accounts.reduce((total, account) => total + account.balance, 0);
  const monthlySpending = summary.monthlySpending || spending.at(-1)?.spending || transactions.filter((transaction) => transaction.direction === "out").reduce((total, transaction) => total + transaction.amount, 0);
  const privacyStatus = summary.privacyScore > 0 ? `${Math.round(summary.privacyScore)}%` : "Unknown";
  const securityScore = Math.round(summary.securityScore || 0);
  const suspicious = securityEvents.find((event) => event.risk === "high" || event.risk === "critical");

  return (
    <RoleGuard allowed={["customer", "admin"]}>
      <PageHeader
        eyebrow="Customer fintech portal"
        title="Wallet, privacy, and account security"
        description="A customer-grade view of Dana Sejahtera Shield with masked identity data, recent ledger activity, and security posture."
      />

      <DemoCallout
        title="Customer trust journey for PT. Dana Sejahtera"
        description="This dashboard opens the live demo from a customer perspective: money movement, suspicious activity, personal data visibility, and security posture are shown together."
        icon={WalletCards}
      >
        <DemoStepList
          steps={[
            { title: "Review wallet health", text: "Show balance, spending, recent activity, and suspicious transaction indicators." },
            { title: "Inspect privacy posture", text: "Reveal is guarded by warning and audit preview; sensitive data is masked by default." },
            { title: "Pivot to controls", text: "Use Security and Privacy pages to connect customer trust to PDP evidence." },
          ]}
        />
      </DemoCallout>

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Wallet balance"
          value={formatCurrency(walletBalance)}
          icon={WalletCards}
          tone="primary"
          trend={<StatTrend value="4.2%" direction="up" label="vs last month" />}
        />
        <MetricCard
          label="Monthly spending"
          value={formatCurrency(monthlySpending)}
          icon={CreditCard}
          tone="info"
          trend={<StatTrend value="1.8%" direction="down" label="below budget" />}
        />
        <MetricCard label="Privacy status" value={privacyStatus} icon={BadgeCheck} tone="success" description="Consent records and retention labels are current when available." />
        <MetricCard label="Security score" value={`${securityScore}%`} icon={ShieldCheck} tone="warning" description={`${transactions.length} transactions are available for this dashboard view.`} />
      </section>

      {backendErrors.length ? (
        <Card className="mt-6 border-warning/40 bg-warning/10 p-5">
          <div className="flex gap-3">
            <AlertTriangle aria-hidden className="mt-1 h-5 w-5 shrink-0 text-warning" />
            <div>
              <h2 className="font-display text-lg font-semibold text-foreground">Backend data partially unavailable</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                The configured backend returned an error for part of the dashboard data. Safe defaults are shown for missing fields; mock fallback was not used.
              </p>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{backendErrors.slice(0, 2).join(" | ")}</p>
            </div>
          </div>
        </Card>
      ) : null}

      {suspicious ? (
        <Card className="mt-6 border-danger/35 bg-danger/10 p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex gap-3">
              <AlertTriangle aria-hidden className="mt-1 h-5 w-5 shrink-0 text-danger" />
              <div>
                <h2 className="font-display text-lg font-semibold text-foreground">Suspicious access alert</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{suspicious.detail}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <RiskBadge level={suspicious.risk} />
              <StatusPill status={suspicious.result} />
            </div>
          </div>
        </Card>
      ) : null}

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card>
          <CardHeader title="Income and spending trend" description="Synthetic wallet activity in IDR for the current reporting window." />
          <div className="p-5">
            <SpendingChart data={spending} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Privacy profile" description="Sensitive attributes are masked by default and reveal actions are audited." />
          <div className="grid gap-4 p-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Customer</p>
              <p className="mt-1 text-lg font-semibold text-foreground">{privacyProfile.displayName}</p>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Masked NIK</p>
              <MaskedValue label="NIK" masked={privacyProfile.maskedNik} revealed="3174 0000 0000 8842" reason="Customer self-service privacy review" />
            </div>
            <div className="flex flex-wrap gap-2">
              <DataClassificationBadge classification="Sensitive Personal Data" />
              <StatusPill status={privacyProfile.biometricStatus} />
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{privacyProfile.retentionStatus}</p>
          </div>
        </Card>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader title="Accounts" description="Masked account numbers and linked-bank status." />
          <div className="grid gap-3 p-5">
            {accounts.length ? accounts.slice(0, 3).map((account) => (
              <div key={account.id} className="rounded-lg border border-border bg-muted/35 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-foreground">{account.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{account.maskedNumber}</p>
                  </div>
                  <StatusPill status={account.status} />
                </div>
                <div className="mt-4 flex items-end justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{account.type}</p>
                  <p className="font-display text-xl font-semibold text-foreground">{formatCurrency(account.balance)}</p>
                </div>
              </div>
            )) : <p className="rounded-md border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">No account data is available from the configured backend.</p>}
          </div>
        </Card>

        <Card>
          <CardHeader title="Recent transactions" description="Latest ledger activity with suspicious indicators surfaced." />
          <div className="divide-y divide-border">
            {transactions.length ? transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                    <Landmark aria-hidden className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{transaction.merchant}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(transaction.occurredAt)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <RiskBadge level={transaction.risk} />
                  <p className="font-mono text-sm font-semibold text-foreground">{signedAmount(transaction.amount, transaction.direction)}</p>
                </div>
              </div>
            )) : <p className="p-4 text-sm text-muted-foreground">No transaction data is available from the configured backend.</p>}
          </div>
        </Card>
      </section>
    </RoleGuard>
  );
}
