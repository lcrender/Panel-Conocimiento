import type { Metadata } from "next";
import { ProjectForm } from "@/components/forms/entity-forms";
import { AccessDenied } from "@/components/feedback";
import { PageHeader } from "@/components/ui/primitives";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default async function NewProjectPage() {
  const { access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.projectsWrite)) return <AccessDenied />;
  if (access.clients.length === 0) {
    return (
      <PageHeader
        title="Nuevo proyecto"
        description="Primero creá un cliente. El proyecto siempre pertenece a una empresa."
      />
    );
  }
  return (
    <>
      <PageHeader title="Nuevo proyecto" description="El proyecto hereda el aislamiento del cliente." />
      <ProjectForm clients={access.clients.map((client) => ({ id: client.id, name: client.name }))} />
    </>
  );
}
