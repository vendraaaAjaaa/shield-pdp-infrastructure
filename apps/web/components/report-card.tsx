import { Download, FileText, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { DataClassificationBadge, StatusPill } from "@/components/badges";
import { Button, Card } from "@/components/ui/primitives";
import type { Report } from "@/lib/types";
import { formatDateTime } from "@/lib/formatters";
import { ensureArray, ensureString } from "@/lib/normalize";

export function ReportCard({ report }: { report: Report }) {
  const controlRefs = ensureArray<NonNullable<Report["controlRefs"]>[number]>(report.controlRefs);
  const sections = ensureArray<string>(report.sections);

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="border-b border-border bg-muted/30 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
            <FileText aria-hidden className="h-5 w-5" />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <StatusPill status={report.status} />
            <DataClassificationBadge classification={report.classification} />
          </div>
        </div>
        <p className="mt-4 font-mono text-xs font-semibold text-primary">{ensureString(report.id, "REP-UNKNOWN")}</p>
        <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{ensureString(report.title, "Untitled report")}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{ensureString(report.description, "Report description unavailable.")}</p>
      </div>
      <div className="flex flex-1 flex-col p-5">
        {report.audience ? (
          <div className="mb-4 flex gap-3 rounded-md border border-border bg-muted/35 p-3">
            <UsersRound aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Audience</p>
              <p className="mt-1 text-sm text-foreground">{ensureString(report.audience, "Not specified")}</p>
            </div>
          </div>
        ) : null}
        {controlRefs.length ? (
          <div className="mb-4 flex flex-wrap gap-2">
            {controlRefs.map((control) => (
              <span key={control} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <ShieldCheck aria-hidden className="h-3.5 w-3.5" />
                {control}
              </span>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {sections.length ? sections.map((section) => (
            <span key={section} className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
              {section}
            </span>
          )) : <span className="rounded-full border border-dashed border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">No sections available</span>}
        </div>
        {report.exportReadiness ? (
          <div className="mt-4 rounded-md border border-warning/35 bg-warning/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-warning">Export readiness</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{ensureString(report.exportReadiness, "Export readiness unavailable.")}</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 border-t border-border p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-5 text-muted-foreground">
          <p>Owner: {ensureString(report.owner, "Unassigned")}</p>
          <p>Updated: {formatDateTime(report.updatedAt)}</p>
        </div>
        <Button type="button" variant="secondary" disabled title="Export integration is a placeholder">
          <Download aria-hidden className="h-4 w-4" />
          Export
          <LockKeyhole aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}

export function CompactReportCard({ report }: { report: Report }) {
  const sections = ensureArray<string>(report.sections);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
          <FileText aria-hidden className="h-5 w-5" />
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusPill status={report.status} />
          <DataClassificationBadge classification={report.classification} />
        </div>
      </div>
      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{ensureString(report.title, "Untitled report")}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{ensureString(report.description, "Report description unavailable.")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {sections.length ? sections.map((section) => (
          <span key={section} className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
            {section}
          </span>
        )) : <span className="rounded-full border border-dashed border-border bg-muted/40 px-2.5 py-1 text-xs font-semibold text-muted-foreground">No sections available</span>}
      </div>
      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs leading-5 text-muted-foreground">
          <p>Owner: {ensureString(report.owner, "Unassigned")}</p>
          <p>Updated: {formatDateTime(report.updatedAt)}</p>
        </div>
        <Button type="button" variant="secondary" disabled title="Export integration is a placeholder">
          <Download aria-hidden className="h-4 w-4" />
          Export
          <LockKeyhole aria-hidden className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
