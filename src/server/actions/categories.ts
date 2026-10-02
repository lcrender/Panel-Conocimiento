"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { getCategory } from "@/lib/data/records";
import { toUserMessage } from "@/lib/errors";
import { firstIssue, readChecked, readText, type ActionState } from "@/lib/form";
import { categorySchema } from "@/lib/validation/schemas";

export async function saveCategory(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access, project } = await getSessionContext();
  const parsed = categorySchema.safeParse({
    name: readText(formData, "name"),
    description: readText(formData, "description"),
    active: readChecked(formData, "active"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const id = readText(formData, "id");
  if (id) {
    if (!z.uuid().safeParse(id).success) return { error: "Categoría inválida." };
    const current = await getCategory(supabase, id);
    if (!current) return { error: "No se encontró la categoría." };
    const target = access.projects.find((item) => item.id === current.project_id);
    if (!target || !canProject(target, PERMISSIONS.categoriesWrite)) {
      return { error: "No tenés permiso para editar esta categoría." };
    }
    const { error } = await supabase
      .from("categories")
      .update({
        name: parsed.data.name,
        description: parsed.data.description,
        active: parsed.data.active,
      })
      .eq("id", id);
    if (error) return { error: toUserMessage(error) };
    revalidatePath("/categorias");
    redirect(`/categorias/${id}?ok=1`);
  }

  if (!project || !canProject(project, PERMISSIONS.categoriesWrite)) {
    return { error: "No tenés permiso para crear categorías en el proyecto activo." };
  }

  const { data, error } = await supabase
    .from("categories")
    .insert({
      client_id: project.clientId,
      project_id: project.id,
      name: parsed.data.name,
      description: parsed.data.description,
      active: parsed.data.active,
    })
    .select("id")
    .single();
  if (error || !data) return { error: toUserMessage(error ?? { message: "" }) };
  revalidatePath("/categorias");
  redirect(`/categorias/${data.id}?ok=1`);
}

export async function setCategoryStatus(formData: FormData) {
  const { supabase, access } = await getSessionContext();
  const id = readText(formData, "id");
  const active = readText(formData, "active") === "true";
  if (!z.uuid().safeParse(id).success) redirect("/categorias?error=" + encodeURIComponent("Categoría inválida."));
  const current = await getCategory(supabase, id);
  const target = current ? access.projects.find((item) => item.id === current.project_id) : null;
  if (!current || !target || !canProject(target, PERMISSIONS.categoriesWrite)) {
    redirect("/categorias?error=" + encodeURIComponent("No tenés permiso para esta acción."));
  }
  const { error } = await supabase.from("categories").update({ active }).eq("id", id);
  if (error) redirect("/categorias?error=" + encodeURIComponent(toUserMessage(error)));
  revalidatePath("/categorias");
  redirect("/categorias?ok=1");
}
