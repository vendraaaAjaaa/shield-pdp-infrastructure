import { CheckCircle2, CircleDot, Clock3 } from "lucide-react";
import { StatusPill } from "@/components/badges";
import type { TimelineEvent } from "@/lib/types";
import { formatDateTime } from "@/lib/formatters";
import { ensureArray, ensureString } from "@/lib/normalize";
import { cn } from "@/lib/utils";

export function Timeline({ events }: { events: TimelineEvent[] }) {
  const safeEvents = ensureArray<TimelineEvent>(events);

  return (
    <ol className="relative grid gap-4 before:absolute before:left-5 before:top-2 before:h-[calc(100%-1rem)] before:w-px before:bg-border">
      {safeEvents.length ? safeEvents.map((event) => {
        const Icon = event.status === "complete" ? CheckCircle2 : event.status === "pending" ? Clock3 : CircleDot;
        return (
          <li key={event.id} className="relative grid grid-cols-[2.5rem_1fr] gap-3">
            <div
              className={cn(
                "relative z-10 flex h-10 w-10 items-center justify-center rounded-full border bg-card",
                event.status === "complete" && "border-success/35 text-success",
                event.status === "pending" && "border-warning/40 text-warning",
                event.status === "ready" && "border-info/35 text-info",
              )}
            >
              <Icon aria-hidden className="h-5 w-5" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{ensureString(event.title, "Timeline event")}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(event.time)}</p>
                </div>
                <StatusPill status={event.status} />
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{ensureString(event.description, "Event details unavailable.")}</p>
            </div>
          </li>
        );
      }) : <li className="rounded-md border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">No timeline events available.</li>}
    </ol>
  );
}
