import type { Metadata } from "next";
import { RoleCreateForm, RolePermissionsForm } from "@/components/forms/role-form";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { PageHeader } from "@/components/ui/primitives";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listPermissions, listRoles } from "@/lib/data/people";
import { readParam } from "@/lib/params";

export const metadata: Metadata = { title: "Roles" };

export default async function RolesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.rolesManage)) return <AccessDenied />;
  const params = await searchParams;
  const [roles, permissions] = await Promise.all([listRoles(supabase), listPermissions(supabase)]);

  return (
    <>
      <PageHeader
        title="Roles"
        description="Los permisos salen del rol. Un editor puede recibir, además, permiso para crear categorías."
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok)} />
      <div className="space-y-4">
        <RoleCreateForm />
        {roles.map((role) => (
          <RolePermissionsForm key={role.id} role={role} permissions={permissions} />
        ))}
      </div>
    </>
  );
}
