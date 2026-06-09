import { ArrowRight, Database, Globe2, Server, ShieldCheck, ShieldX } from "lucide-react";
import { StatusPill } from "@/components/badges";
import type { SegmentationPath } from "@/lib/types";
import { formatDateTime } from "@/lib/formatters";
import { ensureArray, ensureString } from "@/lib/normalize";
import { cn } from "@/lib/utils";

const zoneIcon = {
  "web-public-zone": Globe2,
  "api-private-zone": Server,
  "ledger-db-zone": Database,
  "reports-worker-zone": Server,
  "audit-log-zone": Database,
};

export function SegmentationMap({ paths }: { paths: SegmentationPath[] }) {
  const safePaths = ensureArray<SegmentationPath>(paths);

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 lg:grid-cols-5">
        {["web-public-zone", "api-private-zone", "ledger-db-zone", "reports-worker-zone", "audit-log-zone"].map((zone) => {
          const Icon = zoneIcon[zone as keyof typeof zoneIcon];
          return (
            <div key={zone} className="rounded-lg border border-border bg-card p-4">
              <Icon aria-hidden className="h-5 w-5 text-primary" />
              <p className="mt-3 text-sm font-semibold text-foreground">{zone}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">Zero-trust policy boundary</p>
            </div>
          );
        })}
      </div>
      <div className="grid gap-3">
        {safePaths.length ? safePaths.map((path) => {
          const Icon = path.result === "allowed" ? ShieldCheck : ShieldX;
          return (
            <div key={path.id} className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                  <span className="rounded-md bg-muted px-2 py-1">{ensureString(path.source, "unknown source")}</span>
                  <ArrowRight aria-hidden className="h-4 w-4 text-muted-foreground" />
                  <span className="rounded-md bg-muted px-2 py-1">{ensureString(path.target, "unknown target")}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill status={path.result} />
                  <span className="rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">{ensureString(path.protocol, "unknown protocol")}</span>
                </div>
              </div>
              <div className="mt-3 flex gap-3">
                <Icon
                  aria-hidden
                  className={cn("mt-0.5 h-5 w-5 shrink-0", path.result === "allowed" ? "text-success" : "text-danger")}
                />
                <div>
                  <p className="text-sm leading-6 text-muted-foreground">{ensureString(path.evidence, "Evidence unavailable.")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(path.timestamp)}</p>
                </div>
              </div>
            </div>
          );
        }) : <p className="rounded-md border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">No segmentation paths available.</p>}
      </div>
    </div>
  );
}
