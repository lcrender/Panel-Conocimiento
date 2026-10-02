"use client";

import { useActionState, useState } from "react";
import { SCOPE_LABELS } from "@/domain/labels";
import { initialActionState } from "@/lib/form";
import { createRole, saveRolePermissions } from "@/server/actions/roles";
import type { PermissionRecord, RoleRecord } from "@/lib/data/people";
import { Alert, controlClass, Field, Panel } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";

export function RoleCreateForm() {
  const [state, action] = useActionState(createRole, initialActionState);
  const [scope, setScope] = useState<"platform" | "client" | "project">("project");
  return (
    <Panel>
      <h2 className="text-base font-semibold">Nuevo rol</h2>
      <form action={action} className="mt-4 space-y-4">
        {state.error ? <Alert>{state.error}</Alert> : null}
        <Field label="Nombre">
          <input name="name" required minLength={2} className={controlClass} />
        </Field>
        <Field label="Identificador" hint="Minúsculas y guion bajo. No se puede cambiar después.">
          <input name="slug" required pattern="[a-z][a-z0-9_]{1,40}" className={controlClass} />
        </Field>
        <Field label="Descripción">
          <input name="description" maxLength={300} className={controlClass} />
        </Field>
        <Field label="Alcance">
          <select name="scope" value={scope} onChange={(event) => setScope(event.target.value as typeof scope)} className={controlClass}>
            <option value="project">{SCOPE_LABELS.project}</option>
            <option value="client">{SCOPE_LABELS.client}</option>
            <option value="platform">{SCOPE_LABELS.platform}</option>
          </select>
        </Field>
        {scope === "project" ? (
          <div>
            <input type="hidden" name="allowsOverrides" value="false" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="allowsOverrides" value="true" />
              Admite el permiso adicional de categorías
            </label>
          </div>
        ) : null}
        <SubmitButton>Crear rol</SubmitButton>
      </form>
    </Panel>
  );
}

export function RolePermissionsForm({ role, permissions }: { role: RoleRecord; permissions: PermissionRecord[] }) {
  if (role.slug === "super_admin") {
    return (
      <Panel>
        <h2 className="text-base font-semibold">{role.name}</h2>
        <p className="mt-1 text-sm text-muted">Los permisos de este rol quedan fijos para que la plataforma no se quede sin administración.</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {permissions.map((permission) => (
            <li key={permission.id} className="rounded-full bg-stone-100 px-2 py-1 text-xs">
              {permission.name}
            </li>
          ))}
        </ul>
      </Panel>
    );
  }

  return (
    <Panel>
      <form action={saveRolePermissions}>
        <input type="hidden" name="roleId" value={role.id} />
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold">{role.name}</h2>
            <p className="text-sm text-muted">{role.description || SCOPE_LABELS[role.scope]}</p>
          </div>
          <SubmitButton size="sm" pendingLabel="Guardando…">
            Guardar permisos
          </SubmitButton>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {permissions.map((permission) => (
            <li key={permission.id}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name="permissions"
                  value={permission.slug}
                  defaultChecked={role.permissionSlugs.includes(permission.slug)}
                  className="mt-1"
                />
                <span>
                  {permission.name}
                  <span className="mt-0.5 block text-xs text-muted">{permission.description}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </form>
    </Panel>
  );
}
