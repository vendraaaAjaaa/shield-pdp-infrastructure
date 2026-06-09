"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";
import { SeverityBadge, StatusPill } from "@/components/badges";
import { Button } from "@/components/ui/primitives";
import type { Finding } from "@/lib/types";
import { ensureArray, ensureNumber, ensureString } from "@/lib/normalize";

export function FindingDetailDrawer({
  finding,
  onClose,
}: {
  finding: Finding | null;
  onClose: () => void;
}) {
  if (!finding) return null;
  const evidence = ensureArray<string>(finding.evidence);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-sm" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-border bg-card shadow-panel">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-card/95 p-5 backdrop-blur">
          <div>
            <p className="font-mono text-xs font-semibold text-primary">{ensureString(finding.id, "FIND-UNKNOWN")}</p>
            <h2 className="mt-1 font-display text-xl font-semibold text-foreground">{ensureString(finding.title, "Untitled finding")}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <SeverityBadge severity={finding.severity} />
              <StatusPill status={finding.status} />
              <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground">CVSS {ensureNumber(finding.cvss).toFixed(1)}</span>
            </div>
          </div>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close finding detail">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-5 p-5">
          <Section title="Affected asset">{ensureString(finding.affectedAsset, "Unknown asset")}</Section>
          <Section title="Affected endpoint">
            <span className="font-mono">{ensureString(finding.affectedEndpoint, "Unknown endpoint")}</span>
          </Section>
          <Section title="Affected data">{ensureString(finding.affectedData, "Unknown data")}</Section>
          <Section title="Business impact">{ensureString(finding.businessImpact, "Business impact unavailable.")}</Section>
          <Section title="PDP impact">{ensureString(finding.pdpImpact, "PDP impact unavailable.")}</Section>
          <Section title="Safe reproduction summary">{ensureString(finding.reproductionSummary, "Reproduction summary unavailable.")}</Section>
          <section className="rounded-lg border border-border bg-muted/35 p-4">
            <h3 className="text-sm font-semibold text-foreground">Evidence</h3>
            <ul className="mt-3 grid gap-2">
              {evidence.length ? evidence.map((item) => (
                <li key={item} className="rounded-md bg-card px-3 py-2 text-sm text-muted-foreground">
                  {item}
                </li>
              )) : <li className="rounded-md border border-dashed border-border bg-card px-3 py-2 text-sm text-muted-foreground">No evidence items available.</li>}
            </ul>
          </section>
          <Section title="Remediation">{ensureString(finding.remediation, "Remediation unavailable.")}</Section>
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{children}</p>
    </section>
  );
}
