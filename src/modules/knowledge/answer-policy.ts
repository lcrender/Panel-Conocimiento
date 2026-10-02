import type { AnswerSource, GeneratedAnswer, RawModelAnswer } from "@/modules/ai/types";

export const NO_ANSWER_TEXT =
  "No encontré información suficiente en la base de conocimiento para responder esta consulta.";

const CONFLICT_TEXT = "Hay información contradictoria en la base de conocimiento. No elijo una versión.";

function knownIds(ids: string[], sources: AnswerSource[]) {
  const allowed = new Set(sources.map((source) => source.id));
  return [...new Set(ids.filter((id) => allowed.has(id)))];
}

function compact(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function finalizeAnswer(raw: RawModelAnswer, sources: AnswerSource[]): Omit<GeneratedAnswer, "model" | "durationMs"> {
  const used = knownIds(raw.usedKnowledgeIds, sources);
  const conflicting = knownIds(raw.conflictingKnowledgeIds, sources);
  let status = raw.status;
  let answer = raw.answer.trim();
  let confidence = raw.confidence;

  if (status === "answered" && used.length === 0) {
    status = "no_answer";
    confidence = "low";
  }
  if (status === "conflicting_information" && conflicting.length < 2) {
    status = "no_answer";
    confidence = "low";
  }
  if (status === "clarification_needed" && !answer) {
    status = "no_answer";
    confidence = "low";
  }

  if (status === "no_answer") {
    return {
      status,
      answer: NO_ANSWER_TEXT,
      usedKnowledgeIds: [],
      conflictingKnowledgeIds: [],
      confidence: "low",
    };
  }

  if (status === "conflicting_information") {
    return {
      status,
      answer: answer || CONFLICT_TEXT,
      usedKnowledgeIds: conflicting,
      conflictingKnowledgeIds: conflicting,
      confidence,
    };
  }

  if (status === "clarification_needed") {
    return {
      status,
      answer,
      usedKnowledgeIds: used,
      conflictingKnowledgeIds: [],
      confidence,
    };
  }

  const usedItems = used
    .map((id) => sources.find((source) => source.id === id))
    .filter((source): source is AnswerSource => Boolean(source));
  const locked = usedItems.filter((source) => !source.allowAiRewrite);
  if (locked.length === usedItems.length) {
    answer = locked.map((source) => source.answer.trim()).join("\n\n");
  } else if (locked.length > 0) {
    const exact = locked.map((source) => source.answer.trim());
    const modelHasExact = exact.every((text) => compact(answer).includes(compact(text)));
    if (!modelHasExact) answer = [...exact, answer].filter(Boolean).join("\n\n");
  }

  return {
    status: "answered",
    answer,
    usedKnowledgeIds: used,
    conflictingKnowledgeIds: [],
    confidence,
  };
}

export function buildAnswerContext(question: string, sources: AnswerSource[]) {
  const blocks = sources.map((source, index) =>
    [
      `Fuente ${index + 1}`,
      `id: ${source.id}`,
      `título: ${source.title}`,
      `categoría: ${source.categoryName ?? "Sin categoría"}`,
      `pregunta: ${source.question}`,
      `respuesta: ${source.answer}`,
      `palabras clave: ${source.keywords.join(", ")}`,
      `prioridad: ${source.priority}`,
      `allow_ai_rewrite: ${source.allowAiRewrite ? "true" : "false"}`,
      `similitud: ${source.similarity ?? "no disponible"}`,
    ].join("\n"),
  );

  return `Consulta del usuario:\n${question.trim()}\n\nContexto recuperado, únicamente de este proyecto:\n${blocks.join("\n\n")}`;
}
