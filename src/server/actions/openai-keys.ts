"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canClient } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { toUserMessage } from "@/lib/errors";
import { readSecret, readText, type ActionState } from "@/lib/form";
import { isOpenAIKey, openAIKeyHint } from "@/lib/openai/key";
import { parseSimilarityThresholdInput } from "@/modules/knowledge/document";
import { safeNextPath } from "@/lib/validation/keywords";

function canManage(access: Awaited<ReturnType<typeof getSessionContext>>["access"], clientId: string) {
  return canClient(access, clientId, PERMISSIONS.integrationsManage);
}

export async function createOpenAIKey(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  const clientId = readText(formData, "clientId");
  const name = readText(formData, "name");
  const secret = readSecret(formData, "apiKey").trim();
  if (!z.uuid().safeParse(clientId).success || !canManage(access, clientId)) {
    return { error: "No tenés permiso para cargar claves de este cliente." };
  }
  if (name.length < 2 || name.length > 80) return { error: "El nombre de la clave necesita entre 2 y 80 caracteres." };
  if (!isOpenAIKey(secret)) return { error: "La clave de OpenAI tiene que empezar con sk-." };

  const { error } = await supabase.from("client_openai_keys").insert({
    client_id: clientId,
    name,
    key_hint: openAIKeyHint(secret),
    secret,
  }).select("id");
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/claves");
  revalidatePath("/proyectos");
  redirect(`/claves?cliente=${clientId}&ok=1`);
}

export async function deleteOpenAIKey(formData: FormData) {
  const { supabase, access } = await getSessionContext();
  const clientId = readText(formData, "clientId");
  const id = readText(formData, "id");
  if (!z.uuid().safeParse(clientId).success || !z.uuid().safeParse(id).success || !canManage(access, clientId)) {
    redirect("/claves?error=" + encodeURIComponent("No tenés permiso para quitar esta clave."));
  }
  const { error } = await supabase
    .from("client_openai_keys")
    .delete()
    .eq("id", id)
    .eq("client_id", clientId)
    .select("id");
  if (error) redirect(`/claves?cliente=${clientId}&error=` + encodeURIComponent(toUserMessage(error)));
  revalidatePath("/claves");
  revalidatePath("/proyectos");
  redirect(`/claves?cliente=${clientId}&ok=1`);
}

export async function assignProjectOpenAIKey(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  const projectId = readText(formData, "projectId");
  const clientId = readText(formData, "clientId");
  const keyId = readText(formData, "keyId");
  if (!z.uuid().safeParse(projectId).success || !z.uuid().safeParse(clientId).success || !canManage(access, clientId)) {
    return { error: "No tenés permiso para elegir la clave de este proyecto." };
  }
  if (keyId && !z.uuid().safeParse(keyId).success) return { error: "La clave elegida no es válida." };

  const { error } = await supabase.from("project_ai_settings").upsert(
    {
      project_id: projectId,
      client_id: clientId,
      openai_key_id: keyId || null,
    },
    { onConflict: "project_id" },
  );
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath("/claves");
  revalidatePath("/probar");
  const next = safeNextPath(formData.get("returnTo"));
  const backToKeys = next === "/claves" || next.startsWith("/claves?");
  redirect(backToKeys ? `${next}${next.includes("?") ? "&" : "?"}ok=1` : `/proyectos/${projectId}?ok=1`);
}

export async function saveProjectSimilarityThreshold(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  const projectId = readText(formData, "projectId");
  const clientId = readText(formData, "clientId");
  const threshold = parseSimilarityThresholdInput(readText(formData, "similarityThreshold"));
  if (!z.uuid().safeParse(projectId).success || !z.uuid().safeParse(clientId).success || !canManage(access, clientId)) {
    return { error: "No tenés permiso para cambiar el umbral de este proyecto." };
  }
  if (threshold === null) return { error: "El umbral de similitud tiene que ser un número entre 0 y 1." };

  const { error } = await supabase.from("project_ai_settings").upsert(
    {
      project_id: projectId,
      client_id: clientId,
      similarity_threshold: threshold,
    },
    { onConflict: "project_id" },
  );
  if (error) return { error: toUserMessage(error) };
  revalidatePath(`/proyectos/${projectId}`);
  revalidatePath("/probar");
  redirect(`/proyectos/${projectId}?ok=1`);
}
