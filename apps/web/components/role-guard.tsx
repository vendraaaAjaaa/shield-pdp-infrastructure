"use client";

import { LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";
import { DataClassificationBadge } from "@/components/badges";
import { Button, Card } from "@/components/ui/primitives";
import { demoRoles } from "@/lib/auth-demo";
import type { Role } from "@/lib/types";
import { useDemoRole } from "@/components/role-switcher";

export function RoleGuard({
  allowed,
  children,
  fallbackTitle = "Insufficient permission",
}: {
  allowed: Role[];
  children: ReactNode;
  fallbackTitle?: string;
}) {
  const { role, setRole } = useDemoRole();

  if (allowed.includes(role)) return <>{children}</>;

  const recommended = demoRoles.find((item) => allowed.includes(item.id)) ?? demoRoles[0];

  return (
    <Card className="p-8">
      <div className="flex max-w-2xl flex-col gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-md border border-warning/30 bg-warning/10 text-warning">
          <LockKeyhole aria-hidden className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">{fallbackTitle}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This workspace contains role-scoped fintech, security, or compliance evidence. Switch the demo role to continue.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <DataClassificationBadge classification="Confidential" />
          <DataClassificationBadge classification="Sensitive Personal Data" />
        </div>
        <Button type="button" className="w-fit" onClick={() => setRole(recommended.id)}>
          Switch to {recommended.label}
        </Button>
      </div>
    </Card>
  );
}
