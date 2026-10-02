import "server-only";
import { z } from "zod";
import { failQuery, parseRows } from "@/lib/data/common";
import type { DbClient } from "@/lib/supabase/server";

const activityRow = z.object({
  id: z.uuid(),
  action: z.string(),
  entity_type: z.string(),
  entity_id: z.uuid().nullable(),
  metadata: z.unknown(),
  created_at: z.string(),
});

export type ActivityRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  label: string;
  actorName: string;
  role: string | null;
  createdAt: string;
};

function mapActivity(row: z.infer<typeof activityRow>): ActivityRecord {
  const metadata = row.metadata && typeof row.metadata === "object" ? (row.metadata as Record<string, unknown>) : {};
  return {
    id: row.id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    label: typeof metadata.label === "string" ? metadata.label : "",
    actorName: typeof metadata.actor_name === "string" ? metadata.actor_name : "Usuario",
    role: typeof metadata.role === "string" ? metadata.role : null,
    createdAt: row.created_at,
  };
}

export async function listProjectActivity(supabase: DbClient, clientId: string, projectId: string, limit: number) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at")
    .eq("client_id", clientId)
    .or(`project_id.eq.${projectId},project_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) failQuery(error);
  return parseRows(activityRow, data).map(mapActivity);
}

export async function listPlatformActivity(supabase: DbClient, limit: number) {
  const { data, error } = await supabase
    .from("activity_logs")
    .select("id, action, entity_type, entity_id, metadata, created_at")
    .is("client_id", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) failQuery(error);
  return parseRows(activityRow, data).map(mapActivity);
}
