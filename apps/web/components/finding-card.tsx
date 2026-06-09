import { AlertTriangle } from "lucide-react";
import { SeverityBadge, StatusPill } from "@/components/badges";
import { Card } from "@/components/ui/primitives";
import type { Finding } from "@/lib/types";
import { ensureNumber, ensureString } from "@/lib/normalize";

export function FindingCard({ finding }: { finding: Finding }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-risk-high/30 bg-risk-high/10 text-risk-high">
            <AlertTriangle aria-hidden className="h-5 w-5" />
          </div>
          <div>
            <p className="font-mono text-xs font-semibold text-muted-foreground">{ensureString(finding.id, "FIND-UNKNOWN")}</p>
            <h3 className="mt-1 font-display text-base font-semibold text-foreground">{ensureString(finding.title, "Untitled finding")}</h3>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <SeverityBadge severity={finding.severity} />
          <StatusPill status={finding.status} />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{ensureString(finding.businessImpact, "Business impact unavailable.")}</p>
      <div className="mt-4 grid gap-2 text-sm">
        <p>
          <span className="font-semibold text-foreground">Endpoint:</span> <span className="font-mono text-muted-foreground">{ensureString(finding.affectedEndpoint, "Unknown endpoint")}</span>
        </p>
        <p>
          <span className="font-semibold text-foreground">Affected data:</span> <span className="text-muted-foreground">{ensureString(finding.affectedData, "Unknown data")}</span>
        </p>
        <p>
          <span className="font-semibold text-foreground">CVSS:</span> <span className="font-mono text-muted-foreground">{ensureNumber(finding.cvss).toFixed(1)}</span>
        </p>
      </div>
      <div className="mt-4 rounded-md border border-border bg-muted/35 p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">PDP impact</p>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{ensureString(finding.pdpImpact, "PDP impact unavailable.")}</p>
      </div>
    </Card>
  );
}
