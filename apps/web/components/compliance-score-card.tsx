import { ShieldCheck } from "lucide-react";
import { StatusPill } from "@/components/badges";
import { Card } from "@/components/ui/primitives";
import type { ComplianceControl } from "@/lib/types";
import { ensureArray, ensureNumber, ensureString } from "@/lib/normalize";
import { cn } from "@/lib/utils";

export function ComplianceScoreCard({ control }: { control: ComplianceControl }) {
  const score = Math.max(0, Math.min(100, ensureNumber(control.score)));
  const evidence = ensureArray<string>(control.evidence);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-xs font-semibold text-primary">{ensureString(control.id, "PDP")}</p>
            <StatusPill status={control.status} />
          </div>
          <h3 className="mt-3 font-display text-lg font-semibold text-foreground">{ensureString(control.title, "Control evidence")}</h3>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{ensureString(control.summary, "Control summary unavailable.")}</p>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          <ShieldCheck aria-hidden className="h-6 w-6" />
        </div>
      </div>
      <div className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-border bg-muted/35 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Control owner</span>
          <span className="text-sm font-semibold text-foreground">{ensureString(control.owner, "Unassigned")}</span>
        </div>
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">Evidence readiness</span>
          <span className="font-mono font-semibold text-foreground">{score}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted">
          <div
            className={cn(
              "h-2 rounded-full",
              score >= 85 && "bg-success",
              score < 85 && score >= 75 && "bg-warning",
              score < 75 && "bg-danger",
            )}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      <div className="mt-5 grid gap-2">
        {evidence.length ? evidence.map((item) => (
          <p key={item} className="rounded-md bg-muted/55 px-3 py-2 text-sm text-muted-foreground">
            {item}
          </p>
        )) : <p className="rounded-md border border-dashed border-border bg-muted/25 px-3 py-2 text-sm text-muted-foreground">No evidence items available.</p>}
      </div>
    </Card>
  );
}
