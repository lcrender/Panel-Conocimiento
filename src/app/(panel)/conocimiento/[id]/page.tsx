import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { KnowledgeForm } from "@/components/forms/entity-forms";
import { AccessDenied, QueryBanner, WrongProject } from "@/components/feedback";
import { Badge, PageHeader, Panel, StatusBadge } from "@/components/ui/primitives";
import { canProject } from "@/domain/access";
import { PRIORITY_LABELS } from "@/domain/labels";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { getKnowledge, listCategories } from "@/lib/data/records";
import { formatKeywords } from "@/lib/format";
import { readParam } from "@/lib/params";

export const metadata: Metadata = { title: "Contenido" };

export default async function KnowledgeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, access, project } = await getSessionContext();
  const item = await getKnowledge(supabase, id);
  if (!item) notFound();
  const target = access.projects.find((entry) => entry.id === item.project_id);
  if (!target || !canProject(target, PERMISSIONS.knowledgeRead)) return <AccessDenied />;
  if (!project || project.id !== item.project_id) {
    return <WrongProject projectId={item.project_id} label={item.title} next={`/conocimiento/${item.id}`} />;
  }

  const query = await searchParams;
  const canWrite = canProject(project, PERMISSIONS.knowledgeWrite);
  const categories = canWrite ? await listCategories(supabase, project.id) : [];

  return (
    <>
      <PageHeader title={item.title} description={item.question} />
      <QueryBanner error={readParam(query.error)} ok={readParam(query.ok)} />
      {canWrite ? (
        <KnowledgeForm item={item} categories={categories} />
      ) : (
        <Panel className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={item.active} />
            <Badge tone={item.priority === "critical" ? "danger" : item.priority === "high" ? "warning" : "muted"}>
              {PRIORITY_LABELS[item.priority]}
            </Badge>
          </div>
          <p className="text-sm text-muted">{item.categoryName ?? "Sin categoría"}</p>
          <p className="whitespace-pre-wrap text-sm leading-6">{item.answer}</p>
          {item.keywords.length > 0 ? <p className="text-xs text-muted">{formatKeywords(item.keywords)}</p> : null}
        </Panel>
      )}
    </>
  );
}
