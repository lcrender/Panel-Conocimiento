import type { Metadata } from "next";
import { unstable_rethrow } from "next/navigation";
import { AccessDenied, ProjectGate } from "@/components/feedback";
import { Badge, PageHeader, Panel, controlClass } from "@/components/ui/primitives";
import { canProject } from "@/domain/access";
import { PRIORITY_LABELS } from "@/domain/labels";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { readParam } from "@/lib/params";
import { similarityThreshold } from "@/modules/knowledge/document";
import { EmbeddingError, searchKnowledge } from "@/modules/knowledge/search";

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
  const threshold = similarityThreshold();
  let outcome = null;
  let searchError: string | null = null;
  if (query.trim().length >= 2) {
    try {
      outcome = await searchKnowledge({ projectId, clientId, query, canWrite });
    } catch (error) {
      unstable_rethrow(error);
      searchError = error instanceof EmbeddingError ? error.message : "No se pudo completar la búsqueda.";
    }
  }

  const hits = outcome?.hits ?? [];
  const thresholdLabel = threshold.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <>
      <PageHeader
        title="Probar conocimiento"
        description={`Escribí una consulta como la haría un huésped. La búsqueda semántica usa el proyecto ${projectName} y no redacta una respuesta.`}
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
      {outcome?.notice ? <p className="mt-6 text-sm text-muted">{outcome.notice}</p> : null}
      {outcome ? (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-muted">
            {hits.length === 0
              ? outcome.emptyMessage
              : hits.length === 1
                ? "1 coincidencia"
                : `${hits.length} coincidencias`}
          </p>
          {hits.map((result) => {
            const similarity = result.similarity ?? 0;
            return (
              <Panel key={result.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{result.title}</h2>
                    <p className="mt-1 text-sm text-muted">{result.categoryName ?? "Sin categoría"}</p>
                  </div>
                  <div className="text-right text-sm">
                    {result.similarity === null ? (
                      <p className="font-medium">{result.lexicalScore === null ? "Palabra clave" : `Puntaje ${result.lexicalScore}`}</p>
                    ) : (
                      <>
                        <p className="font-medium">
                          Similitud{" "}
                          {similarity.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <div className="mt-2 h-1.5 w-24 rounded bg-stone-200">
                          <div
                            className="h-1.5 rounded bg-accent"
                            style={{ width: `${Math.max(0, Math.min(100, Math.round(similarity * 100)))}%` }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{result.answer}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge tone={result.priority === "critical" ? "danger" : result.priority === "high" ? "warning" : "muted"}>
                    {PRIORITY_LABELS[result.priority]}
                  </Badge>
                  <Badge tone="muted">La IA puede reformular: {result.allowAiRewrite ? "Sí" : "No"}</Badge>
                  {result.matchedByKeyword ? <Badge tone="ok">Palabra clave</Badge> : null}
                </div>
              </Panel>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
