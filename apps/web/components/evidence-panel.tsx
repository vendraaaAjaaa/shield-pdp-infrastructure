import { ClipboardCheck, FileSearch } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/primitives";
import { ensureArray, ensureString } from "@/lib/normalize";

export function EvidencePanel({
  title,
  description,
  evidence,
}: {
  title: string;
  description?: string;
  evidence: string[];
}) {
  const items = ensureArray<string>(evidence);

  return (
    <Card>
      <CardHeader
        title={
          <span className="inline-flex items-center gap-2">
            <FileSearch aria-hidden className="h-5 w-5 text-primary" />
            {ensureString(title, "Evidence")}
          </span>
        }
        description={description}
      />
      <div className="grid gap-3 p-5">
        {items.length ? items.map((item) => (
          <div key={item} className="flex gap-3 rounded-md border border-border bg-muted/40 p-3">
            <ClipboardCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <p className="text-sm leading-6 text-foreground">{item}</p>
          </div>
        )) : <p className="rounded-md border border-dashed border-border bg-muted/25 p-4 text-sm text-muted-foreground">No evidence items available.</p>}
      </div>
    </Card>
  );
}
