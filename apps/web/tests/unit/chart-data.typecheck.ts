import { ensureArray, normalizeDashboardSummary, normalizeSpendingSeries } from "@/lib/chart-data";
import type { SpendingPoint } from "@/lib/types";

const objectInputBecomesArray: SpendingPoint[] = ensureArray<SpendingPoint>({ not: "an array" });
const itemEnvelopeBecomesArray: SpendingPoint[] = ensureArray<SpendingPoint>({
  items: [{ month: "Jul", spending: 125000, income: 0 }],
});
const nestedTrendBecomesArray: SpendingPoint[] = normalizeSpendingSeries({
  trend: [{ month: "Jun", spending: 125000, income: 250000 }],
});
const nestedDataBecomesArray: SpendingPoint[] = normalizeSpendingSeries({
  data: [{ label: "Aug", debit: "225000", credit: "150000" }],
});
const missingChartDataBecomesArray: SpendingPoint[] = normalizeSpendingSeries({ status: "ready" });
const emptyDashboardSummary = normalizeDashboardSummary(null);
const objectDashboardSummary = normalizeDashboardSummary({
  data: {
    walletBalance: "1000",
    monthlySpending: "200",
    privacyScore: "80",
    securityScore: "75",
    complianceScore: "90",
  },
});

if (
  objectInputBecomesArray.length !== 0 ||
  itemEnvelopeBecomesArray.length !== 1 ||
  nestedTrendBecomesArray.length !== 1 ||
  nestedDataBecomesArray[0]?.spending !== 225000 ||
  missingChartDataBecomesArray.length !== 0 ||
  emptyDashboardSummary.walletBalance !== 0 ||
  objectDashboardSummary.walletBalance !== 1000
) {
  throw new Error("Chart helpers must normalize non-array values before Recharts receives data");
}
