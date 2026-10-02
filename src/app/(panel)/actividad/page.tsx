import type { Metadata } from "next";
import { ActivityList } from "@/components/activity-list";
import { AccessDenied, ProjectGate } from "@/components/feedback";
import { PageHeader, Panel } from "@/components/ui/primitives";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listPlatformActivity, listProjectActivity } from "@/lib/data/activity";

export const metadata: Metadata = { title: "Actividad" };

export default async function ActivityPage() {
  const { supabase, access, project } = await getSessionContext();
  return (
    <ProjectGate project={project}>
      {project && canProject(project, PERMISSIONS.activityRead) ? (
        <ActivityContent
          supabase={supabase}
          clientId={project.clientId}
          projectId={project.id}
          projectName={project.name}
          includePlatform={access.isSuperAdmin}
        />
      ) : (
        <AccessDenied />
      )}
    </ProjectGate>
  );
}

async function ActivityContent({
  supabase,
  clientId,
  projectId,
  projectName,
  includePlatform,
}: {
  supabase: Awaited<ReturnType<typeof getSessionContext>>["supabase"];
  clientId: string;
  projectId: string;
  projectName: string;
  includePlatform: boolean;
}) {
  const [projectActivity, platformActivity] = await Promise.all([
    listProjectActivity(supabase, clientId, projectId, 100),
    includePlatform ? listPlatformActivity(supabase, 20) : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader title="Actividad" description={`Cambios registrados en ${projectName}.`} />
      <Panel>
        <ActivityList items={projectActivity} />
      </Panel>
      {includePlatform ? (
        <div className="mt-6">
          <h2 className="mb-3 text-base font-semibold">Actividad de la plataforma</h2>
          <Panel>
            <ActivityList items={platformActivity} empty="Todavía no hay actividad de la plataforma." />
          </Panel>
        </div>
      ) : null}
    </>
  );
}
