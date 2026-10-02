import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AddAccessForm, MembershipForm, ProfileForm } from "@/components/forms/user-forms";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { PageHeader } from "@/components/ui/primitives";
import { canAnyClient } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listProjects } from "@/lib/data/records";
import { getUser, listRoles } from "@/lib/data/people";
import { readParam } from "@/lib/params";

export const metadata: Metadata = { title: "Usuario" };

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, access } = await getSessionContext();
  if (!canAnyClient(access, PERMISSIONS.usersRead)) return <AccessDenied />;
  const user = await getUser(supabase, id);
  if (!user) notFound();
  const query = await searchParams;
  const canManage = canAnyClient(access, PERMISSIONS.usersManage);
  const [roles, projects] = canManage
    ? await Promise.all([listRoles(supabase), listProjects(supabase)])
    : [[], []];
  const visibleRoles = roles.filter((role) => access.isSuperAdmin || role.scope !== "platform");
  const clients = access.clients
    .filter((client) => client.permissions.includes(PERMISSIONS.usersManage))
    .map((client) => ({
      id: client.id,
      name: client.name,
      projects: projects.filter((project) => project.client_id === client.id).map((project) => ({ id: project.id, name: project.name })),
    }));

  return (
    <>
      <PageHeader title={user.fullName || user.email} description={user.email} />
      <QueryBanner error={readParam(query.error)} ok={readParam(query.ok)} />
      <div className="space-y-4">
        {canManage ? (
          <ProfileForm user={{ id: user.id, fullName: user.fullName, status: user.status }} isSuperAdmin={access.isSuperAdmin} />
        ) : null}
        <section className="space-y-3">
          <h2 className="text-base font-semibold">Accesos</h2>
          {user.memberships.length === 0 ? <p className="text-sm text-muted">Este usuario todavía no tiene accesos.</p> : null}
          {user.memberships.map((membership) =>
            canManage ? (
              <MembershipForm
                key={membership.id}
                membership={membership}
                roles={visibleRoles.filter((role) => role.scope !== "platform")}
                projects={projects
                  .filter((project) => project.client_id === membership.clientId)
                  .map((project) => ({ id: project.id, name: project.name }))}
              />
            ) : (
              <p key={membership.id} className="text-sm">
                {membership.roleName}
                {membership.projectName ? ` · ${membership.projectName}` : membership.clientName ? ` · ${membership.clientName}` : ""}
                {membership.active ? "" : " · inactivo"}
              </p>
            ),
          )}
        </section>
        {canManage ? (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Sumar acceso</h2>
            <AddAccessForm userId={user.id} roles={visibleRoles} clients={clients} />
          </section>
        ) : null}
      </div>
    </>
  );
}
