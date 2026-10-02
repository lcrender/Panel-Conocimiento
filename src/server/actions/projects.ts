"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { ACTIVE_PROJECT_COOKIE, getSessionContext, projectCookieOptions } from "@/lib/auth/session";
import { toUserMessage } from "@/lib/errors";
import { firstIssue, readText, type ActionState } from "@/lib/form";
import { projectSchema } from "@/lib/validation/schemas";

export async function saveProject(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.projectsWrite)) {
    return { error: "No tenés permiso para editar proyectos." };
  }

  const parsed = projectSchema.safeParse({
    clientId: readText(formData, "clientId"),
    name: readText(formData, "name"),
    description: readText(formData, "description"),
    status: readText(formData, "status"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const client = access.clients.find((item) => item.id === parsed.data.clientId);
  if (!client) return { error: "No se encontró el cliente." };

  const payload = {
    client_id: parsed.data.clientId,
    name: parsed.data.name,
    description: parsed.data.description,
    status: parsed.data.status,
  };

  const id = readText(formData, "id");
  if (id) {
    if (!z.uuid().safeParse(id).success) return { error: "Proyecto inválido." };
    const { error } = await supabase.from("projects").update(payload).eq("id", id);
    if (error) return { error: toUserMessage(error) };
    revalidatePath("/proyectos");
    redirect(`/proyectos/${id}?ok=1`);
  }

  const { data, error } = await supabase.from("projects").insert(payload).select("id").single();
  if (error || !data) return { error: toUserMessage(error ?? { message: "" }) };

  const cookieStore = await cookies();
  if (!cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value) {
    cookieStore.set(ACTIVE_PROJECT_COOKIE, data.id, projectCookieOptions());
  }

  revalidatePath("/", "layout");
  redirect(`/proyectos/${data.id}?ok=1`);
}

export async function setProjectStatus(formData: FormData) {
  const { supabase, access } = await getSessionContext();
  const id = readText(formData, "id");
  const status = readText(formData, "status");
  if (!canPlatform(access, PERMISSIONS.projectsWrite) || !z.uuid().safeParse(id).success) {
    redirect("/proyectos?error=" + encodeURIComponent("No tenés permiso para esta acción."));
  }
  if (status !== "active" && status !== "inactive") {
    redirect("/proyectos?error=" + encodeURIComponent("Estado inválido."));
  }
  const { error } = await supabase.from("projects").update({ status }).eq("id", id);
  if (error) redirect("/proyectos?error=" + encodeURIComponent(toUserMessage(error)));
  revalidatePath("/proyectos");
  redirect("/proyectos?ok=1");
}
