import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ProjectForm } from "@/components/forms/entity-forms";
import { ProjectOpenAIKeyForm, ProjectSimilarityForm } from "@/components/forms/openai-key-form";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { PageHeader, Panel, StatusBadge } from "@/components/ui/primitives";
import { canAnyClient, canClient, canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { getProjectAiSetting, listOpenAIKeys } from "@/lib/data/openai-keys";
import { getProject } from "@/lib/data/records";
import { readParam } from "@/lib/params";
import { similarityThreshold } from "@/modules/knowledge/document";

export const metadata: Metadata = { title: "Proyecto" };

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, access } = await getSessionContext();
  if (!canAnyClient(access, PERMISSIONS.projectsRead) && !canPlatform(access, PERMISSIONS.projectsRead)) {
    return <AccessDenied />;
  }
  const project = await getProject(supabase, id);
  if (!project) notFound();
  const query = await searchParams;
  const canWrite = canPlatform(access, PERMISSIONS.projectsWrite);
  const canChooseKey = canClient(access, project.client_id, PERMISSIONS.integrationsManage);
  const keys = canChooseKey ? await listOpenAIKeys(supabase, project.client_id) : [];
  const aiSetting = canChooseKey ? await getProjectAiSetting(supabase, project.id) : null;

  return (
    <>
      <PageHeader title={project.name} description={project.clientName ?? "Proyecto"} />
      <QueryBanner error={readParam(query.error)} ok={readParam(query.ok)} />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        {canWrite ? (
          <ProjectForm project={project} clients={access.clients.map((client) => ({ id: client.id, name: client.name }))} />
        ) : (
          <Panel>
            <StatusBadge status={project.status} />
            <p className="mt-3 text-sm leading-6">{project.description || "Sin descripción."}</p>
          </Panel>
        )}
        {canChooseKey && aiSetting ? (
          <div className="space-y-6">
            <ProjectOpenAIKeyForm
              projectId={project.id}
              clientId={project.client_id}
              selectedId={aiSetting.keyId}
              keys={keys.map((key) => ({ id: key.id, name: key.name, keyHint: key.key_hint }))}
            />
            <ProjectSimilarityForm
              projectId={project.id}
              clientId={project.client_id}
              threshold={aiSetting.similarityThreshold ?? similarityThreshold()}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
