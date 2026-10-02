"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { toUserMessage } from "@/lib/errors";
import { firstIssue, readChecked, readText, type ActionState } from "@/lib/form";
import { roleSchema } from "@/lib/validation/schemas";

export async function createRole(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.rolesManage)) {
    return { error: "No tenés permiso para administrar roles." };
  }

  const parsed = roleSchema.safeParse({
    name: readText(formData, "name"),
    slug: readText(formData, "slug"),
    description: readText(formData, "description"),
    scope: readText(formData, "scope"),
    allowsOverrides: readChecked(formData, "allowsOverrides"),
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const { error } = await supabase.from("roles").insert({
    name: parsed.data.name,
    slug: parsed.data.slug,
    description: parsed.data.description,
    scope: parsed.data.scope,
    allows_permission_overrides: parsed.data.scope === "project" && parsed.data.allowsOverrides,
  });
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/roles");
  redirect("/roles?ok=1");
}

export async function saveRolePermissions(formData: FormData) {
  const { supabase, access } = await getSessionContext();
  if (!canPlatform(access, PERMISSIONS.rolesManage)) {
    redirect("/roles?error=" + encodeURIComponent("No tenés permiso para administrar roles."));
  }

  const roleId = readText(formData, "roleId");
  const slugs = formData.getAll("permissions").filter((value): value is string => typeof value === "string");
  const { error } = await supabase.rpc("set_role_permissions", { p_role_id: roleId, p_slugs: slugs });
  if (error) redirect("/roles?error=" + encodeURIComponent(toUserMessage(error)));
  revalidatePath("/", "layout");
  redirect("/roles?ok=1");
}
