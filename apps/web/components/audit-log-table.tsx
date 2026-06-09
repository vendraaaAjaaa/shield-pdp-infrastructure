"use client";

import { Filter, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { DataClassificationBadge, RiskBadge, StatusPill } from "@/components/badges";
import { Input, Select } from "@/components/ui/primitives";
import type { AuditLog } from "@/lib/types";
import { formatDateTime } from "@/lib/formatters";
import { ensureArray, ensureString } from "@/lib/normalize";

export function AuditLogTable({ logs }: { logs: AuditLog[] }) {
  const safeLogs = ensureArray<AuditLog>(logs);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return safeLogs.filter((log) => {
      const matchesQuery =
        !q ||
        ensureString(log.id).toLowerCase().includes(q) ||
        ensureString(log.actor).toLowerCase().includes(q) ||
        ensureString(log.action).toLowerCase().includes(q) ||
        ensureString(log.resource).toLowerCase().includes(q);
      const matchesResult = result === "all" || log.result === result;
      return matchesQuery && matchesResult;
    });
  }, [safeLogs, query, result]);

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-center">
        <label className="relative flex-1">
          <Search aria-hidden className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search actor, resource, action" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="flex items-center gap-2 md:w-56">
          <Filter aria-hidden className="h-4 w-4 text-muted-foreground" />
          <Select value={result} onChange={(event) => setResult(event.target.value)} aria-label="Filter by result">
            <option value="all">All results</option>
            <option value="success">Success</option>
            <option value="denied">Denied</option>
            <option value="challenged">Challenged</option>
            <option value="failure">Failure</option>
          </Select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="bg-muted/70 text-xs uppercase tracking-[0.14em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">ID</th>
              <th className="px-4 py-3 font-semibold">Actor</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Action</th>
              <th className="px-4 py-3 font-semibold">Resource</th>
              <th className="px-4 py-3 font-semibold">Timestamp</th>
              <th className="px-4 py-3 font-semibold">Result</th>
              <th className="px-4 py-3 font-semibold">Risk</th>
              <th className="px-4 py-3 font-semibold">Classification</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((log) => (
              <tr key={log.id} className="bg-card transition hover:bg-muted/40">
                <td className="px-4 py-4 font-mono text-xs text-foreground">{ensureString(log.id, "unknown")}</td>
                <td className="px-4 py-4 font-semibold text-foreground">{ensureString(log.actor, "system")}</td>
                <td className="px-4 py-4 text-muted-foreground">{ensureString(log.role, "service")}</td>
                <td className="px-4 py-4 font-mono text-xs text-foreground">{ensureString(log.action, "audit.event")}</td>
                <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{ensureString(log.resource, "backend")}</td>
                <td className="px-4 py-4 text-xs text-muted-foreground">{formatDateTime(log.timestamp)}</td>
                <td className="px-4 py-4">
                  <StatusPill status={log.result} />
                </td>
                <td className="px-4 py-4">
                  <RiskBadge level={log.risk} />
                </td>
                <td className="px-4 py-4">
                  <DataClassificationBadge classification={log.classification} />
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr className="bg-card">
                <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No audit events match the current filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
