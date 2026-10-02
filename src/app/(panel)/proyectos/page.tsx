import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { ButtonLink, DataTable, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { canAnyClient, canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listProjects } from "@/lib/data/records";
import { formatDate } from "@/lib/format";
import { readParam } from "@/lib/params";
import { setProjectStatus } from "@/server/actions/projects";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, access } = await getSessionContext();
  if (!canAnyClient(access, PERMISSIONS.projectsRead) && !canPlatform(access, PERMISSIONS.projectsRead)) {
    return <AccessDenied />;
  }
  const params = await searchParams;
  const projects = await listProjects(supabase);
  const canWrite = canPlatform(access, PERMISSIONS.projectsWrite);

  return (
    <>
      <PageHeader
        title="Proyectos"
        description="Un cliente puede tener varios proyectos. Cada uno tendrá su conocimiento y, más adelante, su WhatsApp."
        action={canWrite ? <ButtonLink href="/proyectos/nuevo">Nuevo proyecto</ButtonLink> : null}
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok)} />
      <DataTable
        columns={["Proyecto", "Cliente", "Estado", "Actualización", ""]}
        empty="Todavía no hay proyectos en tu acceso."
        rows={projects.map((project) => ({
          id: project.id,
          cells: [
            <Link key="name" href={`/proyectos/${project.id}`} className="font-medium hover:underline">
              {project.name}
            </Link>,
            project.clientName ?? "—",
            <StatusBadge key="status" status={project.status} />,
            formatDate(project.updated_at),
            canWrite ? (
              <form key="form" action={setProjectStatus}>
                <input type="hidden" name="id" value={project.id} />
                <input type="hidden" name="status" value={project.status === "active" ? "inactive" : "active"} />
                <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                  {project.status === "active" ? "Desactivar" : "Activar"}
                </SubmitButton>
              </form>
            ) : null,
          ],
        }))}
      />
    </>
  );
}
