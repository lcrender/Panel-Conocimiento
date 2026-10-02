import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DbClient } from "@/lib/supabase/server";
import { EmbeddingError } from "@/modules/knowledge/openai";

const projectKeyRow = z.object({
  client_id: z.uuid(),
  openai_key_id: z.uuid().nullable(),
});

const secretRow = z.object({
  client_id: z.uuid(),
  secret: z.string().min(1),
});

export async function readProjectOpenAIKey(supabase: DbClient, projectId: string, clientId: string) {
  const setting = await supabase
    .from("project_ai_settings")
    .select("client_id, openai_key_id")
    .eq("project_id", projectId)
    .maybeSingle();
  if (setting.error) throw new EmbeddingError("No se pudo leer la clave de OpenAI del proyecto.");
  const parsed = setting.data ? projectKeyRow.safeParse(setting.data) : null;
  if (!parsed?.success || !parsed.data.openai_key_id || parsed.data.client_id !== clientId) return null;

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    throw new EmbeddingError("Falta la clave de servicio para leer las claves de OpenAI.");
  }

  const secret = await admin
    .from("client_openai_keys")
    .select("client_id, secret")
    .eq("id", parsed.data.openai_key_id)
    .maybeSingle();
  if (secret.error || !secret.data) {
    throw new EmbeddingError("No se pudo leer la clave de OpenAI del proyecto.");
  }
  const row = secretRow.safeParse(secret.data);
  if (!row.success || row.data.client_id !== clientId) {
    throw new EmbeddingError("La clave seleccionada no pertenece a este cliente.");
  }
  return row.data.secret;
}
