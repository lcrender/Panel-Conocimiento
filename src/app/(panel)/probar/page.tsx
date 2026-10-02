import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { AccessDenied, ProjectGate } from "@/components/feedback";
import { KnowledgePlayground } from "@/components/knowledge-playground";
import { PageHeader, controlClass } from "@/components/ui/primitives";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { readParam } from "@/lib/params";
import { getProjectAgentSettings } from "@/modules/ai/settings";
import { EmbeddingError } from "@/modules/knowledge/search";
import { runKnowledgePlayground } from "@/modules/knowledge/playground";

export const metadata: Metadata = { title: "Probar conocimiento" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { project } = await getSessionContext();
  return (
    <ProjectGate project={project}>
      {project && canProject(project, PERMISSIONS.knowledgeRead) ? (
        <SearchContent
          projectId={project.id}
          clientId={project.clientId}
          projectName={project.name}
          canWrite={canProject(project, PERMISSIONS.knowledgeWrite)}
          searchParams={searchParams}
        />
      ) : (
        <AccessDenied />
      )}
    </ProjectGate>
  );
}

async function SearchContent({
  projectId,
  clientId,
  projectName,
  canWrite,
  searchParams,
}: {
  projectId: string;
  clientId: string;
  projectName: string;
  canWrite: boolean;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = readParam(params.q).slice(0, 200);
  const thresholdLabel = (await getProjectAgentSettings(projectId)).similarityThreshold.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  let outcome = null;
  let searchError: string | null = null;
  if (query.trim().length >= 2) {
    try {
      outcome = await runKnowledgePlayground({ projectId, clientId, query, canWrite });
    } catch (error) {
      unstable_rethrow(error);
      searchError = error instanceof EmbeddingError ? error.message : "No se pudo completar la búsqueda.";
    }
  }

  return (
    <>
      <PageHeader
        title="Probar conocimiento"
        description={`Escribí una consulta como la haría un cliente. El agente responde solo con el conocimiento activo de ${projectName}.`}
      />
      <form method="get" className="flex flex-col gap-3 sm:flex-row">
        <label className="sr-only" htmlFor="q">
          Consulta
        </label>
        <input
          id="q"
          name="q"
          defaultValue={query}
          placeholder="¿Aceptan tarjetas?"
          className={controlClass}
        />
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white">
          Buscar
        </button>
      </form>
      <p className="mt-3 text-xs text-muted">
        Compara el sentido de la consulta con el contenido activo de este proyecto. El umbral de similitud es{" "}
        {thresholdLabel}. Si una palabra de la consulta coincide con una palabra clave, el registro también aparece.
      </p>
      {query.trim().length > 0 && query.trim().length < 2 ? (
        <p className="mt-6 text-sm text-muted">Escribí al menos 2 caracteres.</p>
      ) : null}
      {searchError ? <p className="mt-6 text-sm text-danger">{searchError}</p> : null}
      {outcome?.search.notice ? <p className="mt-6 text-sm text-muted">{outcome.search.notice}</p> : null}
      {outcome ? (
        <KnowledgePlayground
          hits={outcome.search.hits}
          emptyMessage={outcome.search.emptyMessage}
          answer={outcome.answer}
          answerError={outcome.answerError}
          logSaved={outcome.logSaved}
        />
      ) : null}
    </>
  );
}
