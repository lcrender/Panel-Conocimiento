"use client";

import { useActionState, useState } from "react";
import type { RoleRecord } from "@/lib/data/people";
import { initialActionState } from "@/lib/form";
import { addUserAccess, createUserAccess, saveMembership, updateProfile } from "@/server/actions/users";
import { Alert, controlClass, Field, Panel } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";

type ClientOption = { id: string; name: string; projects: { id: string; name: string }[] };

export function UserCreateForm({ roles, clients }: { roles: RoleRecord[]; clients: ClientOption[] }) {
  const [state, action] = useActionState(createUserAccess, initialActionState);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const role = roles.find((item) => item.id === roleId);
  const client = clients.find((item) => item.id === clientId);
  const showCategory =
    role?.allowsPermissionOverrides && !role.permissionSlugs.includes("categories.write");

  return (
    <Panel>
      <form action={action} className="space-y-4">
        {state.error ? (
          <Alert>{state.error}</Alert>
        ) : null}
        <Field label="Nombre">
          <input name="fullName" required minLength={2} maxLength={120} className={controlClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" required className={controlClass} />
        </Field>
        <Field label="Contraseña inicial" hint="Mínimo 8 caracteres. Se usa cuando el usuario entra directo, sin email.">
          <input name="password" type="password" minLength={8} autoComplete="new-password" className={controlClass} />
        </Field>
        <div>
          <input type="hidden" name="sendInvite" value="false" />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="sendInvite" value="true" className="mt-1" />
            <span>
              Enviar invitación por email
              <span className="mt-1 block text-xs leading-5 text-muted">
                Requiere el correo saliente de Supabase. En ese caso la contraseña inicial no se usa.
              </span>
            </span>
          </label>
        </div>
        <Field label="Rol">
          <select name="roleId" value={roleId} onChange={(event) => setRoleId(event.target.value)} className={controlClass}>
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        {role && role.scope !== "platform" ? (
          <Field label="Cliente">
            <select name="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)} className={controlClass}>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {role?.scope === "project" ? (
          <fieldset key={clientId}>
            <legend className="text-sm font-medium">Proyectos</legend>
            <div className="mt-2 space-y-2">
              {(client?.projects ?? []).map((project) => (
                <label key={project.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="projectIds" value={project.id} />
                  {project.name}
                </label>
              ))}
              {(client?.projects.length ?? 0) === 0 ? (
                <p className="text-sm text-muted">Este cliente todavía no tiene proyectos.</p>
              ) : null}
            </div>
          </fieldset>
        ) : null}
        {role?.scope === "client" ? (
          <p className="text-sm text-muted">Este rol cubre todos los proyectos del cliente.</p>
        ) : null}
        {showCategory ? (
          <div>
            <input type="hidden" name="grantCategories" value="false" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="grantCategories" value="true" />
              Puede crear y editar categorías
            </label>
          </div>
        ) : null}
        <SubmitButton>Crear usuario</SubmitButton>
      </form>
    </Panel>
  );
}

export function ProfileForm({
  user,
  isSuperAdmin,
}: {
  user: { id: string; fullName: string; status: "active" | "inactive" };
  isSuperAdmin: boolean;
}) {
  const [state, action] = useActionState(updateProfile, initialActionState);
  return (
    <Panel>
      <form action={action} className="space-y-4">
        {state.error ? <Alert>{state.error}</Alert> : null}
        <input type="hidden" name="id" value={user.id} />
        <Field label="Nombre">
          <input name="fullName" required minLength={2} defaultValue={user.fullName} className={controlClass} />
        </Field>
        {isSuperAdmin ? (
          <Field label="Estado global">
            <select name="status" defaultValue={user.status} className={controlClass}>
              <option value="active">Activo</option>
              <option value="inactive">Inactivo</option>
            </select>
          </Field>
        ) : null}
        <SubmitButton>Guardar usuario</SubmitButton>
      </form>
    </Panel>
  );
}

export function MembershipForm({
  membership,
  roles,
  projects,
}: {
  membership: {
    id: string;
    scope: "platform" | "client" | "project";
    roleId: string;
    projectId: string | null;
    active: boolean;
    grantCategories: boolean;
    clientName: string | null;
    roleName: string;
  };
  roles: RoleRecord[];
  projects: { id: string; name: string }[];
}) {
  const [state, action] = useActionState(saveMembership, initialActionState);
  const [roleId, setRoleId] = useState(membership.roleId);
  const role = roles.find((item) => item.id === roleId) ?? roles[0];
  const showCategory = role?.allowsPermissionOverrides && !role.permissionSlugs.includes("categories.write");

  if (membership.scope === "platform") {
    return (
      <Panel>
        <form action={action} className="space-y-3">
          {state.error ? <Alert>{state.error}</Alert> : null}
          <input type="hidden" name="id" value={membership.id} />
          <p className="text-sm font-medium">{membership.roleName}</p>
          <p className="text-sm text-muted">Acceso de plataforma. Cubre todos los clientes.</p>
          <input type="hidden" name="active" value="false" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" value="true" defaultChecked={membership.active} />
            Activo
          </label>
          <SubmitButton size="sm">Guardar acceso</SubmitButton>
        </form>
      </Panel>
    );
  }

  return (
    <Panel>
      <form action={action} className="space-y-4">
        {state.error ? <Alert>{state.error}</Alert> : null}
        <input type="hidden" name="id" value={membership.id} />
        <p className="text-sm text-muted">{membership.clientName}</p>
        <Field label="Rol">
          <select name="roleId" value={roleId} onChange={(event) => setRoleId(event.target.value)} className={controlClass}>
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        {role?.scope === "project" ? (
          <Field label="Proyecto">
            <select name="projectId" defaultValue={membership.projectId ?? projects[0]?.id} className={controlClass}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <p className="text-sm text-muted">Este rol cubre todos los proyectos del cliente.</p>
        )}
        {showCategory ? (
          <div>
            <input type="hidden" name="grantCategories" value="false" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="grantCategories" value="true" defaultChecked={membership.grantCategories} />
              Puede crear y editar categorías
            </label>
          </div>
        ) : null}
        <input type="hidden" name="active" value="false" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="active" value="true" defaultChecked={membership.active} />
          Activo
        </label>
        <SubmitButton size="sm">Guardar acceso</SubmitButton>
      </form>
    </Panel>
  );
}

export function AddAccessForm({
  userId,
  roles,
  clients,
}: {
  userId: string;
  roles: RoleRecord[];
  clients: ClientOption[];
}) {
  const [state, action] = useActionState(addUserAccess, initialActionState);
  const [roleId, setRoleId] = useState(roles[0]?.id ?? "");
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const role = roles.find((item) => item.id === roleId);
  const client = clients.find((item) => item.id === clientId);
  const showCategory = role?.allowsPermissionOverrides && !role.permissionSlugs.includes("categories.write");

  return (
    <Panel>
      <form action={action} className="space-y-4">
        {state.error ? <Alert>{state.error}</Alert> : null}
        <input type="hidden" name="userId" value={userId} />
        <Field label="Rol">
          <select name="roleId" value={roleId} onChange={(event) => setRoleId(event.target.value)} className={controlClass}>
            {roles.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        {role && role.scope !== "platform" ? (
          <Field label="Cliente">
            <select name="clientId" value={clientId} onChange={(event) => setClientId(event.target.value)} className={controlClass}>
              {clients.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        {role?.scope === "project" ? (
          <fieldset key={clientId}>
            <legend className="text-sm font-medium">Proyectos</legend>
            <div className="mt-2 space-y-2">
              {(client?.projects ?? []).map((project) => (
                <label key={project.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="projectIds" value={project.id} />
                  {project.name}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}
        {showCategory ? (
          <div>
            <input type="hidden" name="grantCategories" value="false" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="grantCategories" value="true" />
              Puede crear y editar categorías
            </label>
          </div>
        ) : null}
        <SubmitButton>Sumar acceso</SubmitButton>
      </form>
    </Panel>
  );
}
