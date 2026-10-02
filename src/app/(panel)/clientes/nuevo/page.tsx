import type { Metadata } from "next";
import { ClientForm } from "@/components/forms/entity-forms";
import { AccessDenied } from "@/components/feedback";
import { PageHeader } from "@/components/ui/primitives";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nuevo cliente" };

export default async function NewClientPage() {
  const { access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.clientsWrite)) return <AccessDenied />;
  return (
    <>
      <PageHeader title="Nuevo cliente" description="La empresa queda aislada del resto de los clientes." />
      <ClientForm />
    </>
  );
}
