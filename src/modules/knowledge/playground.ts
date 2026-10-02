import "server-only";
import { AnswerError } from "@/modules/ai/openai-provider";
import type { GeneratedAnswer } from "@/modules/ai/types";
import { recordKnowledgeTest } from "@/lib/data/knowledge-tests";
import { generateAnswer } from "@/modules/knowledge/answer";
import { searchKnowledge } from "@/modules/knowledge/search";
import type { KnowledgeSearchOutcome } from "@/modules/knowledge/types";

export type KnowledgePlaygroundResult = {
  search: KnowledgeSearchOutcome;
  answer: GeneratedAnswer | null;
  answerError: string | null;
  logSaved: boolean;
};

export async function runKnowledgePlayground(input: {
  projectId: string;
  clientId: string;
  query: string;
  canWrite: boolean;
}): Promise<KnowledgePlaygroundResult> {
  const search = await searchKnowledge(input);
  if (search.mode !== "semantic") {
    return { search, answer: null, answerError: null, logSaved: false };
  }

  try {
    const answer = await generateAnswer({
      projectId: input.projectId,
      clientId: input.clientId,
      question: input.query,
      hits: search.hits,
    });
    const logSaved = await recordKnowledgeTest({
      projectId: input.projectId,
      clientId: input.clientId,
      query: input.query,
      answer,
    });
    return { search, answer, answerError: null, logSaved };
  } catch (error) {
    if (error instanceof AnswerError) {
      return { search, answer: null, answerError: error.message, logSaved: false };
    }
    throw error;
  }
}
