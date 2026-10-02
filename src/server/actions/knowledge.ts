"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { getKnowledge } from "@/lib/data/records";
import { toUserMessage } from "@/lib/errors";
import { firstIssue, readChecked, readText, type ActionState } from "@/lib/form";
import { parseKeywords } from "@/lib/validation/keywords";
import { knowledgeSchema } from "@/lib/validation/schemas";
import { EmbeddingError } from "@/modules/knowledge/openai";
import { syncKnowledgeEmbedding } from "@/modules/knowledge/persist-embedding";

async function categoryBelongsToProject(
  supabase: Awaited<ReturnType<typeof getSessionContext>>["supabase"],
  categoryId: string,
  projectId: string,
) {
  const { data, error } = await supabase
    .from("categories")
    .select("id, project_id")
    .eq("id", categoryId)
    .maybeSingle();
  if (error) return false;
  return data?.project_id === projectId;
}

export async function saveKnowledge(_state: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSessionContext();
  const keywords = parseKeywords(readText(formData, "keywords"));
  if (keywords.error) return { error: keywords.error };

  const parsed = knowledgeSchema.safeParse({
    title: readText(formData, "title"),
    question: readText(formData, "question"),
    answer: readText(formData, "answer"),
    categoryId: readText(formData, "categoryId"),
    priority: readText(formData, "priority"),
    allowAiRewrite: readChecked(formData, "allowAiRewrite"),
    active: readChecked(formData, "active"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const id = readText(formData, "id");
  let projectId = "";
  let clientId = "";

  if (id) {
    if (!z.uuid().safeParse(id).success) return { error: "Contenido inválido." };
    const current = await getKnowledge(session.supabase, id);
    if (!current) return { error: "No se encontró el contenido." };
    const target = session.access.projects.find((item) => item.id === current.project_id);
    if (!target || !canProject(target, PERMISSIONS.knowledgeWrite)) {
      return { error: "No tenés permiso para editar este contenido." };
    }
    projectId = current.project_id;
    clientId = current.client_id;
  } else if (!session.project || !canProject(session.project, PERMISSIONS.knowledgeWrite)) {
    return { error: "No tenés permiso para cargar conocimiento en el proyecto activo." };
  } else {
    projectId = session.project.id;
    clientId = session.project.clientId;
  }

  const categoryOk = await categoryBelongsToProject(session.supabase, parsed.data.categoryId, projectId);
  if (!categoryOk) return { error: "La categoría no pertenece al proyecto." };

  const payload = {
    client_id: clientId,
    project_id: projectId,
    category_id: parsed.data.categoryId,
    title: parsed.data.title,
    question: parsed.data.question,
    answer: parsed.data.answer,
    keywords: keywords.keywords,
    active: parsed.data.active,
    priority: parsed.data.priority,
    allow_ai_rewrite: parsed.data.allowAiRewrite,
  };

  if (id) {
    const { error } = await session.supabase.from("knowledge_items").update(payload).eq("id", id);
    if (error) return { error: toUserMessage(error) };
    const embedded = await embedKnowledge(session.supabase, {
      id,
      clientId,
      projectId,
      title: payload.title,
      question: payload.question,
      answer: payload.answer,
      keywords: payload.keywords,
    });
    revalidatePath("/conocimiento");
    revalidatePath("/probar");
    if (embedded) return embedded;
    redirect(`/conocimiento/${id}?ok=1`);
  }

  const { data, error } = await session.supabase.from("knowledge_items").insert(payload).select("id").single();
  if (error || !data) return { error: toUserMessage(error ?? { message: "" }) };
  const embedded = await embedKnowledge(session.supabase, {
    id: data.id,
    clientId,
    projectId,
    title: payload.title,
    question: payload.question,
    answer: payload.answer,
    keywords: payload.keywords,
  });
  revalidatePath("/conocimiento");
  revalidatePath("/probar");
  if (embedded?.error) redirect(`/conocimiento/${data.id}?error=` + encodeURIComponent(embedded.error));
  redirect(`/conocimiento/${data.id}?ok=1`);
}

async function embedKnowledge(
  supabase: Awaited<ReturnType<typeof getSessionContext>>["supabase"],
  item: {
    id: string;
    clientId: string;
    projectId: string;
    title: string;
    question: string;
    answer: string;
    keywords: string[];
  },
): Promise<ActionState | null> {
  try {
    await syncKnowledgeEmbedding(supabase, item);
    return null;
  } catch (error) {
    if (error instanceof EmbeddingError) return { error: error.message };
    throw error;
  }
}

export async function setKnowledgeStatus(formData: FormData) {
  const { supabase, access } = await getSessionContext();
  const id = readText(formData, "id");
  const active = readText(formData, "active") === "true";
  if (!z.uuid().safeParse(id).success) {
    redirect("/conocimiento?error=" + encodeURIComponent("Contenido inválido."));
  }
  const current = await getKnowledge(supabase, id);
  const target = current ? access.projects.find((item) => item.id === current.project_id) : null;
  if (!current || !target || !canProject(target, PERMISSIONS.knowledgeWrite)) {
    redirect("/conocimiento?error=" + encodeURIComponent("No tenés permiso para esta acción."));
  }
  const { error } = await supabase.from("knowledge_items").update({ active }).eq("id", id);
  if (error) redirect("/conocimiento?error=" + encodeURIComponent(toUserMessage(error)));
  revalidatePath("/conocimiento");
  redirect("/conocimiento?ok=1");
}

export async function duplicateKnowledge(formData: FormData) {
  const { supabase, access } = await getSessionContext();
  const id = readText(formData, "id");
  const current = z.uuid().safeParse(id).success ? await getKnowledge(supabase, id) : null;
  const target = current ? access.projects.find((item) => item.id === current.project_id) : null;
  if (!current || !target || !canProject(target, PERMISSIONS.knowledgeWrite)) {
    redirect("/conocimiento?error=" + encodeURIComponent("No tenés permiso para duplicar este contenido."));
  }

  const { data, error } = await supabase
    .from("knowledge_items")
    .insert({
      client_id: current.client_id,
      project_id: current.project_id,
      category_id: current.category_id,
      title: `${current.title} (copia)`.slice(0, 140),
      question: current.question,
      answer: current.answer,
      keywords: current.keywords,
      active: true,
      priority: current.priority,
      allow_ai_rewrite: current.allow_ai_rewrite,
    })
    .select("id")
    .single();

  if (error || !data) {
    redirect("/conocimiento?error=" + encodeURIComponent(error ? toUserMessage(error) : "No se pudo duplicar."));
  }
  const embedded = await embedKnowledge(supabase, {
    id: data.id,
    clientId: current.client_id,
    projectId: current.project_id,
    title: `${current.title} (copia)`.slice(0, 140),
    question: current.question,
    answer: current.answer,
    keywords: current.keywords,
  });
  revalidatePath("/conocimiento");
  revalidatePath("/probar");
  if (embedded?.error) redirect(`/conocimiento/${data.id}?error=` + encodeURIComponent(embedded.error));
  redirect(`/conocimiento/${data.id}?ok=1`);
}
