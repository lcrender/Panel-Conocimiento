import "server-only";
import { z } from "zod";
import { failQuery } from "@/lib/data/common";
import { createClient } from "@/lib/supabase/server";
import type { KnowledgeSearchHit } from "@/modules/knowledge/types";

const hitRow = z.object({
  id: z.uuid(),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  priority: z.enum(["normal", "high", "critical"]),
  category_name: z.string().nullable(),
  score: z.coerce.number(),
  allow_ai_rewrite: z.boolean().optional().default(false),
});

export async function searchKnowledgeLexical(projectId: string, query: string): Promise<KnowledgeSearchHit[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_knowledge", {
    p_project_id: projectId,
    p_query: query,
  });
  if (error) failQuery(error);
  const rows = z.array(hitRow).safeParse(data ?? []);
  if (!rows.success) {
    console.error(rows.error);
    failQuery({ message: "search_knowledge devolvió un formato inesperado" });
  }
  return rows.data.map((row) => ({
    id: row.id,
    title: row.title,
    question: row.question,
    answer: row.answer,
    priority: row.priority,
    categoryName: row.category_name,
    allowAiRewrite: row.allow_ai_rewrite,
    keywords: [],
    similarity: null,
    lexicalScore: row.score,
    matchedByKeyword: false,
  }));
}
