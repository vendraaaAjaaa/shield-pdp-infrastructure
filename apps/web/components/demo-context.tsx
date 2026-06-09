import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  FileText,
  KeyRound,
  Landmark,
  LockKeyhole,
  SearchCheck,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { StatusPill } from "@/components/badges";
import { Card } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

type Tone = "primary" | "success" | "warning" | "danger" | "info";

const toneClasses: Record<Tone, string> = {
  primary: "border-primary/30 bg-primary/10 text-primary",
  success: "border-success/30 bg-success/10 text-success",
  warning: "border-warning/35 bg-warning/10 text-warning",
  danger: "border-danger/35 bg-danger/10 text-danger",
  info: "border-info/30 bg-info/10 text-info",
};

export function DemoCallout({
  title,
  eyebrow = "Demo context",
  description,
  icon: Icon = Landmark,
  tone = "primary",
  children,
}: {
  title: string;
  eyebrow?: string;
  description: string;
  icon?: LucideIcon;
  tone?: Tone;
  children?: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid gap-4 p-5 lg:grid-cols-[auto_1fr]">
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-md border", toneClasses[tone])}>
          <Icon aria-hidden className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h2 className="mt-2 font-display text-xl font-semibold text-foreground">{title}</h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-muted-foreground">{description}</p>
          {children ? <div className="mt-4">{children}</div> : null}
        </div>
      </div>
    </Card>
  );
}

const roleJourney = [
  {
    role: "Customer",
    href: "/dashboard",
    icon: UserRound,
    title: "Wallet and privacy trust",
    text: "Open balance, transactions, security posture, consent, and masked personal data.",
  },
  {
    role: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    title: "Operations and auditability",
    text: "Review customers, suspicious API calls, incidents, audit logs, and system health.",
  },
  {
    role: "Auditor",
    href: "/compliance",
    icon: ClipboardCheck,
    title: "UU PDP evidence",
    text: "Trace PDP-01 encryption, PDP-02 access logging, and PDP-03 notification readiness.",
  },
  {
    role: "Pentester",
    href: "/pentest",
    icon: SearchCheck,
    title: "Safe validation evidence",
    text: "Inspect RoE, BOLA evidence, CVSS findings, segmentation, and remediation state.",
  },
];

export function DemoJourney() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {roleJourney.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.role}
            href={item.href}
            className="group rounded-lg border border-border bg-card p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-panel"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <Icon aria-hidden className="h-5 w-5" />
              </div>
              <ArrowRight aria-hidden className="h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">{item.role}</p>
            <h3 className="mt-1 font-display text-base font-semibold text-foreground">{item.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.text}</p>
          </Link>
        );
      })}
    </div>
  );
}

const pdpControls = [
  {
    id: "PDP-01",
    title: "Encryption safeguards",
    icon: KeyRound,
    description: "Encryption at rest, encryption in transit, and key-management evidence for sensitive records and report artifacts.",
    proof: "TLS policy, DB volume attestation, KMS rotation ticket",
    status: "watch",
  },
  {
    id: "PDP-02",
    title: "Access control and audit logging",
    icon: LockKeyhole,
    description: "Least privilege, object-level authorization, reveal justification, and immutable sensitive-data access logs.",
    proof: "RBAC matrix, BOLA evidence, denied-access audit event",
    status: "gap",
  },
  {
    id: "PDP-03",
    title: "3 x 24 hours notification",
    icon: Clock3,
    description: "Incident classification, affected-data mapping, legal checklist, and management approval before deadline.",
    proof: "Timeline, affected-data worksheet, notification checklist",
    status: "in-progress",
  },
];

export function PdpControlStrip() {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {pdpControls.map((control) => {
        const Icon = control.icon;
        return (
          <Card key={control.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                <Icon aria-hidden className="h-5 w-5" />
              </div>
              <StatusPill status={control.status} />
            </div>
            <p className="mt-4 font-mono text-xs font-semibold text-primary">{control.id}</p>
            <h3 className="mt-1 font-display text-lg font-semibold text-foreground">{control.title}</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{control.description}</p>
            <div className="mt-4 rounded-md border border-border bg-muted/45 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Evidence</p>
              <p className="mt-1 text-sm text-foreground">{control.proof}</p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function DemoStepList({
  steps,
}: {
  steps: Array<{
    title: string;
    text: string;
  }>;
}) {
  return (
    <div className="grid gap-3">
      {steps.map((step, index) => (
        <div key={step.title} className="flex gap-3 rounded-md border border-border bg-muted/35 p-3">
          <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-xs font-semibold text-primary">
            {index + 1}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{step.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function DeliverableReadiness({
  items,
}: {
  items: Array<{
    label: string;
    status: string;
  }>;
}) {
  return (
    <div className="grid gap-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2">
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
            <CheckCircle2 aria-hidden className="h-4 w-4 text-primary" />
            {item.label}
          </span>
          <StatusPill status={item.status} />
        </div>
      ))}
    </div>
  );
}

export function EvidenceIndexCard({
  title,
  items,
}: {
  title: string;
  items: string[];
}) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-md border border-info/25 bg-info/10 text-info">
          <FileText aria-hidden className="h-5 w-5" />
        </div>
        <h2 className="font-display text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="mt-4 grid gap-2">
        {items.map((item) => (
          <p key={item} className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            {item}
          </p>
        ))}
      </div>
    </Card>
  );
}
