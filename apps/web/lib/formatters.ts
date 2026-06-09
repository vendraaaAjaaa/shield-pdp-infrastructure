import { ensureNumber, ensureString } from "@/lib/normalize";

export function formatCurrency(value: unknown, currency = "IDR") {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(ensureNumber(value));
}

export function formatNumber(value: unknown) {
  return new Intl.NumberFormat("id-ID").format(ensureNumber(value));
}

export function formatDateTime(value: unknown, fallback = "Unknown") {
  const raw = ensureString(value);
  const date = new Date(raw);
  if (!raw || Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(date);
}

export function formatPercent(value: unknown) {
  return `${Math.round(ensureNumber(value))}%`;
}

export function compactId(value: unknown) {
  const text = ensureString(value, "unknown");
  if (text.length <= 12) return text;
  return `${text.slice(0, 8)}...${text.slice(-4)}`;
}

export function signedAmount(value: unknown, direction: "in" | "out") {
  return `${direction === "out" ? "-" : "+"}${formatCurrency(Math.abs(ensureNumber(value)))}`;
}
