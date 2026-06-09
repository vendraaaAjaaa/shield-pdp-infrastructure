"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { ConfirmActionDialog } from "@/components/confirm-action-dialog";
import { Button } from "@/components/ui/primitives";

export function MaskedValue({
  label,
  masked,
  revealed,
  reason,
}: {
  label: string;
  masked: string;
  revealed: string;
  reason: string;
}) {
  const [visible, setVisible] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const auditPreview = `action=sensitive_value.reveal label="${label}" reason="${reason}" result=challenged`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-sm font-semibold text-foreground">{visible ? revealed : masked}</span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        onClick={() => (visible ? setVisible(false) : setConfirmOpen(true))}
        aria-label={visible ? `Hide ${label}` : `Reveal ${label}`}
      >
        {visible ? <EyeOff aria-hidden className="h-4 w-4" /> : <Eye aria-hidden className="h-4 w-4" />}
        {visible ? "Hide" : "Reveal"}
      </Button>
      <ConfirmActionDialog
        open={confirmOpen}
        title={`Reveal ${label}?`}
        description="Sensitive personal data is masked by default. Revealing it should have a business reason and will create an audit event preview in this demo."
        auditPreview={auditPreview}
        confirmLabel="Reveal value"
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          setVisible(true);
          setConfirmOpen(false);
        }}
      />
    </div>
  );
}
