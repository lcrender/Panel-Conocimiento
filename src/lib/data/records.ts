import "server-only";
import { z } from "zod";
import { embedName, failQuery, parseRow, parseRows } from "@/lib/data/common";
import { sanitizeIlike } from "@/lib/validation/keywords";
import type { DbClient } from "@/lib/supabase/server";

const clientRow = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
  created_at: z.string(),
  updated_at: z.string(),
});

const projectRow = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  name: z.string(),
  description: z.string(),
  status: z.enum(["active", "inactive"]),
  created_at: z.string(),
  updated_at: z.string(),
  clients: z.unknown().optional(),
});

const categoryRow = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  project_id: z.uuid(),
  name: z.string(),
  description: z.string(),
  active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const knowledgeRow = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  project_id: z.uuid(),
  category_id: z.uuid().nullable(),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  keywords: z.array(z.string()),
  active: z.boolean(),
  priority: z.enum(["normal", "high", "critical"]),
  allow_ai_rewrite: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  categories: z.unknown().optional(),
});

export type ClientRecord = z.infer<typeof clientRow>;
export type ProjectRecord = z.infer<typeof projectRow> & { clientName: string | null };
export type CategoryRecord = z.infer<typeof categoryRow>;
export type KnowledgeRecord = z.infer<typeof knowledgeRow> & { categoryName: string | null };

function withClientName(row: z.infer<typeof projectRow>): ProjectRecord {
  return { ...row, clientName: embedName(row.clients) };
}

function withCategoryName(row: z.infer<typeof knowledgeRow>): KnowledgeRecord {
  return { ...row, categoryName: embedName(row.categories) };
}

export async function listClients(supabase: DbClient) {
  const { data, error } = await supabase.from("clients").select("id, name, status, created_at, updated_at").order("name");
  if (error) failQuery(error);
  return parseRows(clientRow, data);
}

export async function getClient(supabase: DbClient, id: string) {
  const { data, error } = await supabase
    .from("clients")
    .select("id, name, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) failQuery(error);
  return data ? parseRow(clientRow, data) : null;
}

export async function listProjects(supabase: DbClient) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, client_id, name, description, status, created_at, updated_at, clients(name)")
    .order("name");
  if (error) failQuery(error);
  return parseRows(projectRow, data).map(withClientName);
}

export async function getProject(supabase: DbClient, id: string) {
  const { data, error } = await supabase
    .from("projects")
    .select("id, client_id, name, description, status, created_at, updated_at, clients(name)")
    .eq("id", id)
    .maybeSingle();
  if (error) failQuery(error);
  return data ? withClientName(parseRow(projectRow, data)) : null;
}

export async function listCategories(supabase: DbClient, projectId: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, client_id, project_id, name, description, active, created_at, updated_at")
    .eq("project_id", projectId)
    .order("name");
  if (error) failQuery(error);
  return parseRows(categoryRow, data);
}

export async function getCategory(supabase: DbClient, id: string) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, client_id, project_id, name, description, active, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) failQuery(error);
  return data ? parseRow(categoryRow, data) : null;
}

export async function listKnowledge(
  supabase: DbClient,
  input: { projectId: string; query: string; categoryId: string; status: string },
) {
  let request = supabase
    .from("knowledge_items")
    .select(
      "id, client_id, project_id, category_id, title, question, answer, keywords, active, priority, allow_ai_rewrite, created_at, updated_at, categories(name)",
    )
    .eq("project_id", input.projectId)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (input.status === "active") request = request.eq("active", true);
  if (input.status === "inactive") request = request.eq("active", false);
  if (z.uuid().safeParse(input.categoryId).success) request = request.eq("category_id", input.categoryId);

  const safeQuery = sanitizeIlike(input.query);
  if (safeQuery) {
    request = request.or(`title.ilike.%${safeQuery}%,question.ilike.%${safeQuery}%,answer.ilike.%${safeQuery}%`);
  }

  const { data, error } = await request;
  if (error) failQuery(error);
  return parseRows(knowledgeRow, data).map(withCategoryName);
}

export async function getKnowledge(supabase: DbClient, id: string) {
  const { data, error } = await supabase
    .from("knowledge_items")
    .select(
      "id, client_id, project_id, category_id, title, question, answer, keywords, active, priority, allow_ai_rewrite, created_at, updated_at, categories(name)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) failQuery(error);
  return data ? withCategoryName(parseRow(knowledgeRow, data)) : null;
}
