import "server-only";
import type { GeneratedAnswer } from "@/modules/ai/types";
import { createClient } from "@/lib/supabase/server";

export async function recordKnowledgeTest(input: {
  projectId: string;
  clientId: string;
  query: string;
  answer: GeneratedAnswer;
}) {
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return false;

  const { error } = await supabase.from("knowledge_tests").insert({
    project_id: input.projectId,
    client_id: input.clientId,
    user_id: authData.user.id,
    query: input.query,
    answer: input.answer.answer,
    status: input.answer.status,
    confidence: input.answer.confidence,
    used_knowledge_ids: input.answer.usedKnowledgeIds,
  });
  if (error) {
    console.error(error.message);
    return false;
  }
  return true;
}
