"use client";

import { Building2, CreditCard, ShieldCheck, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { DataClassificationBadge, StatusPill } from "@/components/badges";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { browserApiFetch, getStoredAuthSession, isBackendConfigured } from "@/lib/api/client";
import { mockAccounts } from "@/lib/api/mock";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { ensureDateString, ensureNumber, ensureObject, ensureString, normalizeApiItems } from "@/lib/normalize";
import type { Account } from "@/lib/types";

type AccountDetail = Account & {
  accountId?: string;
  ownerUsername?: string;
  ownerCustomerId?: string;
  auditEventId?: string;
  evidenceId?: string;
  metadata?: {
    crossOwner?: boolean;
    authenticatedOwnerId?: string;
    targetOwnerId?: string;
  };
};

function normalizeAccount(value: unknown, index: number): Account {
  const source = ensureObject<Record<string, unknown>>(value, {});
  return {
    id: ensureString(source.id ?? source.accountId, `mock-${index}`),
    type: ["Primary Wallet", "Savings Pocket", "Linked Bank", "Escrow"].includes(String(source.type)) ? (source.type as Account["type"]) : index === 0 ? "Primary Wallet" : "Linked Bank",
    name: ensureString(source.name, "Dana Sejahtera Wallet"),
    maskedNumber: ensureString(source.maskedNumber ?? source.accountNumberMasked, "****"),
    bank: ensureString(source.bank, "Dana Sejahtera Wallet"),
    status: ["active", "blocked", "pending", "review", "ready", "complete", "in-progress", "open", "closed", "mitigated", "accepted"].includes(String(source.status)) ? (source.status as Account["status"]) : "active",
    balance: ensureNumber(source.balance),
    currency: "IDR",
    classification: "Confidential",
    lastActivity: ensureDateString(source.lastActivity),
  };
}

export default function AccountsPage() {
  const backendConfigured = isBackendConfigured();
  const [accounts, setAccounts] = useState<Account[]>(backendConfigured ? [] : mockAccounts);
  const [selected, setSelected] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(backendConfigured);
  const [detailLoading, setDetailLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!backendConfigured) return;
    const session = getStoredAuthSession();
    if (!session) {
      setError("Backend is configured. Sign in first so account requests include Authorization: Bearer <access_token>.");
      setLoading(false);
      return;
    }
    browserApiFetch<unknown>("/api/v1/vulnerable/me/accounts")
      .then((body) => setAccounts(normalizeApiItems<Record<string, unknown>>(body).map(normalizeAccount)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load backend accounts"))
      .finally(() => setLoading(false));
  }, [backendConfigured]);

  const total = accounts.reduce((sum, account) => sum + account.balance, 0);
  const linked = accounts.filter((account) => account.type === "Linked Bank").length;
  const hint = backendConfigured ? "Pentest Lab Mode: account detail uses vulnerable endpoint" : "Mock adapter";

  async function openDetail(accountId: string) {
    if (!backendConfigured) {
      const account = accounts.find((item) => item.id === accountId);
      if (account) setSelected(account as AccountDetail);
      return;
    }
    setDetailLoading(accountId);
    setError("");
    try {
      const body = await browserApiFetch<unknown>(`/api/v1/vulnerable/accounts/${accountId}`);
      const detail = ensureObject<Record<string, unknown>>(body, {});
      setSelected({ ...normalizeAccount(detail, 0), accountId: ensureString(detail.accountId ?? detail.id, accountId), ownerUsername: ensureString(detail.ownerUsername), ownerCustomerId: ensureString(detail.ownerCustomerId), auditEventId: ensureString(detail.auditEventId), evidenceId: detail.evidenceId ? ensureString(detail.evidenceId) : undefined, metadata: detail.metadata as AccountDetail["metadata"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load account detail");
    } finally {
      setDetailLoading("");
    }
  }

  return (
    <RoleGuard allowed={["customer", "admin"]}>
      <PageHeader
        eyebrow="Accounts"
        title="Masked accounts and linked banks"
        description="Account data is loaded from the backend when configured. Account detail requests keep accountId visible in the HTTP URL for BurpSuite testing."
      />
      <div className="mb-4 rounded-md border border-warning/35 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">{hint}</div>
      {error ? (
        <Card className="mb-6 border-danger/35 bg-danger/10 p-5">
          <p className="font-semibold text-danger">Backend request error</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link className="mt-3 inline-flex text-sm font-semibold text-primary" href="/login">Go to login</Link>
        </Card>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Total visible balance" value={formatCurrency(total)} icon={WalletCards} tone="primary" />
        <MetricCard label="Linked banks" value={`${linked}`} icon={Building2} tone="info" />
        <MetricCard label="Protected accounts" value={`${accounts.length}`} icon={ShieldCheck} tone="success" />
      </section>
      <Card className="mt-6">
        <CardHeader title="Account list" description={loading ? "Loading backend accounts..." : "Detail buttons call GET /api/v1/vulnerable/accounts/{accountId}."} />
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {accounts.length ? accounts.map((account) => (
            <article key={account.id} className="rounded-lg border border-border bg-muted/35 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                    <CreditCard aria-hidden className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-display text-lg font-semibold text-foreground">{account.name}</p>
                    <p className="mt-1 font-mono text-xs text-muted-foreground">{account.id}</p>
                  </div>
                </div>
                <StatusPill status={account.status} />
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Summary label="Masked number" value={account.maskedNumber} mono />
                <Summary label="Balance" value={formatCurrency(account.balance)} />
                <Summary label="Type" value={account.type} />
                <Summary label="Last activity" value={formatDateTime(account.lastActivity)} />
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <DataClassificationBadge classification={account.classification} />
                <Button type="button" variant="secondary" size="sm" onClick={() => openDetail(account.id)} disabled={detailLoading === account.id}>
                  {detailLoading === account.id ? "Loading" : "Detail"}
                </Button>
              </div>
            </article>
          )) : <p className="rounded-md border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">No account data is available from the configured backend.</p>}
        </div>
      </Card>
      <AccountDrawer account={selected} onClose={() => setSelected(null)} />
    </RoleGuard>
  );
}

function Summary({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={`mt-1 text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function AccountDrawer({ account, onClose }: { account: AccountDetail | null; onClose: () => void }) {
  if (!account) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card shadow-panel">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="font-mono text-xs font-semibold text-primary">{account.accountId ?? account.id}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">{account.name}</h2>
          </div>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close account detail">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <Detail label="Masked number" value={account.maskedNumber} />
          <Detail label="Owner" value={`${account.ownerUsername ?? "unknown"} ${account.ownerCustomerId ? `(${account.ownerCustomerId})` : ""}`} />
          <Detail label="Balance" value={formatCurrency(account.balance)} />
          <Detail label="Audit event" value={account.auditEventId || "not generated"} />
          {account.evidenceId ? <Detail label="Evidence" value={account.evidenceId} /> : null}
          {account.metadata?.crossOwner ? (
            <div className="rounded-lg border border-danger/35 bg-danger/10 p-4">
              <p className="text-sm font-semibold text-danger">Cross-owner response</p>
              <p className="mt-2 text-sm leading-6 text-foreground">Backend metadata shows authenticated owner {account.metadata.authenticatedOwnerId} requested object owned by {account.metadata.targetOwnerId}.</p>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-2 break-all text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
