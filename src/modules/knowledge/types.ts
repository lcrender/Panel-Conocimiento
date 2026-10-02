export type KnowledgePriority = "normal" | "high" | "critical";

export type KnowledgeSearchHit = {
  id: string;
  title: string;
  question: string;
  answer: string;
  priority: KnowledgePriority;
  categoryName: string | null;
  allowAiRewrite: boolean;
  similarity: number | null;
  lexicalScore: number | null;
  matchedByKeyword: boolean;
};

export type KnowledgeSearchOutcome = {
  mode: "semantic" | "lexical";
  hits: KnowledgeSearchHit[];
  notice: string | null;
  emptyMessage: string | null;
};

export const NO_RELATED_KNOWLEDGE = "No se encontró información suficientemente relacionada.";
