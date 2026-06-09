import { RiskBadge } from "@/components/badges";
import type { RiskMatrixCell } from "@/lib/types";
import { ensureArray, ensureNumber } from "@/lib/normalize";
import { cn } from "@/lib/utils";

const likelihoods = ["Likely", "Possible", "Unlikely"];
const impacts = ["Minor", "Moderate", "Major", "Severe"];

export function RiskMatrix({ data }: { data: RiskMatrixCell[] }) {
  const cells = ensureArray<RiskMatrixCell>(data);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[620px]">
        <div className="grid grid-cols-[7rem_repeat(4,1fr)] gap-2 text-xs font-semibold text-muted-foreground">
          <div />
          {impacts.map((impact) => (
            <div key={impact} className="rounded-md border border-border bg-muted/55 px-3 py-2 text-center">
              {impact}
            </div>
          ))}
        </div>
        <div className="mt-2 grid gap-2">
          {likelihoods.map((likelihood) => (
            <div key={likelihood} className="grid grid-cols-[7rem_repeat(4,1fr)] gap-2">
              <div className="flex items-center rounded-md border border-border bg-muted/55 px-3 text-xs font-semibold text-muted-foreground">
                {likelihood}
              </div>
              {impacts.map((impact) => {
                const cell = cells.find((item) => item.likelihood === likelihood && item.impact === impact);
                return (
                  <div
                    key={`${likelihood}-${impact}`}
                    className={cn(
                      "min-h-20 rounded-md border p-3",
                      !cell && "border-border bg-card",
                      cell?.level === "critical" && "border-risk-critical/35 bg-risk-critical/10",
                      cell?.level === "high" && "border-risk-high/35 bg-risk-high/10",
                      cell?.level === "medium" && "border-risk-medium/35 bg-risk-medium/10",
                      cell?.level === "low" && "border-risk-low/35 bg-risk-low/10",
                    )}
                  >
                    {cell ? (
                      <div className="flex h-full flex-col justify-between gap-2">
                        <RiskBadge level={cell.level} />
                        <p className="font-display text-2xl font-semibold text-foreground">{ensureNumber(cell.count)}</p>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No active items</p>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
