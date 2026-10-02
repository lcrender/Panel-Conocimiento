"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listRoles } from "@/lib/data/people";
import { toUserMessage } from "@/lib/errors";
import { firstIssue, readChecked, readIds, readSecret, readText, type ActionState } from "@/lib/form";
import { createAdminClient } from "@/lib/supabase/admin";
import { profileSchema } from "@/lib/validation/schemas";

function mapAuthError(message?: string) {
  const text = (message ?? "").toLowerCase();
  if (text.includes("already") || text.includes("registered") || text.includes("exists")) {
    return "Ese email ya está registrado. Volvé a enviarlo para sumarle un acceso.";
  }
  return "No se pudo crear el usuario.";
}

async function categoriesPermissionId(supabase: Awaited<ReturnType<typeof getSessionContext>>["supabase"]) {
  const { data, error } = await supabase.from("permissions").select("id").eq("slug", "categories.write").maybeSingle();
  if (error || !data) return null;
  return data.id as string;
}

export async function createUserAccess(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  const roles = await listRoles(supabase);
  const role = roles.find((item) => item.id === readText(formData, "roleId"));
  if (!role) return { error: "Elegí un rol." };
  if (role.scope === "platform" && !access.isSuperAdmin) {
    return { error: "No podés asignar un rol de plataforma." };
  }

  const emailParsed = z.email("Ingresá un email válido.").safeParse(readText(formData, "email").toLowerCase());
  if (!emailParsed.success) return { error: firstIssue(emailParsed.error) };
  const fullName = readText(formData, "fullName");
  if (fullName.length < 2) return { error: "El nombre necesita al menos 2 caracteres." };

  const sendInvite = readChecked(formData, "sendInvite");
  const password = readSecret(formData, "password");
  const clientId = readText(formData, "clientId");
  const projectIds = readIds(formData, "projectIds");
  const grantCategories = readChecked(formData, "grantCategories") && role.allowsPermissionOverrides;

  if (role.scope !== "platform") {
    const client = access.clients.find((item) => item.id === clientId);
    if (!client || !client.permissions.includes(PERMISSIONS.usersManage)) {
      return { error: "No podés asignar usuarios a ese cliente." };
    }
  }

  if (role.scope === "project" && projectIds.length === 0) {
    return { error: "Elegí al menos un proyecto." };
  }

  if (role.scope === "project") {
    const { data: found, error } = await supabase.from("projects").select("id, client_id").in("id", projectIds);
    if (error) return { error: toUserMessage(error) };
    if (!found || found.length !== projectIds.length || found.some((project) => project.client_id !== clientId)) {
      return { error: "Hay proyectos que no pertenecen al cliente." };
    }
  }

  const lookup = await supabase.rpc("profile_id_for_invite", { target_email: emailParsed.data });
  if (lookup.error) return { error: toUserMessage(lookup.error) };

  let userId = typeof lookup.data === "string" ? lookup.data : null;
  if (!userId) {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { error: "Falta SUPABASE_SERVICE_ROLE_KEY para crear usuarios." };
    }
    const admin = createAdminClient();
    if (sendInvite) {
      const headerStore = await headers();
      const origin = process.env.NEXT_PUBLIC_SITE_URL || headerStore.get("origin") || "http://localhost:3000";
      const invited = await admin.auth.admin.inviteUserByEmail(emailParsed.data, {
        data: { full_name: fullName },
        redirectTo: `${origin}/auth/callback`,
      });
      if (invited.error || !invited.data.user) return { error: mapAuthError(invited.error?.message) };
      userId = invited.data.user.id;
    } else {
      if (password.length < 8) return { error: "La contraseña necesita al menos 8 caracteres." };
      const created = await admin.auth.admin.createUser({
        email: emailParsed.data,
        password,
        email_confirm: true,
        user_metadata: { full_name: fullName },
      });
      if (created.error || !created.data.user) return { error: mapAuthError(created.error?.message) };
      userId = created.data.user.id;
    }
  }

  const scopes =
    role.scope === "platform"
      ? [{ client_id: null, project_id: null }]
      : role.scope === "client"
        ? [{ client_id: clientId, project_id: null }]
        : projectIds.map((projectId) => ({ client_id: clientId, project_id: projectId }));

  const permissionId = grantCategories ? await categoriesPermissionId(supabase) : null;
  if (grantCategories && !permissionId) return { error: "No se encontró el permiso de categorías." };

  for (const scope of scopes) {
    const inserted = await supabase
      .from("memberships")
      .insert({
        user_id: userId,
        client_id: scope.client_id,
        project_id: scope.project_id,
        role_id: role.id,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) return { error: toUserMessage(inserted.error ?? { message: "" }) };

    if (permissionId) {
      const override = await supabase.from("membership_permission_overrides").insert({
        membership_id: inserted.data.id,
        permission_id: permissionId,
        granted: true,
      });
      if (override.error) return { error: toUserMessage(override.error) };
    }
  }

  revalidatePath("/usuarios");
  redirect(`/usuarios/${userId}?ok=1`);
}

