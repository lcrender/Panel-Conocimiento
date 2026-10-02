import "server-only";
import { z } from "zod";
import { embedName } from "@/lib/data/common";
import { searchKnowledgeLexical } from "@/lib/data/search";
import { createClient, type DbClient } from "@/lib/supabase/server";
import { getProjectAgentSettings } from "@/modules/ai/settings";
import { matchesKeyword, selectKnowledgeMatches } from "@/modules/knowledge/document";
import { readProjectOpenAIKey } from "@/lib/openai/project-key";
import { EmbeddingError } from "@/modules/knowledge/openai";
import { backfillProjectEmbeddings } from "@/modules/knowledge/persist-embedding";
import { searchKnowledgeSemantic } from "@/modules/knowledge/semantic-search";
import { NO_RELATED_KNOWLEDGE, type KnowledgeSearchHit, type KnowledgeSearchOutcome } from "@/modules/knowledge/types";

const LEXICAL_NOTICE = "Este proyecto no tiene una clave de OpenAI seleccionada. Esta consulta usó la búsqueda por palabras.";

export async function searchKnowledge(input: {
  projectId: string;
  clientId: string;
  query: string;
  canWrite: boolean;
}): Promise<KnowledgeSearchOutcome> {
  const query = input.query.trim();
  const supabase = await createClient();
  const apiKey = await readProjectOpenAIKey(supabase, input.projectId, input.clientId);
  if (!apiKey) {
    const hits = await searchKnowledgeLexical(input.projectId, query);
    return {
      mode: "lexical",
      hits,
      notice: LEXICAL_NOTICE,
      emptyMessage: hits.length === 0 ? "No hay coincidencias en el proyecto activo." : null,
    };
  }

  if (input.canWrite) {
    await backfillProjectEmbeddings(supabase, input.projectId, input.clientId, apiKey);
  }

  const settings = await getProjectAgentSettings(input.projectId);
  const hits = await rankSemanticHits(supabase, {
    projectId: input.projectId,
    clientId: input.clientId,
    query,
    apiKey,
    threshold: settings.similarityThreshold,
    limit: settings.maxResults,
  });

  return {
    mode: "semantic",
    hits,
    notice: null,
    emptyMessage: hits.length === 0 ? NO_RELATED_KNOWLEDGE : null,
  };
}

const activeItem = z.object({
  id: z.uuid(),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  keywords: z.array(z.string()),
  priority: z.enum(["normal", "high", "critical"]),
  allow_ai_rewrite: z.boolean(),
  categories: z.unknown().optional(),
});

async function rankSemanticHits(
  supabase: DbClient,
  input: { projectId: string; clientId: string; query: string; apiKey: string; threshold: number; limit: number },
): Promise<KnowledgeSearchHit[]> {
  const [semantic, listed] = await Promise.all([
    searchKnowledgeSemantic(supabase, {
      projectId: input.projectId,
      clientId: input.clientId,
      query: input.query,
      apiKey: input.apiKey,
    }),
    supabase
      .from("knowledge_items")
      .select("id, title, question, answer, keywords, priority, allow_ai_rewrite, categories(name)")
      .eq("project_id", input.projectId)
      .eq("client_id", input.clientId)
      .eq("active", true)
      .limit(200),
  ]);
  if (listed.error) throw new EmbeddingError("No se pudieron leer las palabras clave del proyecto.");

  const items = z.array(activeItem).safeParse(listed.data ?? []);
  if (!items.success) throw new EmbeddingError("No se pudieron leer las palabras clave del proyecto.");

  const similarityById = new Map(semantic.map((hit) => [hit.id, hit.similarity]));
  const merged = items.data.map((item) => ({
    id: item.id,
    title: item.title,
    question: item.question,
    answer: item.answer,
    priority: item.priority,
    categoryName: embedName(item.categories),
    allowAiRewrite: item.allow_ai_rewrite,
    similarity: similarityById.get(item.id) ?? null,
    keywords: item.keywords,
  }));

  return selectKnowledgeMatches(merged, input.query, input.threshold, input.limit).map((hit) => ({
    id: hit.id,
    title: hit.title,
    question: hit.question,
    answer: hit.answer,
    priority: hit.priority,
    categoryName: hit.categoryName,
    allowAiRewrite: hit.allowAiRewrite,
    keywords: hit.keywords,
    similarity: hit.similarity,
    lexicalScore: null,
    matchedByKeyword: matchesKeyword(input.query, hit.keywords),
  }));
}

export { EmbeddingError };
