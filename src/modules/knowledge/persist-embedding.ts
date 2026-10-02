import "server-only";
import { z } from "zod";
import { toUserMessage } from "@/lib/errors";
import type { DbClient } from "@/lib/supabase/server";
import {
  EMBEDDING_MODEL,
  buildKnowledgeDocument,
  hashKnowledgeDocument,
  toVectorLiteral,
} from "@/modules/knowledge/document";
import { EmbeddingError, createEmbedding } from "@/modules/knowledge/openai";

const hashRow = z.object({ content_hash: z.string().nullable() });

export type EmbeddingSource = {
  id: string;
  clientId: string;
  projectId: string;
  title: string;
  question: string;
  answer: string;
  keywords: string[];
};

export async function syncKnowledgeEmbedding(supabase: DbClient, item: EmbeddingSource) {
  const document = buildKnowledgeDocument(item);
  const contentHash = hashKnowledgeDocument(document);

  const current = await supabase
    .from("knowledge_item_embeddings")
    .select("content_hash")
    .eq("knowledge_item_id", item.id)
    .eq("model", EMBEDDING_MODEL)
    .maybeSingle();
  if (current.error) throw new EmbeddingError(toUserMessage(current.error));
  const parsed = current.data ? hashRow.safeParse(current.data) : null;
  if (parsed?.success && parsed.data.content_hash === contentHash) return;

  const embedding = await createEmbedding(document);
  const saved = await supabase.from("knowledge_item_embeddings").upsert(
    {
      knowledge_item_id: item.id,
      client_id: item.clientId,
      project_id: item.projectId,
      embedding: toVectorLiteral(embedding),
      model: EMBEDDING_MODEL,
      content_hash: contentHash,
    },
    { onConflict: "knowledge_item_id,model" },
  );
  if (saved.error) throw new EmbeddingError(toUserMessage(saved.error));
}

const pendingItem = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  project_id: z.uuid(),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  keywords: z.array(z.string()),
});

const storedHash = z.object({
  knowledge_item_id: z.uuid(),
  content_hash: z.string().nullable(),
});

export async function backfillProjectEmbeddings(supabase: DbClient, projectId: string, clientId: string) {
  const itemsResult = await supabase
    .from("knowledge_items")
    .select("id, client_id, project_id, title, question, answer, keywords")
    .eq("project_id", projectId)
    .eq("client_id", clientId)
    .eq("active", true)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (itemsResult.error) throw new EmbeddingError(toUserMessage(itemsResult.error));

  const hashesResult = await supabase
    .from("knowledge_item_embeddings")
    .select("knowledge_item_id, content_hash")
    .eq("project_id", projectId)
    .eq("client_id", clientId)
    .eq("model", EMBEDDING_MODEL);
  if (hashesResult.error) throw new EmbeddingError(toUserMessage(hashesResult.error));

  const items = z.array(pendingItem).safeParse(itemsResult.data ?? []);
  const hashes = z.array(storedHash).safeParse(hashesResult.data ?? []);
  if (!items.success || !hashes.success) {
    throw new EmbeddingError("No se pudieron leer los contenidos para generar embeddings.");
  }

  const stored = new Map(hashes.data.map((row) => [row.knowledge_item_id, row.content_hash]));
  for (const item of items.data) {
    const document = buildKnowledgeDocument({
      title: item.title,
      question: item.question,
      answer: item.answer,
      keywords: item.keywords,
    });
    if (stored.get(item.id) === hashKnowledgeDocument(document)) continue;
    await syncKnowledgeEmbedding(supabase, {
      id: item.id,
      clientId: item.client_id,
      projectId: item.project_id,
      title: item.title,
      question: item.question,
      answer: item.answer,
      keywords: item.keywords,
    });
  }
}