export async function addUserAccess(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  const userId = readText(formData, "userId");
  if (!z.uuid().safeParse(userId).success) return { error: "Usuario inválido." };

  const profile = await supabase.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (profile.error) return { error: toUserMessage(profile.error) };
  if (!profile.data) return { error: "No se encontró el usuario." };

  const roles = await listRoles(supabase);
  const role = roles.find((item) => item.id === readText(formData, "roleId"));
  if (!role) return { error: "Elegí un rol." };
  if (role.scope === "platform" && !access.isSuperAdmin) {
    return { error: "No podés asignar un rol de plataforma." };
  }

  const clientId = readText(formData, "clientId");
  const projectIds = readIds(formData, "projectIds");
  const grantCategories = readChecked(formData, "grantCategories") && role.allowsPermissionOverrides;

  if (role.scope !== "platform") {
    const client = access.clients.find((item) => item.id === clientId);
    if (!client || !client.permissions.includes(PERMISSIONS.usersManage)) {
      return { error: "No podés asignar usuarios a ese cliente." };
    }
  }

  if (role.scope === "project" && projectIds.length === 0) {
    return { error: "Elegí al menos un proyecto." };
  }

  if (role.scope === "project") {
    const found = await supabase.from("projects").select("id, client_id").in("id", projectIds);
    if (found.error) return { error: toUserMessage(found.error) };
    if (!found.data || found.data.length !== projectIds.length || found.data.some((project) => project.client_id !== clientId)) {
      return { error: "Hay proyectos que no pertenecen al cliente." };
    }
  }

  const scopes =
    role.scope === "platform"
      ? [{ client_id: null, project_id: null }]
      : role.scope === "client"
        ? [{ client_id: clientId, project_id: null }]
        : projectIds.map((projectId) => ({ client_id: clientId, project_id: projectId }));

  const permissionId = grantCategories ? await categoriesPermissionId(supabase) : null;
  if (grantCategories && !permissionId) return { error: "No se encontró el permiso de categorías." };

  for (const scope of scopes) {
    const inserted = await supabase
      .from("memberships")
      .insert({
        user_id: userId,
        client_id: scope.client_id,
        project_id: scope.project_id,
        role_id: role.id,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) return { error: toUserMessage(inserted.error ?? { message: "" }) };
    if (permissionId) {
      const override = await supabase.from("membership_permission_overrides").insert({
        membership_id: inserted.data.id,
        permission_id: permissionId,
        granted: true,
      });
      if (override.error) return { error: toUserMessage(override.error) };
    }
  }

  revalidatePath("/usuarios");
  redirect(`/usuarios/${userId}?ok=1`);
}

export async function updateProfile(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  const parsed = profileSchema.safeParse({
    id: readText(formData, "id"),
    fullName: readText(formData, "fullName"),
    status: access.isSuperAdmin ? readText(formData, "status") : undefined,
  });
  if (!parsed.success) return { error: firstIssue(parsed.error) };

  if (parsed.data.id === access.user.id && parsed.data.status === "inactive") {
    return { error: "No podés desactivar tu propio usuario." };
  }

  const patch: { full_name: string; status?: "active" | "inactive" } = { full_name: parsed.data.fullName };
  if (access.isSuperAdmin && parsed.data.status) patch.status = parsed.data.status;

  const { error } = await supabase.from("profiles").update(patch).eq("id", parsed.data.id);
  if (error) return { error: toUserMessage(error) };
  revalidatePath("/usuarios");
  redirect(`/usuarios/${parsed.data.id}?ok=1`);
}

export async function saveMembership(_state: ActionState, formData: FormData): Promise<ActionState> {
  const { supabase, access } = await getSessionContext();
  const membershipId = readText(formData, "id");
  if (!z.uuid().safeParse(membershipId).success) return { error: "Acceso inválido." };

  const currentResult = await supabase
    .from("memberships")
    .select("id, user_id, client_id, project_id, role_id")
    .eq("id", membershipId)
    .maybeSingle();
  if (currentResult.error) return { error: toUserMessage(currentResult.error) };
  const current = currentResult.data;
  if (!current) return { error: "No se encontró el acceso." };

  const active = readChecked(formData, "active");
  if (!current.client_id) {
    if (current.user_id === access.user.id && !active) {
      return { error: "No podés quitarte tu propio acceso de plataforma." };
    }
    const { error } = await supabase.from("memberships").update({ active }).eq("id", current.id);
    if (error) return { error: toUserMessage(error) };
    revalidatePath("/usuarios");
    redirect(`/usuarios/${current.user_id}?ok=1`);
  }

  const roles = await listRoles(supabase);
  const role = roles.find((item) => item.id === readText(formData, "roleId"));
  if (!role || role.scope === "platform") return { error: "Elegí un rol de cliente o de proyecto." };

  const client = access.clients.find((item) => item.id === current.client_id);
  if (!access.isSuperAdmin && (!client || !client.permissions.includes(PERMISSIONS.usersManage))) {
    return { error: "No podés modificar usuarios de este cliente." };
  }

  let projectId: string | null = null;
  if (role.scope === "project") {
    projectId = readText(formData, "projectId");
    const project = await supabase.from("projects").select("id, client_id").eq("id", projectId).maybeSingle();
    if (project.error) return { error: toUserMessage(project.error) };
    if (!project.data || project.data.client_id !== current.client_id) {
      return { error: "El proyecto no pertenece al cliente." };
    }
  }

  const { error } = await supabase
    .from("memberships")
    .update({
      role_id: role.id,
      project_id: projectId,
      client_id: current.client_id,
      active,
    })
    .eq("id", current.id);
  if (error) return { error: toUserMessage(error) };

  const removed = await supabase.from("membership_permission_overrides").delete().eq("membership_id", current.id);
  if (removed.error) return { error: toUserMessage(removed.error) };

  if (readChecked(formData, "grantCategories") && role.allowsPermissionOverrides) {
    const permissionId = await categoriesPermissionId(supabase);
    if (!permissionId) return { error: "No se encontró el permiso de categorías." };
    const override = await supabase.from("membership_permission_overrides").insert({
      membership_id: current.id,
      permission_id: permissionId,
      granted: true,
    });
    if (override.error) return { error: toUserMessage(override.error) };
  }

  revalidatePath("/", "layout");
  redirect(`/usuarios/${current.user_id}?ok=1`);
}
