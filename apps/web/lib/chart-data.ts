import type { Account, DashboardSummary, SpendingPoint, Transaction } from "@/lib/types";
import { ensureArray, ensureNumber, ensureObject, ensureString } from "@/lib/normalize";

export { ensureArray } from "@/lib/normalize";

export function normalizeSpendingSeries(value: unknown, fallback: SpendingPoint[] = []): SpendingPoint[] {
  const candidates = ensureArray<unknown>(value, fallback);
  const normalized = candidates.map(normalizeSpendingPoint).filter((point): point is SpendingPoint => Boolean(point));
  return normalized.length ? normalized : fallback;
}

export function spendingSeriesFromTransactions(transactions: Transaction[], accounts: Account[] = []): SpendingPoint[] {
  const safeTransactions = ensureArray<Transaction>(transactions);
  const safeAccounts = ensureArray<Account>(accounts);
  if (!safeTransactions.length) return spendingSeriesFromAccounts(safeAccounts);

  const points = new Map<string, SpendingPoint & { sortKey: string }>();
  for (const transaction of safeTransactions) {
    const date = new Date(transaction.occurredAt);
    const month = Number.isNaN(date.getTime()) ? "Unknown" : monthName(date.getUTCMonth());
    const sortKey = Number.isNaN(date.getTime()) ? `9999-${month}` : `${date.getUTCFullYear()}-${String(date.getUTCMonth()).padStart(2, "0")}`;
    const existing = points.get(sortKey) ?? { month, spending: 0, income: 0, sortKey };
    const amount = ensureNumber(transaction.amount);
    if (transaction.direction === "in") {
      existing.income += amount;
    } else {
      existing.spending += amount;
    }
    points.set(sortKey, existing);
  }

  const derived = Array.from(points.values())
    .sort((left, right) => left.sortKey.localeCompare(right.sortKey))
    .slice(-6)
    .map(({ sortKey: _sortKey, ...point }) => point);

  if (derived.length) return derived;

  return spendingSeriesFromAccounts(safeAccounts);
}

export function normalizeDashboardSummary(value: unknown): DashboardSummary {
  const source = ensureObject<Record<string, unknown>>(value, {});
  return {
    walletBalance: ensureNumber(source.walletBalance),
    monthlySpending: ensureNumber(source.monthlySpending),
    privacyScore: ensureNumber(source.privacyScore),
    securityScore: ensureNumber(source.securityScore),
    complianceScore: ensureNumber(source.complianceScore),
    openFindings: ensureNumber(source.openFindings),
    suspiciousEvents: ensureNumber(source.suspiciousEvents),
    transactionVolume: ensureNumber(source.transactionVolume),
  };
}

function normalizeSpendingPoint(value: unknown, index: number): SpendingPoint | undefined {
  const source = ensureObject<Record<string, unknown>>(value, {});
  if (!Object.keys(source).length) return undefined;
  return {
    month: ensureString(source.month ?? source.label ?? source.period ?? source.date, `Point ${index + 1}`),
    spending: ensureNumber(source.spending ?? source.expense ?? source.expenses ?? source.debit),
    income: ensureNumber(source.income ?? source.credit ?? source.credits),
  };
}

function spendingSeriesFromAccounts(accounts: Account[]) {
  const balance = ensureArray<Account>(accounts).reduce((total, account) => total + ensureNumber(account.balance), 0);
  return balance > 0 ? [{ month: "Now", spending: 0, income: balance }] : [];
}

function monthName(monthIndex: number) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][monthIndex] ?? "Unknown";
}
