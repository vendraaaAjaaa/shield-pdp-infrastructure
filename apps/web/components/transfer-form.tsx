"use client";

import { AlertTriangle, CheckCircle2, KeyRound, Send } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { RiskBadge } from "@/components/badges";
import { Button, Card, Input, Select, Textarea } from "@/components/ui/primitives";
import type { Account, Beneficiary } from "@/lib/types";
import { formatCurrency } from "@/lib/formatters";
import { browserApiFetch, getStoredAuthSession, isBackendConfigured } from "@/lib/api/client";
import { ensureArray, ensureNumber, ensureString } from "@/lib/normalize";
import { safeClientId } from "@/lib/safe-id";

type TransferResult = {
  transferSimulationId?: string;
  transferId?: string;
  sourceTransactionId?: string;
  destinationTransactionId?: string;
  evidenceId?: string;
  auditEventId?: string;
  authenticatedUser?: string;
  sourceAccountId?: string;
  destinationAccountId?: string;
  sourceAccountOwner?: string;
  destinationAccountOwner?: string;
  amount?: number;
  currency?: string;
  sourceBalanceBefore?: number;
  sourceBalanceAfter?: number;
  destinationBalanceBefore?: number;
  destinationBalanceAfter?: number;
  risk?: string;
  idorDetected?: boolean;
  message?: string;
};

