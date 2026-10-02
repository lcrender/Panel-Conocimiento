import type { Metadata } from "next";
import { ActivityList } from "@/components/activity-list";
import { QueryBanner } from "@/components/feedback";
import { ButtonLink, EmptyState, PageHeader, Panel } from "@/components/ui/primitives";
import { canPlatform, canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { loadDashboard } from "@/lib/data/dashboard";
import { readParam } from "@/lib/params";

export const metadata: Metadata = { title: "Inicio" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, access, project } = await getSessionContext();
  const params = await searchParams;

  if (!project) {
    const canCreateClient = canPlatform(access, PERMISSIONS.clientsWrite);
    const canCreateProject = canPlatform(access, PERMISSIONS.projectsWrite);
    return (
      <>
        <PageHeader title="Inicio" description="El panel trabaja sobre el proyecto activo." />
        <EmptyState
          title="Todavía no hay un proyecto en tu acceso"
          body={
            canCreateClient
              ? "Creá el primer cliente y después su proyecto."
              : "Cuando un administrador te asigne un proyecto, vas a ver su conocimiento acá."
          }
          action={
            canCreateClient ? (
              <ButtonLink href="/clientes/nuevo">Crear cliente</ButtonLink>
            ) : canCreateProject ? (
              <ButtonLink href="/proyectos/nuevo">Crear proyecto</ButtonLink>
            ) : null
          }
        />
      </>
    );
  }

  const data = await loadDashboard(supabase, project.clientId, project.id);
  const canSeeActivity = canProject(project, PERMISSIONS.activityRead);

  return (
    <>
      <PageHeader
        title={project.name}
        description={`${project.clientName}. Los números y el contenido corresponden a este proyecto.`}
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok)} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Conocimiento" value={String(data.knowledgeActive)} detail={`${data.knowledgeTotal} en total`} />
        <Stat label="Categorías" value={String(data.categoriesActive)} detail={`${data.categoriesTotal} en total`} />
        <Stat label="Usuarios" value={String(data.users)} detail="Con acceso a este proyecto" />
        <Stat label="Cliente" value={project.clientName} detail={project.status === "active" ? "Proyecto activo" : "Proyecto inactivo"} />
      </div>
      {canSeeActivity ? (
        <div className="mt-6">
          <Panel>
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Actividad reciente</h2>
              <ButtonLink href="/actividad" variant="ghost" size="sm">
                Ver toda
              </ButtonLink>
            </div>
            <ActivityList items={data.activity} />
          </Panel>
        </div>
      ) : null}
    </>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-line">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 truncate text-2xl font-semibold">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
