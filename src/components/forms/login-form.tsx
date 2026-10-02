"use client";

import { useActionState } from "react";
import { initialActionState } from "@/lib/form";
import { login } from "@/server/actions/auth";
import { Alert, controlClass, Field } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";

export function LoginForm({ notice }: { notice?: string }) {
  const [state, action] = useActionState(login, initialActionState);
  return (
    <form action={action} className="space-y-4">
      {notice ? <Alert tone="info">{notice}</Alert> : null}
      {state.error ? <Alert>{state.error}</Alert> : null}
      <Field label="Email">
        <input name="email" type="email" required autoComplete="email" className={controlClass} />
      </Field>
      <Field label="Contraseña">
        <input name="password" type="password" required autoComplete="current-password" className={controlClass} />
      </Field>
      <SubmitButton pendingLabel="Ingresando…">Ingresar</SubmitButton>
    </form>
  );
}
