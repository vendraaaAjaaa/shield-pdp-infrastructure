"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComplianceControl, RiskMatrixCell, SpendingPoint } from "@/lib/types";
import { ensureArray, ensureNumber } from "@/lib/normalize";
import { formatCurrency } from "@/lib/formatters";

export function SpendingChart({ data }: { data: SpendingPoint[] }) {
  const chartData = ensureArray<SpendingPoint>(data);

  return (
    <div className="h-72 w-full">
      {chartData.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
            <defs>
              <linearGradient id="spending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.34} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="income" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--info))" stopOpacity={0.26} />
                <stop offset="95%" stopColor="hsl(var(--info))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(value) => `${ensureNumber(value) / 1000000}M`} />
            <Tooltip formatter={(value) => formatCurrency(value)} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
            <Area type="monotone" dataKey="income" stroke="hsl(var(--info))" fill="url(#income)" strokeWidth={2} />
            <Area type="monotone" dataKey="spending" stroke="hsl(var(--primary))" fill="url(#spending)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-full place-items-center rounded-md border border-dashed border-border bg-muted/25 text-sm text-muted-foreground">
          No chart data available for this reporting window.
        </div>
      )}
    </div>
  );
}

export function ComplianceBars({ controls }: { controls: ComplianceControl[] }) {
  const chartData = ensureArray<ComplianceControl>(controls);

  return (
    <div className="h-72 w-full">
      {chartData.length ? (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 0, right: 12, top: 12, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="4 4" vertical={false} />
            <XAxis dataKey="id" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
            <Tooltip formatter={(value) => `${ensureNumber(value)}%`} contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
            <Bar dataKey="score" radius={[6, 6, 0, 0]} fill="hsl(var(--primary))" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-full place-items-center rounded-md border border-dashed border-border bg-muted/25 text-sm text-muted-foreground">
          No control score data available.
        </div>
      )}
    </div>
  );
}

export function RiskDonut({ data }: { data: RiskMatrixCell[] }) {
  const cells = ensureArray<RiskMatrixCell>(data);
  const byLevel = ["critical", "high", "medium", "low"].map((level) => ({
    name: level,
    value: cells.filter((cell) => cell.level === level).reduce((total, cell) => total + ensureNumber(cell.count), 0),
  }));
  const colors: Record<string, string> = {
    critical: "hsl(var(--risk-critical))",
    high: "hsl(var(--risk-high))",
    medium: "hsl(var(--risk-medium))",
    low: "hsl(var(--risk-low))",
  };

  return (
    <div className="h-72 w-full">
      {byLevel.some((entry) => entry.value > 0) ? (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={byLevel} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
              {byLevel.map((entry) => (
                <Cell key={entry.name} fill={colors[entry.name]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
          </PieChart>
        </ResponsiveContainer>
      ) : (
        <div className="grid h-full place-items-center rounded-md border border-dashed border-border bg-muted/25 text-sm text-muted-foreground">
          No risk distribution data available.
        </div>
      )}
    </div>
  );
}
