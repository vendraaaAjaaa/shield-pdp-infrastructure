"use client";

import { AlertCircle, AlertTriangle, ReceiptText, WalletCards, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RiskBadge, StatusPill } from "@/components/badges";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Button, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { browserApiFetch, getStoredAuthSession, isBackendConfigured } from "@/lib/api/client";
import { mockTransactions } from "@/lib/api/mock";
import { formatCurrency, formatDateTime, signedAmount } from "@/lib/formatters";
import { ensureDateString, ensureNumber, ensureObject, ensureString, normalizeApiItems } from "@/lib/normalize";
import type { Transaction } from "@/lib/types";

type TransactionDetail = Transaction & {
  ownerUsername?: string;
  auditEventId?: string;
  evidenceId?: string;
  metadata?: {
    crossOwner?: boolean;
    authenticatedOwnerId?: string;
    targetOwnerId?: string;
  };
};

function normalizeTransaction(value: unknown): Transaction {
  const source = ensureObject<Record<string, unknown>>(value, {});
  const direction = String(source.direction ?? "out") === "in" ? "in" : "out";
  const statusValue = String(source.status ?? "settled");
  const status = ["settled", "pending", "blocked", "review"].includes(statusValue) ? (statusValue as Transaction["status"]) : "settled";
  const channelValue = String(source.channel ?? "Wallet");
  const channel = ["Wallet", "QRIS", "Virtual Account", "Bank Transfer"].includes(channelValue) ? (channelValue as Transaction["channel"]) : "Wallet";
  const riskValue = String(source.risk ?? "low");
  const risk = ["critical", "high", "medium", "low"].includes(riskValue) ? (riskValue as Transaction["risk"]) : "low";
  return {
    id: ensureString(source.id ?? source.transactionId, "TRX-BACKEND"),
    accountId: ensureString(source.accountId, "ACC-BACKEND"),
    transferId: typeof source.transferId === "string" ? source.transferId : undefined,
    merchant: ensureString(source.merchant ?? source.counterparty, "Synthetic transaction"),
    counterparty: typeof source.counterparty === "string" ? source.counterparty : undefined,
    category: ensureString(source.category, "Transfer"),
    amount: ensureNumber(source.amount),
    currency: "IDR",
    direction,
    status,
    occurredAt: ensureDateString(source.occurredAt),
    channel,
    risk,
    note: typeof source.note === "string" ? source.note : undefined,
    suspiciousReason: typeof source.suspiciousReason === "string" ? source.suspiciousReason : undefined,
  };
}

