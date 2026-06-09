"use client";

import { ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function ConfirmActionDialog({
  open,
  title,
  description,
  auditPreview,
  confirmLabel = "Confirm",
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  auditPreview?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-5 shadow-panel">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-warning/30 bg-warning/10 text-warning">
            <ShieldAlert aria-hidden className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="confirm-title" className="font-display text-lg font-semibold text-foreground">
              {title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <button aria-label="Close dialog" className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose}>
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        {auditPreview ? (
          <div className="mt-4 rounded-md border border-border bg-muted/55 p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Audit preview</p>
            <p className="mt-1 font-mono text-xs leading-5 text-foreground">{auditPreview}</p>
          </div>
        ) : null}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="primary" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
