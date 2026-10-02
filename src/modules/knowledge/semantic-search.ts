import "server-only";
import { z } from "zod";
import type { DbClient } from "@/lib/supabase/server";
import { SEMANTIC_MATCH_COUNT, toVectorLiteral } from "@/modules/knowledge/document";
import { EmbeddingError, createEmbedding } from "@/modules/knowledge/openai";

const semanticRow = z.object({
  id: z.uuid(),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  priority: z.enum(["normal", "high", "critical"]),
  category_name: z.string().nullable(),
  allow_ai_rewrite: z.boolean(),
  similarity: z.coerce.number(),
});

export async function searchKnowledgeSemantic(
  supabase: DbClient,
  input: { projectId: string; clientId: string; query: string; apiKey: string },
) {
  const embedding = await createEmbedding(input.query.trim().slice(0, 500), input.apiKey);
  const { data, error } = await supabase.rpc("search_knowledge_semantic", {
    p_project_id: input.projectId,
    p_client_id: input.clientId,
    p_embedding: toVectorLiteral(embedding),
    p_match_count: SEMANTIC_MATCH_COUNT,
  });
  if (error) {
    if (error.code === "PGRST202" || error.message.includes("search_knowledge_semantic")) {
      throw new EmbeddingError("Falta aplicar la migración de búsqueda semántica en el SQL Editor.");
    }
    throw new EmbeddingError("No se pudo buscar en los embeddings.");
  }

  const rows = z.array(semanticRow).safeParse(data ?? []);
  if (!rows.success) {
    console.error(rows.error);
    throw new EmbeddingError("La búsqueda semántica devolvió un formato inesperado.");
  }

  return rows.data.map((row) => ({
    id: row.id,
    title: row.title,
    question: row.question,
    answer: row.answer,
    priority: row.priority,
    categoryName: row.category_name,
    allowAiRewrite: row.allow_ai_rewrite,
    similarity: row.similarity,
    lexicalScore: null,
    matchedByKeyword: false,
  }));
}
