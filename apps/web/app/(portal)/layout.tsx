import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell";
import { getBackendConnectionState } from "@/lib/api/client";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const backendState = await getBackendConnectionState();
  return <AppShell backendState={backendState}>{children}</AppShell>;
}
