import type { Metadata } from "next";
import { UserCreateForm } from "@/components/forms/user-forms";
import { AccessDenied } from "@/components/feedback";
import { EmptyState, PageHeader } from "@/components/ui/primitives";
import { canAnyClient } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listProjects } from "@/lib/data/records";
import { listRoles } from "@/lib/data/people";

export const metadata: Metadata = { title: "Nuevo usuario" };

export default async function NewUserPage() {
  const { supabase, access } = await getSessionContext();
  if (!canAnyClient(access, PERMISSIONS.usersManage)) return <AccessDenied />;
  const [roles, projects] = await Promise.all([listRoles(supabase), listProjects(supabase)]);
  const clients = access.clients
    .filter((client) => client.permissions.includes(PERMISSIONS.usersManage))
    .map((client) => ({
      id: client.id,
      name: client.name,
      projects: projects.filter((project) => project.client_id === client.id).map((project) => ({ id: project.id, name: project.name })),
    }));
  const visibleRoles = roles.filter((role) => access.isSuperAdmin || role.scope !== "platform");

  if (!access.isSuperAdmin && clients.length === 0) {
    return <EmptyState title="No hay un cliente para asignar" body="Tu usuario no administra ningún cliente." />;
  }

  return (
    <>
      <PageHeader
        title="Nuevo usuario"
        description="Podés crear la cuenta con una contraseña o enviar una invitación. Si el email ya existe, se suma un acceso."
      />
      <UserCreateForm roles={visibleRoles} clients={clients} />
    </>
  );
}
