"use client";

import { ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { demoRoles, getRoleProfile, roleStorageKey } from "@/lib/auth-demo";
import type { Role } from "@/lib/types";

export function useDemoRole() {
  const [role, setRoleState] = useState<Role>("customer");

  useEffect(() => {
    const stored = window.localStorage.getItem(roleStorageKey) as Role | null;
    if (stored && demoRoles.some((item) => item.id === stored)) setRoleState(stored);

    const onRoleChange = () => {
      const next = window.localStorage.getItem(roleStorageKey) as Role | null;
      if (next && demoRoles.some((item) => item.id === next)) setRoleState(next);
    };

    window.addEventListener("shield-role-change", onRoleChange);
    return () => window.removeEventListener("shield-role-change", onRoleChange);
  }, []);

  function setRole(nextRole: Role) {
    window.localStorage.setItem(roleStorageKey, nextRole);
    setRoleState(nextRole);
    window.dispatchEvent(new Event("shield-role-change"));
  }

  return { role, profile: getRoleProfile(role), setRole };
}

export function RoleSwitcher({ compact = false }: { compact?: boolean }) {
  const { role, profile, setRole } = useDemoRole();

  return (
    <label className="grid gap-1 text-xs text-muted-foreground">
      {!compact ? <span className="font-semibold">Demo role</span> : null}
      <span className="relative">
        <ShieldCheck aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
        <select
          data-testid="role-switcher"
          className="h-10 w-full min-w-44 rounded-md border border-border bg-card pl-9 pr-8 text-sm font-semibold text-foreground shadow-sm"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          aria-label="Select demo role"
        >
          {demoRoles.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </span>
      {!compact ? <span className="truncate">{profile.clearance}</span> : null}
    </label>
  );
}