export default function TransactionsPage() {
  const backendConfigured = isBackendConfigured();
  const [transactions, setTransactions] = useState<Transaction[]>(backendConfigured ? [] : mockTransactions);
  const [selected, setSelected] = useState<TransactionDetail | null>(null);
  const [loading, setLoading] = useState(backendConfigured);
  const [detailLoading, setDetailLoading] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!backendConfigured) return;
    const session = getStoredAuthSession();
    if (!session) {
      setError("Backend is configured. Sign in first so transaction requests include Authorization: Bearer <access_token>.");
      setLoading(false);
      return;
    }
    browserApiFetch<unknown>("/api/v1/vulnerable/me/transactions")
      .then((body) => setTransactions(normalizeApiItems<Record<string, unknown>>(body).map(normalizeTransaction)))
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load backend transactions"))
      .finally(() => setLoading(false));
  }, [backendConfigured]);

  const volume = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const suspicious = transactions.filter((transaction) => transaction.suspiciousReason).length;

  async function openDetail(transactionId: string) {
    if (!backendConfigured) {
      const transaction = transactions.find((item) => item.id === transactionId);
      if (transaction) setSelected(transaction as TransactionDetail);
      return;
    }
    setDetailLoading(transactionId);
    setError("");
    try {
      const body = await browserApiFetch<unknown>(`/api/v1/vulnerable/transactions/${transactionId}`);
      const detail = ensureObject<Record<string, unknown>>(body, {});
      setSelected({ ...normalizeTransaction(detail), ownerUsername: ensureString(detail.ownerUsername), auditEventId: ensureString(detail.auditEventId), evidenceId: detail.evidenceId ? ensureString(detail.evidenceId) : undefined, metadata: detail.metadata as TransactionDetail["metadata"] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load transaction detail");
    } finally {
      setDetailLoading("");
    }
  }

  return (
    <RoleGuard allowed={["customer", "admin"]}>
      <PageHeader
        eyebrow="Transactions"
        title="Ledger activity with risk indicators"
        description="Transactions are loaded from the backend when configured. Detail requests keep transactionId visible in the HTTP URL for BurpSuite testing."
      />
      <div className="mb-4 rounded-md border border-warning/35 bg-warning/10 px-4 py-3 text-sm font-semibold text-warning">
        Pentest Lab Mode: transaction detail uses vulnerable endpoint
      </div>
      {error ? (
        <Card className="mb-6 border-danger/35 bg-danger/10 p-5">
          <p className="font-semibold text-danger">Backend request error</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link className="mt-3 inline-flex text-sm font-semibold text-primary" href="/login">Go to login</Link>
        </Card>
      ) : null}
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Transactions loaded" value={`${transactions.length}`} icon={ReceiptText} tone="primary" />
        <MetricCard label="Observed volume" value={formatCurrency(volume)} icon={WalletCards} tone="info" />
        <MetricCard label="Suspicious indicators" value={`${suspicious}`} icon={AlertTriangle} tone="danger" />
      </section>
      <Card className="mt-6 overflow-hidden">
        <CardHeader title="Transaction table" description={loading ? "Loading backend transactions..." : "Detail buttons call GET /api/v1/vulnerable/transactions/{transactionId}."} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="bg-muted/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-semibold">Transaction</th>
                <th className="px-4 py-3 font-semibold">Merchant</th>
                <th className="px-4 py-3 font-semibold">Channel</th>
                <th className="px-4 py-3 font-semibold">Amount</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Risk</th>
                <th className="px-4 py-3 font-semibold">Time</th>
                <th className="px-4 py-3 font-semibold" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transactions.length ? transactions.map((transaction) => (
                <tr key={transaction.id} className="bg-card transition hover:bg-muted/40">
                  <td className="px-4 py-4 font-mono text-xs text-foreground">{transaction.id}</td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {transaction.suspiciousReason ? <AlertCircle aria-hidden className="h-4 w-4 text-danger" /> : null}
                      <div>
                        <p className="font-semibold text-foreground">{transaction.merchant}</p>
                        <p className="text-xs text-muted-foreground">
                          {transaction.transferId ? `${transaction.category} - ${transaction.transferId}` : transaction.category}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-muted-foreground">{transaction.channel}</td>
                  <td className="px-4 py-4 font-mono font-semibold text-foreground">{signedAmount(transaction.amount, transaction.direction)}</td>
                  <td className="px-4 py-4"><StatusPill status={transaction.status} /></td>
                  <td className="px-4 py-4"><RiskBadge level={transaction.risk} /></td>
                  <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(transaction.occurredAt)}</td>
                  <td className="px-4 py-4 text-right">
                    <Button type="button" variant="secondary" size="sm" onClick={() => openDetail(transaction.id)} disabled={detailLoading === transaction.id}>
                      {detailLoading === transaction.id ? "Loading" : "Detail"}
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr className="bg-card">
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No transaction data is available from the configured backend.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <TransactionDrawer transaction={selected} onClose={() => setSelected(null)} />
    </RoleGuard>
  );
}

function TransactionDrawer({ transaction, onClose }: { transaction: TransactionDetail | null; onClose: () => void }) {
  if (!transaction) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card shadow-panel">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="font-mono text-xs font-semibold text-primary">{transaction.id}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">{transaction.merchant}</h2>
          </div>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close transaction detail">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <Detail label="Amount" value={signedAmount(transaction.amount, transaction.direction)} />
          <Detail label="Account" value={transaction.accountId} />
          {transaction.transferId ? <Detail label="Transfer" value={transaction.transferId} /> : null}
          {transaction.counterparty ? <Detail label="Counterparty" value={transaction.counterparty} /> : null}
          {transaction.note ? <Detail label="Note" value={transaction.note} /> : null}
          <Detail label="Owner" value={transaction.ownerUsername || "unknown"} />
          <Detail label="Audit event" value={transaction.auditEventId || "not generated"} />
          {transaction.evidenceId ? <Detail label="Evidence" value={transaction.evidenceId} /> : null}
          {transaction.metadata?.crossOwner ? (
            <div className="rounded-lg border border-danger/35 bg-danger/10 p-4">
              <p className="text-sm font-semibold text-danger">Cross-owner response</p>
              <p className="mt-2 text-sm leading-6 text-foreground">Backend metadata shows authenticated owner {transaction.metadata.authenticatedOwnerId} requested object owned by {transaction.metadata.targetOwnerId}.</p>
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
