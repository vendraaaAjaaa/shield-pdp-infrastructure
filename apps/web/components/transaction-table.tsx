"use client";

import { AlertCircle, Filter, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { RiskBadge, StatusPill } from "@/components/badges";
import { Button, Input, Select } from "@/components/ui/primitives";
import type { Transaction } from "@/lib/types";
import { formatDateTime, signedAmount } from "@/lib/formatters";
import { ensureArray, ensureString } from "@/lib/normalize";
import { cn } from "@/lib/utils";

export function TransactionTable({ transactions }: { transactions: Transaction[] }) {
  const safeTransactions = ensureArray<Transaction>(transactions);
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const [selected, setSelected] = useState<Transaction | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safeTransactions.filter((transaction) => {
      const matchesQuery =
        !q ||
        ensureString(transaction.id).toLowerCase().includes(q) ||
        ensureString(transaction.merchant).toLowerCase().includes(q) ||
        ensureString(transaction.category).toLowerCase().includes(q);
      const matchesRisk = risk === "all" || transaction.risk === risk;
      return matchesQuery && matchesRisk;
    });
  }, [query, risk, safeTransactions]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search transactions, merchants, IDs" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 md:w-56">
          <Filter aria-hidden className="h-4 w-4 text-muted-foreground" />
          <Select value={risk} onChange={(event) => setRisk(event.target.value)} aria-label="Filter by risk">
            <option value="all">All risk levels</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
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
            {filtered.map((transaction) => (
              <tr key={transaction.id} className="bg-card transition hover:bg-muted/40">
                <td className="px-4 py-4 font-mono text-xs text-foreground">{ensureString(transaction.id, "TRX-UNKNOWN")}</td>
                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    {transaction.suspiciousReason ? <AlertCircle aria-hidden className="h-4 w-4 text-danger" /> : null}
                    <div>
                      <p className="font-semibold text-foreground">{ensureString(transaction.merchant, "Unknown merchant")}</p>
                      <p className="text-xs text-muted-foreground">{ensureString(transaction.category, "Uncategorized")}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 text-muted-foreground">{ensureString(transaction.channel, "Wallet")}</td>
                <td
                  className={cn(
                    "px-4 py-4 font-mono font-semibold",
                    transaction.direction === "in" ? "text-success" : "text-foreground",
                  )}
                >
                  {signedAmount(transaction.amount, transaction.direction)}
                </td>
                <td className="px-4 py-4">
                  <StatusPill status={transaction.status} />
                </td>
                <td className="px-4 py-4">
                  <RiskBadge level={transaction.risk} />
                </td>
                <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(transaction.occurredAt)}</td>
                <td className="px-4 py-4 text-right">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(transaction)}>
                    Detail
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr className="bg-card">
                <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No transactions match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <TransactionDetail transaction={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function TransactionDetail({ transaction, onClose }: { transaction: Transaction | null; onClose: () => void }) {
  if (!transaction) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-lg overflow-y-auto border-l border-border bg-card shadow-panel">
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <p className="font-mono text-xs font-semibold text-primary">{ensureString(transaction.id, "TRX-UNKNOWN")}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">{ensureString(transaction.merchant, "Unknown merchant")}</h2>
          </div>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close transaction detail">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5">
          <Detail label="Amount" value={signedAmount(transaction.amount, transaction.direction)} />
          <Detail label="Channel" value={ensureString(transaction.channel, "Wallet")} />
          <Detail label="Status" value={<StatusPill status={transaction.status} />} />
          <Detail label="Risk" value={<RiskBadge level={transaction.risk} />} />
          <Detail label="Occurred at" value={formatDateTime(transaction.occurredAt)} />
          <Detail label="Account" value={ensureString(transaction.accountId, "ACC-UNKNOWN")} />
          {transaction.suspiciousReason ? (
            <div className="rounded-lg border border-danger/35 bg-danger/10 p-4">
              <div className="flex gap-2">
                <AlertCircle aria-hidden className="h-5 w-5 shrink-0 text-danger" />
                <div>
                  <p className="text-sm font-semibold text-danger">Suspicious transaction indicator</p>
                  <p className="mt-2 text-sm leading-6 text-foreground">{transaction.suspiciousReason}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-muted/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <div className="mt-2 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
