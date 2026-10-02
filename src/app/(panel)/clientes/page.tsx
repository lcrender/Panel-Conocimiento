import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { DataTable, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { ButtonLink } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listClients } from "@/lib/data/records";
import { formatDate } from "@/lib/format";
import { readParam } from "@/lib/params";
import { setClientStatus } from "@/server/actions/clients";

export const metadata: Metadata = { title: "Clientes" };

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.clientsRead)) return <AccessDenied />;
  const params = await searchParams;
  const clients = await listClients(supabase);
  const canWrite = canPlatform(access, PERMISSIONS.clientsWrite);

  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cada cliente es una empresa y ve solo sus proyectos."
        action={canWrite ? <ButtonLink href="/clientes/nuevo">Nuevo cliente</ButtonLink> : null}
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok)} />
      <DataTable
        columns={["Nombre", "Estado", "Actualización", ""]}
        empty="Todavía no hay clientes."
        rows={clients.map((client) => ({
          id: client.id,
          cells: [
            <Link key="name" href={`/clientes/${client.id}`} className="font-medium hover:underline">
              {client.name}
            </Link>,
            <StatusBadge key="status" status={client.status} />,
            formatDate(client.updated_at),
            canWrite ? (
              <form key="status-form" action={setClientStatus}>
                <input type="hidden" name="id" value={client.id} />
                <input type="hidden" name="status" value={client.status === "active" ? "inactive" : "active"} />
                <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                  {client.status === "active" ? "Desactivar" : "Activar"}
                </SubmitButton>
              </form>
            ) : null,
          ],
        }))}
      />
    </>
  );
}
