import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { ButtonLink, DataTable, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { canAnyClient } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listUsers } from "@/lib/data/people";
import { readParam } from "@/lib/params";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, access } = await getSessionContext();
  if (!canAnyClient(access, PERMISSIONS.usersRead)) return <AccessDenied />;
  const params = await searchParams;
  const users = await listUsers(supabase);
  const canManage = canAnyClient(access, PERMISSIONS.usersManage);

  return (
    <>
      <PageHeader
        title="Usuarios"
        description="Una persona puede participar en varios proyectos, con un rol en cada acceso."
        action={canManage ? <ButtonLink href="/usuarios/nuevo">Nuevo usuario</ButtonLink> : null}
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok)} />
      <DataTable
        columns={["Nombre", "Email", "Accesos", "Estado"]}
        empty="Todavía no hay usuarios en tu alcance."
        rows={users.map((user) => ({
          id: user.id,
          cells: [
            <Link key="name" href={`/usuarios/${user.id}`} className="font-medium hover:underline">
              {user.fullName || user.email}
            </Link>,
            user.email,
            <span key="access" className="block max-w-md text-muted">
              {user.memberships.length === 0
                ? "Sin accesos"
                : user.memberships
                    .slice(0, 3)
                    .map((membership) =>
                      [membership.roleName, membership.projectName ?? membership.clientName ?? "Plataforma"]
                        .filter(Boolean)
                        .join(" · "),
                    )
                    .join(" / ")}
              {user.memberships.length > 3 ? ` +${user.memberships.length - 3}` : ""}
            </span>,
            <StatusBadge key="status" status={user.status} />,
          ],
        }))}
      />
    </>
  );
}
