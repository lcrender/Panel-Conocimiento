"use client";

import { useActionState } from "react";
import { Alert, controlClass, Field, Panel } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { initialActionState, type ActionState } from "@/lib/form";
import { assignProjectOpenAIKey, createOpenAIKey, saveProjectSimilarityThreshold } from "@/server/actions/openai-keys";

function FormError({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <div className="mb-4">
      <Alert>{state.error}</Alert>
    </div>
  );
}

export function OpenAIKeyForm({ clientId }: { clientId: string }) {
  const [state, action] = useActionState(createOpenAIKey, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        <FormError state={state} />
        <input type="hidden" name="clientId" value={clientId} />
        <Field label="Nombre" hint="Por ejemplo, Producción o Pruebas.">
          <input name="name" required minLength={2} maxLength={80} className={controlClass} />
        </Field>
        <Field label="Clave de OpenAI" hint="Después de guardarla solo se ven los últimos cuatro caracteres.">
          <input name="apiKey" type="password" required autoComplete="off" className={controlClass} />
        </Field>
        <SubmitButton>Agregar clave</SubmitButton>
      </form>
    </Panel>
  );
}

export function ProjectOpenAIKeyForm({
  projectId,
  clientId,
  keys,
  selectedId,
  returnTo,
  projectName,
}: {
  projectId: string;
  clientId: string;
  keys: { id: string; name: string; keyHint: string }[];
  selectedId: string | null;
  returnTo?: string;
  projectName?: string;
}) {
  const [state, action] = useActionState(assignProjectOpenAIKey, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        <FormError state={state} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="clientId" value={clientId} />
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}
        <Field
          label={projectName ? `Clave de ${projectName}` : "Clave de este proyecto"}
          hint="Solo se ofrecen las claves cargadas en la cuenta de este cliente."
        >
          <select name="keyId" defaultValue={selectedId ?? ""} className={controlClass}>
            <option value="">Sin clave</option>
            {keys.map((key) => (
              <option key={key.id} value={key.id}>
                {key.name} ({key.keyHint})
              </option>
            ))}
          </select>
        </Field>
        <SubmitButton>Guardar</SubmitButton>
      </form>
    </Panel>
  );
}

export function ProjectSimilarityForm({
  projectId,
  clientId,
  threshold,
}: {
  projectId: string;
  clientId: string;
  threshold: number;
}) {
  const [state, action] = useActionState(saveProjectSimilarityThreshold, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        <FormError state={state} />
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="clientId" value={clientId} />
        <Field
          label="Umbral de similitud"
          hint="Entre 0 y 1. Un valor más alto exige que la consulta se parezca más al contenido de este proyecto."
        >
          <input
            name="similarityThreshold"
            type="number"
            min={0}
            max={1}
            step={0.01}
            required
            defaultValue={threshold}
            className={controlClass}
          />
        </Field>
        <SubmitButton>Guardar umbral</SubmitButton>
      </form>
    </Panel>
  );
}