export function TransferForm({
  accounts,
  beneficiaries,
  onTransferPosted,
}: {
  accounts: Account[];
  beneficiaries: Beneficiary[];
  onTransferPosted?: () => Promise<void> | void;
}) {
  const safeAccounts = ensureArray<Account>(accounts);
  const safeBeneficiaries = ensureArray<Beneficiary>(beneficiaries);
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [sourceAccountId, setSourceAccountId] = useState(safeAccounts[0]?.id ?? "");
  const [beneficiaryId, setBeneficiaryId] = useState(safeBeneficiaries[0]?.id ?? "");
  const [amount, setAmount] = useState("1250000");
  const [note, setNote] = useState("Synthetic ledger transfer");
  const [otp, setOtp] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [postSuccessWarning, setPostSuccessWarning] = useState("");
  const [result, setResult] = useState<TransferResult | null>(null);
  const backendConfigured = isBackendConfigured();

  useEffect(() => {
    if (!sourceAccountId && safeAccounts[0]?.id) setSourceAccountId(safeAccounts[0].id);
  }, [safeAccounts, sourceAccountId]);

  useEffect(() => {
    if (!beneficiaryId && safeBeneficiaries[0]?.id) setBeneficiaryId(safeBeneficiaries[0].id);
  }, [beneficiaryId, safeBeneficiaries]);

  const beneficiary = safeBeneficiaries.find((item) => item.id === beneficiaryId) ?? safeBeneficiaries[0];
  const source = safeAccounts.find((item) => item.id === sourceAccountId) ?? safeAccounts[0];
  const destinationAccountId = beneficiary?.accountId ?? "";
  const numericAmount = ensureNumber(amount);
  const risk = useMemo(() => {
    if (beneficiary?.trustLevel === "new" || numericAmount > 10000000) return "high";
    if (beneficiary?.trustLevel === "review" || numericAmount > 5000000) return "medium";
    return "low";
  }, [beneficiary?.trustLevel, numericAmount]);

  if (step === "done") {
    return (
      <Card className="p-8 text-center">
        <CheckCircle2 aria-hidden className="mx-auto h-12 w-12 text-success" />
        <h2 className="mt-4 font-display text-2xl font-semibold text-foreground">Synthetic transfer posted</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {result?.message ?? "Mock adapter local transfer preview only. Configure backend to post synthetic transfer ledger rows."}
        </p>
        {result ? (
          <div className="mx-auto mt-6 grid max-w-3xl gap-3 text-left md:grid-cols-2">
            <Summary label="Transfer ID" value={result.transferId ?? result.transferSimulationId ?? "local-simulation"} />
            <Summary label="Amount" value={formatCurrency(ensureNumber(result.amount, numericAmount))} />
            <Summary label="Source account" value={result.sourceAccountId ?? sourceAccountId} />
            <Summary label="Destination account" value={result.destinationAccountId ?? destinationAccountId} />
            <Summary label="Source balance before" value={formatCurrency(ensureNumber(result.sourceBalanceBefore))} />
            <Summary label="Source balance after" value={formatCurrency(ensureNumber(result.sourceBalanceAfter))} />
            <Summary label="Destination balance before" value={formatCurrency(ensureNumber(result.destinationBalanceBefore))} />
            <Summary label="Destination balance after" value={formatCurrency(ensureNumber(result.destinationBalanceAfter))} />
            <Summary label="Debit transaction" value={result.sourceTransactionId ?? "not generated"} />
            <Summary label="Credit transaction" value={result.destinationTransactionId ?? "not generated"} />
            <Summary label="Evidence ID" value={result.evidenceId ?? "not generated"} />
            <Summary label="Audit event ID" value={result.auditEventId ?? "not generated"} />
            <Summary label="Authenticated user" value={result.authenticatedUser ?? "demo user"} />
            <Summary label="Source account owner" value={result.sourceAccountOwner ?? "demo owner"} />
          </div>
        ) : null}
        {postSuccessWarning ? (
          <div className="mx-auto mt-6 max-w-3xl rounded-md border border-warning/35 bg-warning/10 px-4 py-3 text-left text-sm text-warning">
            {postSuccessWarning}
          </div>
        ) : null}
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link className="inline-flex rounded-md border border-primary/35 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10" href="/transactions">
            View transaction history
          </Link>
          <Button
            type="button"
            onClick={() => {
              setError("");
              setPostSuccessWarning("");
              setResult(null);
              setStep("form");
            }}
          >
            Create another transfer
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <Card>
        <div className="border-b border-border p-5">
          <h2 className="font-display text-lg font-semibold text-foreground">{step === "form" ? "Transfer details" : "Confirm transfer"}</h2>
          <p className="mt-1 text-sm text-muted-foreground">Accepted backend transfers post synthetic debit and credit ledger rows in this controlled lab.</p>
        </div>
        {step === "form" ? (
          <form
            className="grid gap-4 p-5"
            onSubmit={(event) => {
              event.preventDefault();
              setStep("confirm");
            }}
          >
            <label className="grid gap-2 text-sm font-semibold">
              Source account
              <Select value={sourceAccountId} onChange={(event) => setSourceAccountId(event.target.value)}>
                {safeAccounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {ensureString(account.name, "Account")} ({ensureString(account.maskedNumber, "masked")})
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Beneficiary
              <Select value={beneficiaryId} onChange={(event) => setBeneficiaryId(event.target.value)}>
                {safeBeneficiaries.map((item) => (
                  <option key={item.id} value={item.id}>
                    {ensureString(item.name, "Beneficiary")} - {ensureString(item.bank, "Bank")} - {ensureString(item.trustLevel, "review")}
                  </option>
                ))}
              </Select>
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Amount
              <Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value)} />
            </label>
            <label className="grid gap-2 text-sm font-semibold">
              Transfer note
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
            </label>
            {!safeAccounts.length ? (
              <div className="rounded-md border border-dashed border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">
                No source accounts are available from the configured backend.
              </div>
            ) : null}
            <Button type="submit" disabled={!safeAccounts.length || !safeBeneficiaries.length || !destinationAccountId}>
              Review transfer
              <Send aria-hidden className="h-4 w-4" />
            </Button>
          </form>
        ) : (
          <div className="grid gap-4 p-5">
            <Summary label="From" value={`${source?.name ?? "Account"} (${source?.maskedNumber ?? "masked"})`} />
            <Summary label="To" value={`${beneficiary?.name ?? "Beneficiary"} - ${beneficiary?.maskedAccount ?? "masked"}`} />
            <Summary label="Destination account ID" value={destinationAccountId || "not configured"} />
            <Summary label="Amount" value={formatCurrency(numericAmount)} />
            <Summary label="Note" value={ensureString(note, "Synthetic ledger transfer")} />
            <div className="rounded-lg border border-warning/35 bg-warning/10 p-4">
              <div className="flex gap-3">
                <AlertTriangle aria-hidden className="h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-sm font-semibold text-foreground">Risk warning</p>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    Beneficiary trust level and amount are evaluated before settlement. High-risk transfers require step-up authentication.
                  </p>
                  <div className="mt-3">
                    <RiskBadge level={risk} />
                  </div>
                </div>
              </div>
            </div>
            <label className="grid gap-2 text-sm font-semibold">
              OTP/MFA placeholder
              <Input value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Enter demo code, any value accepted" />
            </label>
            {error ? (
              <div className="rounded-md border border-danger/35 bg-danger/10 px-3 py-2 text-sm font-semibold text-danger">
                {error}
              </div>
            ) : null}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="secondary" onClick={() => setStep("form")}>
                Back
              </Button>
              <Button
                type="button"
                disabled={submitting || !destinationAccountId}
                onClick={async () => {
                  setError("");
                  setPostSuccessWarning("");
                  if (!backendConfigured) {
                    setResult({
                      transferSimulationId: "LOCAL-MOCK-SIMULATION",
                      risk,
                      message: "Mock adapter local transfer preview only. Configure backend to post synthetic ledger rows to PostgreSQL.",
                    });
                    setStep("done");
                    return;
                  }
                  if (!getStoredAuthSession()) {
                    setError("Sign in first so the transfer request includes Authorization: Bearer <access_token>.");
                    return;
                  }
                  setSubmitting(true);
                  try {
                    const body = await browserApiFetch<TransferResult>("/api/v1/vulnerable/transfers", {
                      method: "POST",
                      headers: {
                        "X-Idempotency-Key": safeClientId("transfer"),
                      },
                      body: JSON.stringify({
                        sourceAccountId,
                        destinationAccountId,
                        amount: numericAmount,
                        note,
                      }),
                    });
                    setResult(body);
                    setStep("done");
                    try {
                      await onTransferPosted?.();
                    } catch (refetchError) {
                      setPostSuccessWarning(
                        refetchError instanceof Error
                          ? `Transfer posted, but the account refresh failed: ${refetchError.message}`
                          : "Transfer posted, but the account refresh failed.",
                      );
                    }
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : "Transfer failed");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {submitting ? "Submitting" : "Post synthetic transfer"}
                <KeyRound aria-hidden className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
      <Card className="p-5">
        <h2 className="font-display text-lg font-semibold text-foreground">Beneficiary trust model</h2>
        <div className="mt-4 grid gap-3">
          {safeBeneficiaries.map((item) => (
            <div key={item.id} className="rounded-lg border border-border bg-muted/35 p-4">
              <p className="font-semibold text-foreground">{ensureString(item.name, "Beneficiary")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{ensureString(item.bank, "Bank")} - {ensureString(item.maskedAccount, "masked")}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{ensureString(item.trustLevel, "review")}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/35 p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
