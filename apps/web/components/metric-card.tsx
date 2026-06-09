import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = "primary",
  trend,
}: {
  label: string;
  value: string;
  description?: string;
  icon: LucideIcon;
  tone?: "primary" | "success" | "warning" | "danger" | "info";
  trend?: ReactNode;
}) {
  return (
    <Card className="overflow-hidden p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 font-display text-2xl font-semibold tracking-normal text-foreground">{value}</p>
        </div>
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-md border",
            tone === "primary" && "border-primary/25 bg-primary/10 text-primary",
            tone === "success" && "border-success/25 bg-success/10 text-success",
            tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
            tone === "danger" && "border-danger/30 bg-danger/10 text-danger",
            tone === "info" && "border-info/25 bg-info/10 text-info",
          )}
        >
          <Icon aria-hidden className="h-5 w-5" />
        </div>
      </div>
      {description ? <p className="mt-4 text-sm leading-6 text-muted-foreground">{description}</p> : null}
      {trend ? <div className="mt-4">{trend}</div> : null}
    </Card>
  );
}
