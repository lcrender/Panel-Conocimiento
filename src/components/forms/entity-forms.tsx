"use client";

import { useActionState } from "react";
import type { ClientRecord, ProjectRecord, CategoryRecord, KnowledgeRecord } from "@/lib/data/records";
import { initialActionState, type ActionState } from "@/lib/form";
import { formatKeywords } from "@/lib/format";
import { saveCategory } from "@/server/actions/categories";
import { saveClient } from "@/server/actions/clients";
import { saveKnowledge } from "@/server/actions/knowledge";
import { saveProject } from "@/server/actions/projects";
import { Alert, controlClass, Field, Panel } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";

function FormError({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <div className="mb-4">
      <Alert>{state.error}</Alert>
    </div>
  );
}

function ActiveFields({ active = true }: { active?: boolean }) {
  return (
    <>
      <input type="hidden" name="active" value="false" />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" value="true" defaultChecked={active} />
        Activo
      </label>
    </>
  );
}

export function ClientForm({ client }: { client?: ClientRecord }) {
  const [state, action] = useActionState(saveClient, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        <FormError state={state} />
        {client ? <input type="hidden" name="id" value={client.id} /> : null}
        <Field label="Nombre">
          <input name="name" required minLength={2} maxLength={120} defaultValue={client?.name} className={controlClass} />
        </Field>
        <Field label="Estado">
          <select name="status" defaultValue={client?.status ?? "active"} className={controlClass}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </Field>
        <SubmitButton>{client ? "Guardar cliente" : "Crear cliente"}</SubmitButton>
      </form>
    </Panel>
  );
}

export function ProjectForm({
  project,
  clients,
}: {
  project?: ProjectRecord;
  clients: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(saveProject, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        <FormError state={state} />
        {project ? <input type="hidden" name="id" value={project.id} /> : null}
        <Field label="Cliente">
          <select name="clientId" defaultValue={project?.client_id ?? clients[0]?.id} required className={controlClass}>
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nombre">
          <input name="name" required minLength={2} maxLength={120} defaultValue={project?.name} className={controlClass} />
        </Field>
        <Field label="Descripción">
          <textarea name="description" rows={4} maxLength={2000} defaultValue={project?.description} className={controlClass} />
        </Field>
        <Field label="Estado">
          <select name="status" defaultValue={project?.status ?? "active"} className={controlClass}>
            <option value="active">Activo</option>
            <option value="inactive">Inactivo</option>
          </select>
        </Field>
        <SubmitButton>{project ? "Guardar proyecto" : "Crear proyecto"}</SubmitButton>
      </form>
    </Panel>
  );
}

export function CategoryForm({ category }: { category?: CategoryRecord }) {
  const [state, action] = useActionState(saveCategory, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        <FormError state={state} />
        {category ? <input type="hidden" name="id" value={category.id} /> : null}
        <Field label="Nombre">
          <input name="name" required minLength={2} maxLength={120} defaultValue={category?.name} className={controlClass} />
        </Field>
        <Field label="Descripción">
          <textarea name="description" rows={4} maxLength={2000} defaultValue={category?.description} className={controlClass} />
        </Field>
        <ActiveFields active={category?.active ?? true} />
        <SubmitButton>{category ? "Guardar categoría" : "Crear categoría"}</SubmitButton>
      </form>
    </Panel>
  );
}

export function KnowledgeForm({
  item,
  categories,
}: {
  item?: KnowledgeRecord;
  categories: { id: string; name: string; active: boolean }[];
}) {
  const [state, action] = useActionState(saveKnowledge, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        <FormError state={state} />
        {item ? <input type="hidden" name="id" value={item.id} /> : null}
        <Field label="Título interno" hint="Nombre para encontrar el registro en el panel. Ejemplo: Medios de pago.">
          <input name="title" required minLength={2} maxLength={140} defaultValue={item?.title} className={controlClass} />
        </Field>
        <Field label="Categoría">
          <select name="categoryId" required defaultValue={item?.category_id ?? ""} className={controlClass}>
            <option value="" disabled>
              Elegí una categoría
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.active ? "" : " (inactiva)"}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Pregunta" hint="La intención principal. Ejemplo: ¿Cómo puedo pagar?">
          <input name="question" required minLength={3} maxLength={400} defaultValue={item?.question} className={controlClass} />
        </Field>
        <Field label="Respuesta oficial">
          <textarea name="answer" required rows={8} maxLength={8000} defaultValue={item?.answer} className={controlClass} />
        </Field>
        <Field
          label="Palabras relacionadas"
          hint="Separalas con comas. Sirven de apoyo: la prueba también busca en el título, la pregunta y la respuesta."
        >
          <input
            name="keywords"
            defaultValue={item ? formatKeywords(item.keywords) : ""}
            placeholder="pago, tarjeta, efectivo, transferencia"
            className={controlClass}
          />
        </Field>
        <Field label="Prioridad">
          <select name="priority" defaultValue={item?.priority ?? "normal"} className={controlClass}>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
            <option value="critical">Crítica</option>
          </select>
        </Field>
        <div>
          <input type="hidden" name="allowAiRewrite" value="false" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="allowAiRewrite" value="true" defaultChecked={item?.allow_ai_rewrite ?? false} className="mt-1" />
            <span>
              La IA puede redactar esta respuesta
              <span className="mt-1 block text-xs leading-5 text-muted">
                Dejalo sin marcar cuando el texto deba salir textual: direcciones, teléfonos, códigos o instrucciones.
              </span>
            </span>
          </label>
        </div>
        <ActiveFields active={item?.active ?? true} />
        <SubmitButton>{item ? "Guardar contenido" : "Crear contenido"}</SubmitButton>
      </form>
    </Panel>
  );
}
