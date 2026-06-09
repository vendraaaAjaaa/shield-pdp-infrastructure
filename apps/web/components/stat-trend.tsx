import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatTrend({
  value,
  direction,
  label,
}: {
  value: string;
  direction: "up" | "down" | "flat";
  label: string;
}) {
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold",
        direction === "up" && "border-success/30 bg-success/10 text-success",
        direction === "down" && "border-danger/30 bg-danger/10 text-danger",
        direction === "flat" && "border-border bg-muted text-muted-foreground",
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {value} <span className="font-medium opacity-80">{label}</span>
    </span>
  );
}
