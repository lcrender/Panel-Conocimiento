import "server-only";
import { getProjectAiSetting } from "@/lib/data/openai-keys";
import { createClient } from "@/lib/supabase/server";
import { EMBEDDING_MODEL, SEMANTIC_MATCH_COUNT, similarityThreshold } from "@/modules/knowledge/document";
import { KNOWLEDGE_SYSTEM_PROMPT } from "@/modules/ai/prompt";
import type { ProjectAgentSettings } from "@/modules/ai/types";

const DEFAULT_ANSWER_MODEL = "gpt-4.1-mini";
const DEFAULT_TEMPERATURE = 0.1;

function readTemperature() {
  const value = Number(process.env.OPENAI_ANSWER_TEMPERATURE);
  if (!Number.isFinite(value) || value < 0 || value > 1) return DEFAULT_TEMPERATURE;
  return value;
}

function readMaxResults() {
  const value = Number(process.env.KNOWLEDGE_MAX_RESULTS);
  if (!Number.isInteger(value) || value < 1 || value > SEMANTIC_MATCH_COUNT) return SEMANTIC_MATCH_COUNT;
  return value;
}

export async function getProjectAgentSettings(projectId: string): Promise<ProjectAgentSettings> {
  const supabase = await createClient();
  const stored = await getProjectAiSetting(supabase, projectId);
  return {
    projectId,
    embeddingModel: EMBEDDING_MODEL,
    answerModel: process.env.OPENAI_ANSWER_MODEL?.trim() || DEFAULT_ANSWER_MODEL,
    temperature: readTemperature(),
    similarityThreshold: stored.similarityThreshold ?? similarityThreshold(),
    maxResults: readMaxResults(),
    systemPrompt: process.env.KNOWLEDGE_SYSTEM_PROMPT?.trim() || KNOWLEDGE_SYSTEM_PROMPT,
  };
}
