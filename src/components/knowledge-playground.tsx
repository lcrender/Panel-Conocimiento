import { Badge, Panel } from "@/components/ui/primitives";
import { PRIORITY_LABELS } from "@/domain/labels";
import type { GeneratedAnswer } from "@/modules/ai/types";
import type { KnowledgeSearchHit } from "@/modules/knowledge/types";

const STATUS_LABELS = {
  answered: "Respondida",
  no_answer: "Sin respuesta",
  clarification_needed: "Necesita aclaración",
  conflicting_information: "Información contradictoria",
} as const;

const CONFIDENCE_LABELS = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
} as const;

function formatSimilarity(value: number) {
  return value.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function KnowledgePlayground({
  hits,
  emptyMessage,
  answer,
  answerError,
  logSaved,
}: {
  hits: KnowledgeSearchHit[];
  emptyMessage: string | null;
  answer: GeneratedAnswer | null;
  answerError: string | null;
  logSaved: boolean;
}) {
  const used = new Set(answer?.usedKnowledgeIds ?? []);
  const conflicting = new Set(answer?.conflictingKnowledgeIds ?? []);

  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
      <section>
        <h2 className="text-sm font-semibold">Conocimiento recuperado</h2>
        <p className="mt-1 text-sm text-muted">
          {hits.length === 0 ? emptyMessage : hits.length === 1 ? "1 coincidencia" : `${hits.length} coincidencias`}
        </p>
        <div className="mt-3 space-y-3">
          {hits.map((result) => {
            const similarity = result.similarity ?? 0;
            const role = conflicting.has(result.id) ? "En conflicto" : used.has(result.id) ? "Usado por el agente" : null;
            return (
              <Panel key={result.id} className={conflicting.has(result.id) ? "ring-red-300" : used.has(result.id) ? "ring-accent" : ""}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{result.title}</h3>
                    <p className="mt-1 text-sm text-muted">{result.categoryName ?? "Sin categoría"}</p>
                  </div>
                  <div className="text-right text-sm">
                    {result.similarity === null ? (
                      <p className="font-medium">{result.lexicalScore === null ? "Palabra clave" : `Puntaje ${result.lexicalScore}`}</p>
                    ) : (
                      <>
                        <p className="font-medium">Similitud {formatSimilarity(similarity)}</p>
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
                  {role ? <Badge tone={conflicting.has(result.id) ? "danger" : "ok"}>{role}</Badge> : null}
                </div>
              </Panel>
            );
          })}
        </div>
      </section>
      <section>
        <h2 className="text-sm font-semibold">Respuesta del agente</h2>
        <div className="mt-3">
          {answerError ? <p className="text-sm text-danger">{answerError}</p> : null}
          {answer ? <AgentAnswer answer={answer} hits={hits} logSaved={logSaved} /> : null}
          {!answer && !answerError ? (
            <p className="text-sm text-muted">La respuesta se genera cuando la búsqueda semántica está disponible.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function AgentAnswer({
  answer,
  hits,
  logSaved,
}: {
  answer: GeneratedAnswer;
  hits: KnowledgeSearchHit[];
  logSaved: boolean;
}) {
  const conflicting = hits.filter((hit) => answer.conflictingKnowledgeIds.includes(hit.id));
  const used = hits.filter((hit) => answer.usedKnowledgeIds.includes(hit.id));
  const listed = answer.status === "conflicting_information" ? conflicting : used;

  return (
    <Panel>
      <div className="flex flex-wrap gap-2">
        <Badge tone={answer.status === "answered" ? "ok" : answer.status === "conflicting_information" ? "danger" : "warning"}>
          {STATUS_LABELS[answer.status]}
        </Badge>
        <Badge tone="muted">Confianza {CONFIDENCE_LABELS[answer.confidence]}</Badge>
      </div>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-6">{answer.answer}</p>
      {answer.status === "no_answer" ? (
        <p className="mt-3 text-sm font-medium">El agente no debería responder automáticamente.</p>
      ) : null}
      {answer.status === "clarification_needed" ? (
        <p className="mt-3 text-sm text-muted">Esta es la pregunta que el agente haría para aclarar.</p>
      ) : null}
      {listed.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-medium text-muted">
            {answer.status === "conflicting_information" ? "Contenidos en conflicto" : "Conocimiento utilizado"}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {listed.map((hit) => (
              <li key={hit.id}>{hit.title}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="mt-4 text-xs text-muted">
        {answer.model ? `Modelo ${answer.model}` : "No se consultó al modelo."}
        {answer.model ? ` · ${(answer.durationMs / 1000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} s` : ""}
      </p>
      {logSaved ? null : <p className="mt-2 text-xs text-muted">No se guardó el registro de esta prueba.</p>}
    </Panel>
  );
}
