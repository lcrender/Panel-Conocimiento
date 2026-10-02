"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { buttonClass } from "./primitives";

export function SubmitButton({
  children,
  pendingLabel = "Guardando…",
  variant = "primary",
  size = "md",
}: {
  children: ReactNode;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "md" | "sm";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, size)}>
      {pending ? pendingLabel : children}
    </button>
  );
}
