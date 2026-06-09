import { safeClientId } from "@/lib/safe-id";

const requestId: string = safeClientId("req");
const uiId: string = safeClientId("ui");
const correlationId: string = safeClientId("correlation");

if (!requestId.startsWith("req-") || !uiId.startsWith("ui-") || !correlationId.startsWith("correlation-")) {
  throw new Error("safeClientId must preserve caller prefixes");
}
