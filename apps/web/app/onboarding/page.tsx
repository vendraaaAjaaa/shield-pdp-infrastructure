import { ArrowRight, BadgeCheck, FileSignature, Fingerprint, Landmark, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { DataClassificationBadge, StatusPill } from "@/components/badges";
import { Button, Card, CardHeader, Input, PageHeader } from "@/components/ui/primitives";

const steps = [
  { title: "Identity verification", icon: Fingerprint, status: "in-progress", text: "KYC simulation for NIK, liveness, and customer profile matching." },
  { title: "Consent agreement", icon: FileSignature, status: "pending", text: "Purpose, retention, and data-sharing consent records are captured." },
  { title: "Secure account activation", icon: ShieldCheck, status: "ready", text: "MFA placeholder, trusted device setup, and masked data defaults." },
];

export default function OnboardingPage() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="mx-auto max-w-6xl">
        <Link href="/login" className="mb-8 inline-flex items-center gap-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
          <Landmark aria-hidden className="h-5 w-5 text-primary" />
          Dana Sejahtera Shield
        </Link>
        <PageHeader
          eyebrow="Customer onboarding"
          title="Privacy-first account opening"
          description="A realistic KYC/KYB simulation for the Shield-PDP fintech portal. All identity values are placeholders and sensitive data remains masked by default."
          action={
            <Button type="button" variant="secondary">
              <BadgeCheck aria-hidden className="h-4 w-4" />
              Demo KYC mode
            </Button>
          }
        />
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <CardHeader title="Application details" description="No real personal data should be entered in this educational lab." />
            <form className="grid gap-4 p-5">
              <label className="grid gap-2 text-sm font-semibold">
                Legal name
                <Input placeholder="Synthetic customer name" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Masked NIK
                <Input placeholder="3174********0000" />
              </label>
              <label className="grid gap-2 text-sm font-semibold">
                Business or employer
                <Input placeholder="Optional KYB simulation field" />
              </label>
              <div className="rounded-lg border border-border bg-muted/45 p-4">
                <p className="text-sm font-semibold text-foreground">Consent placeholders</p>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <label className="flex gap-2">
                    <input type="checkbox" className="mt-1" /> KYC identity verification and fraud prevention.
                  </label>
                  <label className="flex gap-2">
                    <input type="checkbox" className="mt-1" /> Transaction monitoring and audit logging.
                  </label>
                  <label className="flex gap-2">
                    <input type="checkbox" className="mt-1" /> Optional biometric login template metadata.
                  </label>
                </div>
              </div>
              <Link
                href="/dashboard"
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-primary bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Continue demo onboarding
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            </form>
          </Card>
          <div className="grid gap-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-primary/25 bg-primary/10 text-primary">
                      <Icon aria-hidden className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 className="font-display text-lg font-semibold text-foreground">{step.title}</h2>
                        <StatusPill status={step.status} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
            <Card className="p-5">
              <p className="text-sm font-semibold text-foreground">Data classification</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <DataClassificationBadge classification="Personal Data" />
                <DataClassificationBadge classification="Sensitive Personal Data" />
                <DataClassificationBadge classification="Confidential" />
              </div>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
