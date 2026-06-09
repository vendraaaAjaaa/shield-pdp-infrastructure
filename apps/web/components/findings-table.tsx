"use client";

import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { SeverityBadge, StatusPill } from "@/components/badges";
import { FindingDetailDrawer } from "@/components/finding-detail-drawer";
import { Button, Input, Select } from "@/components/ui/primitives";
import type { Finding } from "@/lib/types";
import { ensureArray, ensureNumber, ensureString } from "@/lib/normalize";

export function FindingsTable({ findings }: { findings: Finding[] }) {
  const safeFindings = ensureArray<Finding>(findings);
  const [query, setQuery] = useState("");
  const [severity, setSeverity] = useState("all");
  const [selected, setSelected] = useState<Finding | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safeFindings.filter((finding) => {
      const matchesQuery =
        !q ||
        ensureString(finding.id).toLowerCase().includes(q) ||
        ensureString(finding.title).toLowerCase().includes(q) ||
        ensureString(finding.affectedEndpoint).toLowerCase().includes(q) ||
        ensureString(finding.affectedData).toLowerCase().includes(q);
      const matchesSeverity = severity === "all" || finding.severity === severity;
      return matchesQuery && matchesSeverity;
    });
  }, [safeFindings, query, severity]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search findings, endpoints, affected data" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 md:w-56">
          <Filter aria-hidden className="h-4 w-4 text-muted-foreground" />
          <Select value={severity} onChange={(event) => setSeverity(event.target.value)} aria-label="Filter by severity">
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
            <option value="info">Info</option>
          </Select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Finding ID</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">CVSS</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Affected endpoint</th>
              <th className="px-4 py-3 font-semibold">Business impact</th>
              <th className="px-4 py-3 font-semibold">PDP impact</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((finding) => (
              <tr key={finding.id} className="bg-card transition hover:bg-muted/40">
                <td className="px-4 py-4 font-mono text-xs text-foreground">{ensureString(finding.id, "FIND-UNKNOWN")}</td>
                <td className="px-4 py-4 font-semibold text-foreground">{ensureString(finding.title, "Untitled finding")}</td>
                <td className="px-4 py-4 font-mono font-semibold text-foreground">{ensureNumber(finding.cvss).toFixed(1)}</td>
                <td className="px-4 py-4">
                  <SeverityBadge severity={finding.severity} />
                </td>
                <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{ensureString(finding.affectedEndpoint, "Unknown endpoint")}</td>
                <td className="max-w-xs px-4 py-4 text-muted-foreground">{ensureString(finding.businessImpact, "Business impact unavailable")}</td>
                <td className="max-w-xs px-4 py-4 text-muted-foreground">{ensureString(finding.pdpImpact, "PDP impact unavailable")}</td>
                <td className="px-4 py-4">
                  <StatusPill status={finding.status} />
                </td>
                <td className="px-4 py-4 text-right">
                  <Button type="button" variant="secondary" size="sm" onClick={() => setSelected(finding)}>
                    Inspect
                  </Button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr className="bg-card">
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No findings match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <FindingDetailDrawer finding={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
