"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { toUserMessage } from "@/lib/errors";
import { firstIssue, readText, type ActionState } from "@/lib/form";
import { clientSchema } from "@/lib/validation/schemas";

export async function saveClient(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.clientsWrite)) {
    return { error: "No tenés permiso para editar clientes." };
  }

  const parsed = clientSchema.safeParse({
    name: readText(formData, "name"),
    status: readText(formData, "status"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const id = readText(formData, "id");
  if (id) {
    if (!z.uuid().safeParse(id).success) return { error: "Cliente inválido." };
    const { error } = await supabase.from("clients").update(parsed.data).eq("id", id);
    if (error) return { error: toUserMessage(error) };
    revalidatePath("/clientes");
    redirect(`/clientes/${id}?ok=1`);
  }

  const { data, error } = await supabase.from("clients").insert(parsed.data).select("id").single();
  if (error || !data) return { error: toUserMessage(error ?? { message: "" }) };
  revalidatePath("/clientes");
  redirect(`/clientes/${data.id}?ok=1`);
}

export async function setClientStatus(formData: FormData) {
  const { supabase, access } = await getSessionContext();
  const id = readText(formData, "id");
  const status = readText(formData, "status");
  if (!canPlatform(access, PERMISSIONS.clientsWrite) || !z.uuid().safeParse(id).success) {
    redirect("/clientes?error=" + encodeURIComponent("No tenés permiso para esta acción."));
  }
  if (status !== "active" && status !== "inactive") {
    redirect("/clientes?error=" + encodeURIComponent("Estado inválido."));
  }
  const { error } = await supabase.from("clients").update({ status }).eq("id", id);
  if (error) redirect("/clientes?error=" + encodeURIComponent(toUserMessage(error)));
  revalidatePath("/clientes");
  redirect("/clientes?ok=1");
}
