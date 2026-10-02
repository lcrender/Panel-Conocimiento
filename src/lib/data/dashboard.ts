import "server-only";
import { failQuery } from "@/lib/data/common";
import { listProjectActivity } from "@/lib/data/activity";
import type { DbClient } from "@/lib/supabase/server";

async function countRows(
  supabase: DbClient,
  table: "knowledge_items" | "categories",
  projectId: string,
  activeOnly: boolean,
) {
  let request = supabase.from(table).select("id", { count: "exact", head: true }).eq("project_id", projectId);
  if (activeOnly) request = request.eq("active", true);
  const { count, error } = await request;
  if (error) failQuery(error);
  return count ?? 0;
}

export async function loadDashboard(supabase: DbClient, clientId: string, projectId: string) {
  const [knowledgeTotal, knowledgeActive, categoriesTotal, categoriesActive, usersResult, activity] =
    await Promise.all([
      countRows(supabase, "knowledge_items", projectId, false),
      countRows(supabase, "knowledge_items", projectId, true),
      countRows(supabase, "categories", projectId, false),
      countRows(supabase, "categories", projectId, true),
      supabase.rpc("project_user_count", { p_project_id: projectId }),
      listProjectActivity(supabase, clientId, projectId, 8),
    ]);

  if (usersResult.error) failQuery(usersResult.error);

  return {
    knowledgeTotal,
    knowledgeActive,
    categoriesTotal,
    categoriesActive,
    users: typeof usersResult.data === "number" ? usersResult.data : 0,
    activity,
  };
}
