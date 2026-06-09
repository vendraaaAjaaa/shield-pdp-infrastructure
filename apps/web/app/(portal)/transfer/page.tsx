"use client";

import { Send, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { TransferForm } from "@/components/transfer-form";
import { MetricCard } from "@/components/metric-card";
import { RoleGuard } from "@/components/role-guard";
import { Card, PageHeader } from "@/components/ui/primitives";
import { browserApiFetch, getStoredAuthSession, isBackendConfigured } from "@/lib/api/client";
import { mockAccounts, mockBeneficiaries } from "@/lib/api/mock";
import { ensureDateString, ensureNumber, ensureObject, ensureString, normalizeApiItems } from "@/lib/normalize";
import type { Account } from "@/lib/types";

function normalizeAccount(value: unknown, index: number): Account {
  const source = ensureObject<Record<string, unknown>>(value, {});
  return {
    id: ensureString(source.id ?? source.accountId, `mock-${index}`),
    type: ["Primary Wallet", "Savings Pocket", "Linked Bank", "Escrow"].includes(String(source.type)) ? (source.type as Account["type"]) : index === 0 ? "Primary Wallet" : "Linked Bank",
    name: ensureString(source.name, "Dana Sejahtera Wallet"),
    maskedNumber: ensureString(source.maskedNumber ?? source.accountNumberMasked, "****"),
    bank: ensureString(source.bank, "Dana Sejahtera Wallet"),
    status: "active",
    balance: ensureNumber(source.balance),
    currency: "IDR",
    classification: "Confidential",
    lastActivity: ensureDateString(source.lastActivity),
  };
}

export default function TransferPage() {
  const backendConfigured = isBackendConfigured();
  const [accounts, setAccounts] = useState<Account[]>(backendConfigured ? [] : mockAccounts);
  const [error, setError] = useState("");

  const loadAccounts = useCallback(async ({ throwOnFailure = false }: { throwOnFailure?: boolean } = {}) => {
    if (!backendConfigured) {
      setAccounts(mockAccounts);
      return;
    }
    if (!getStoredAuthSession()) {
      const message = "Backend is configured. Sign in first so transfer requests include Authorization: Bearer <access_token>.";
      setError(message);
      if (throwOnFailure) throw new Error(message);
      return;
    }
    try {
      const body = await browserApiFetch<unknown>("/api/v1/vulnerable/me/accounts");
      setAccounts(normalizeApiItems<Record<string, unknown>>(body).map(normalizeAccount));
      setError("");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Unable to load backend accounts";
      setError(message);
      if (throwOnFailure) throw new Error(message);
    }
  }, [backendConfigured]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  return (
    <RoleGuard allowed={["customer"]}>
      <PageHeader
        eyebrow="Transfer"
        title="Risk-aware synthetic ledger transfer"
        description="Final submit calls POST /api/v1/vulnerable/transfers with sourceAccountId visible and editable in BurpSuite. Ledger rows and balances are synthetic lab data only."
      />
      {error ? (
        <Card className="mb-6 border-danger/35 bg-danger/10 p-5">
          <p className="font-semibold text-danger">Backend request error</p>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link className="mt-3 inline-flex text-sm font-semibold text-primary" href="/login">Go to login</Link>
        </Card>
      ) : null}
      <section className="mb-6 grid gap-4 md:grid-cols-2">
        <MetricCard label="Trusted beneficiaries" value={`${mockBeneficiaries.filter((item) => item.trustLevel === "trusted").length}`} icon={ShieldCheck} tone="success" />
        <MetricCard label="Transfer mode" value="Synthetic ledger" icon={Send} tone="info" description="Backend posts transfer, debit, credit, audit, and evidence records when live." />
      </section>
      <TransferForm accounts={accounts} beneficiaries={mockBeneficiaries} onTransferPosted={() => loadAccounts({ throwOnFailure: true })} />
    </RoleGuard>
  );
}
