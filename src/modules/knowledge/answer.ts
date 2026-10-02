import "server-only";
import { AnswerError, getAIProvider } from "@/modules/ai/openai-provider";
import { getProjectAgentSettings } from "@/modules/ai/settings";
import { readProjectOpenAIKey } from "@/lib/openai/project-key";
import { createClient } from "@/lib/supabase/server";
import type { GeneratedAnswer } from "@/modules/ai/types";
import { buildAnswerContext, finalizeAnswer } from "@/modules/knowledge/answer-policy";
import type { KnowledgeSearchHit } from "@/modules/knowledge/types";

export async function generateAnswer(input: {
  projectId: string;
  clientId: string;
  question: string;
  hits: KnowledgeSearchHit[];
}): Promise<GeneratedAnswer> {
  const sources = input.hits.map((hit) => ({
    id: hit.id,
    title: hit.title,
    question: hit.question,
    answer: hit.answer,
    categoryName: hit.categoryName,
    priority: hit.priority,
    allowAiRewrite: hit.allowAiRewrite,
    similarity: hit.similarity,
    keywords: hit.keywords,
  }));

  if (sources.length === 0) {
    return {
      ...finalizeAnswer(
        {
          status: "no_answer",
          answer: "",
          usedKnowledgeIds: [],
          conflictingKnowledgeIds: [],
          confidence: "low",
        },
        [],
      ),
      model: null,
      durationMs: 0,
    };
  }

  const settings = await getProjectAgentSettings(input.projectId);
  const supabase = await createClient();
  const apiKey = await readProjectOpenAIKey(supabase, input.projectId, input.clientId);
  if (!apiKey) {
    throw new AnswerError("Este proyecto no tiene una clave de OpenAI seleccionada.");
  }
  const started = Date.now();
  const raw = await getAIProvider().generateAnswer({
    apiKey,
    systemPrompt: settings.systemPrompt,
    userMessage: buildAnswerContext(input.question, sources),
    model: settings.answerModel,
    temperature: settings.temperature,
  });

  return {
    ...finalizeAnswer(raw, sources),
    model: settings.answerModel,
    durationMs: Date.now() - started,
  };
}
