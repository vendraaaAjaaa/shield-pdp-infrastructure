import type { LucideIcon } from "lucide-react";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/primitives";

export function EmptyState({
  title,
  description,
  icon: Icon = Inbox,
}: {
  title: string;
  description: string;
  icon?: LucideIcon;
}) {
  return (
    <Card className="grid place-items-center p-10 text-center">
      <Icon aria-hidden className="h-10 w-10 text-muted-foreground" />
      <h2 className="mt-4 font-display text-lg font-semibold text-foreground">{title}</h2>
      <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </Card>
  );
}

export function LoadingState({ label = "Loading secure workspace" }: { label?: string }) {
  return (
    <Card className="flex items-center gap-3 p-5">
      <Loader2 aria-hidden className="h-5 w-5 animate-spin text-primary" />
      <p className="text-sm font-semibold text-muted-foreground">{label}</p>
    </Card>
  );
}

export function ErrorState({
  title = "Backend request error",
  description,
}: {
  title?: string;
  description: string;
}) {
  return (
    <Card className="border-danger/35 bg-danger/10 p-5">
      <div className="flex gap-3">
        <AlertTriangle aria-hidden className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
        <div>
          <p className="font-semibold text-danger">{title}</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        </div>
      </div>
    </Card>
  );
}
