import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ClientForm } from "@/components/forms/entity-forms";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { PageHeader, Panel, StatusBadge } from "@/components/ui/primitives";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { getClient } from "@/lib/data/records";
import { readParam } from "@/lib/params";

export const metadata: Metadata = { title: "Cliente" };

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.clientsRead)) return <AccessDenied />;
  const client = await getClient(supabase, id);
  if (!client) notFound();
  const query = await searchParams;
  const canWrite = canPlatform(access, PERMISSIONS.clientsWrite);

  return (
    <>
      <PageHeader title={client.name} description="Datos del cliente." />
      <QueryBanner error={readParam(query.error)} ok={readParam(query.ok)} />
      {canWrite ? (
        <ClientForm client={client} />
      ) : (
        <Panel>
          <StatusBadge status={client.status} />
          <p className="mt-3 text-sm">{client.name}</p>
        </Panel>
      )}
    </>
  );
}
