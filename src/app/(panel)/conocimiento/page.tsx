import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, ProjectGate, QueryBanner } from "@/components/feedback";
import { Badge, ButtonLink, DataTable, PageHeader, StatusBadge, controlClass } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { canProject } from "@/domain/access";
import { PRIORITY_LABELS } from "@/domain/labels";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listCategories, listKnowledge } from "@/lib/data/records";
import { formatDate } from "@/lib/format";
import { readParam } from "@/lib/params";
import { duplicateKnowledge, setKnowledgeStatus } from "@/server/actions/knowledge";

export const metadata: Metadata = { title: "Conocimiento" };

const priorityTone = {
  normal: "muted",
  high: "warning",
  critical: "danger",
} as const;

export default async function KnowledgePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getSessionContext();
  return (
    <ProjectGate project={session.project}>
      {session.project && canProject(session.project, PERMISSIONS.knowledgeRead) ? (
        <KnowledgeContent session={session} searchParams={searchParams} />
      ) : (
        <AccessDenied />
      )}
    </ProjectGate>
  );
}

async function KnowledgeContent({
  session,
  searchParams,
}: {
  session: Awaited<ReturnType<typeof getSessionContext>>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const project = session.project;
  if (!project) return null;
  const params = await searchParams;
  const query = readParam(params.q);
  const categoryId = readParam(params.categoria);
  const status = readParam(params.estado) || "all";
  const [items, categories] = await Promise.all([
    listKnowledge(session.supabase, { projectId: project.id, query, categoryId, status }),
    listCategories(session.supabase, project.id),
  ]);
  const canWrite = canProject(project, PERMISSIONS.knowledgeWrite);

  return (
    <>
      <PageHeader
        title="Conocimiento"
        description={`Contenido que después va a usar el agente de ${project.name}.`}
        action={canWrite ? <ButtonLink href="/conocimiento/nuevo">Nuevo contenido</ButtonLink> : null}
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok)} />
      <form method="get" className="mb-4 grid gap-3 rounded-2xl bg-surface p-4 ring-1 ring-line md:grid-cols-[1fr_12rem_10rem_auto]">
        <input name="q" defaultValue={query} placeholder="Buscar por título, pregunta o respuesta" className={controlClass} />
        <select name="categoria" defaultValue={categoryId} className={controlClass}>
          <option value="">Todas las categorías</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select name="estado" defaultValue={status} className={controlClass}>
          <option value="all">Todos</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
        <button type="submit" className="rounded-lg bg-ink px-3 py-2 text-sm text-white">
          Filtrar
        </button>
      </form>
      <DataTable
        columns={["Título", "Categoría", "Pregunta", "Estado", "Prioridad", "Última modificación", ""]}
        empty="No hay contenido con esos filtros."
        rows={items.map((item) => ({
          id: item.id,
          cells: [
            <Link key="title" href={`/conocimiento/${item.id}`} className="font-medium hover:underline">
              {item.title}
            </Link>,
            item.categoryName ?? "Sin categoría",
            <span key="question" className="block max-w-xs truncate" title={item.question}>
              {item.question}
            </span>,
            <StatusBadge key="status" status={item.active} />,
            <Badge key="priority" tone={priorityTone[item.priority]}>
              {PRIORITY_LABELS[item.priority]}
            </Badge>,
            formatDate(item.updated_at),
            canWrite ? (
              <div key="actions" className="flex flex-wrap gap-2">
                <form action={duplicateKnowledge}>
                  <input type="hidden" name="id" value={item.id} />
                  <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                    Duplicar
                  </SubmitButton>
                </form>
                <form action={setKnowledgeStatus}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="active" value={item.active ? "false" : "true"} />
                  <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                    {item.active ? "Desactivar" : "Activar"}
                  </SubmitButton>
                </form>
              </div>
            ) : null,
          ],
        }))}
      />
    </>
  );
}
