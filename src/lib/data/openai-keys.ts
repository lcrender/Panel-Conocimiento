import "server-only";
import { z } from "zod";
import { failQuery } from "@/lib/data/common";
import type { DbClient } from "@/lib/supabase/server";

const keyRow = z.object({
  id: z.uuid(),
  client_id: z.uuid(),
  name: z.string(),
  key_hint: z.string(),
  created_at: z.string(),
});

const settingRow = z.object({
  project_id: z.uuid(),
  openai_key_id: z.uuid().nullable(),
  similarity_threshold: z.union([z.number(), z.string(), z.null()]).optional(),
});

export type OpenAIKeyRecord = z.infer<typeof keyRow>;

export async function listOpenAIKeys(supabase: DbClient, clientId: string) {
  const { data, error } = await supabase
    .from("client_openai_keys")
    .select("id, client_id, name, key_hint, created_at")
    .eq("client_id", clientId)
    .order("name");
  if (error) failQuery(error);
  const parsed = z.array(keyRow).safeParse(data ?? []);
  if (!parsed.success) failQuery({ message: "Las claves devolvieron un formato inesperado." });
  return parsed.data;
}

const projectAssignment = z.object({
  id: z.uuid(),
  name: z.string(),
});

export async function listClientProjectsWithKeys(supabase: DbClient, clientId: string) {
  const [projects, settings] = await Promise.all([
    supabase.from("projects").select("id, name").eq("client_id", clientId).order("name"),
    supabase.from("project_ai_settings").select("project_id, openai_key_id").eq("client_id", clientId),
  ]);
  if (projects.error) failQuery(projects.error);
  if (settings.error) failQuery(settings.error);
  const projectRows = z.array(projectAssignment).safeParse(projects.data ?? []);
  const settingRows = z.array(settingRow).safeParse(settings.data ?? []);
  if (!projectRows.success || !settingRows.success) {
    failQuery({ message: "No se pudo leer qué clave usa cada proyecto." });
  }
  const keyByProject = new Map(settingRows.data.map((row) => [row.project_id, row.openai_key_id]));
  return projectRows.data.map((project) => ({
    id: project.id,
    name: project.name,
    keyId: keyByProject.get(project.id) ?? null,
  }));
}

function readThreshold(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) return null;
  return parsed;
}

function projectAiSettingFrom(data: unknown, similarityThreshold: number | null) {
  const parsed = settingRow.safeParse(data);
  if (!parsed.success) failQuery({ message: "La configuración del proyecto devolvió un formato inesperado." });
  return {
    keyId: parsed.data.openai_key_id,
    similarityThreshold,
  };
}

export async function getProjectAiSetting(supabase: DbClient, projectId: string) {
  const full = await supabase
    .from("project_ai_settings")
    .select("project_id, openai_key_id, similarity_threshold")
    .eq("project_id", projectId)
    .maybeSingle();

  if (full.error?.message.includes("similarity_threshold")) {
    const legacy = await supabase
      .from("project_ai_settings")
      .select("project_id, openai_key_id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (legacy.error) failQuery(legacy.error);
    if (!legacy.data) return { keyId: null, similarityThreshold: null };
    return projectAiSettingFrom(legacy.data, null);
  }

  if (full.error) failQuery(full.error);
  if (!full.data) return { keyId: null, similarityThreshold: null };
  return projectAiSettingFrom(full.data, readThreshold(full.data.similarity_threshold));
}
