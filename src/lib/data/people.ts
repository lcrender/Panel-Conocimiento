import "server-only";
import { z } from "zod";
import { embedName, failQuery, parseRows } from "@/lib/data/common";
import type { DbClient } from "@/lib/supabase/server";

const roleRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  scope: z.enum(["platform", "client", "project"]),
  allows_permission_overrides: z.boolean(),
  role_permissions: z
    .array(
      z.object({
        permissions: z.unknown(),
      }),
    )
    .nullable()
    .optional()
    .transform((value) => value ?? []),
});

const permissionRow = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  description: z.string(),
  sort_order: z.number(),
});

const userRow = z.object({
  id: z.uuid(),
  email: z.string(),
  full_name: z.string(),
  status: z.enum(["active", "inactive"]),
  created_at: z.string(),
  memberships: z
    .array(
      z.object({
        id: z.uuid(),
        client_id: z.uuid().nullable(),
        project_id: z.uuid().nullable(),
        active: z.boolean(),
        role_id: z.uuid(),
        roles: z.unknown(),
        clients: z.unknown(),
        projects: z.unknown(),
        membership_permission_overrides: z
          .array(
            z.object({
              granted: z.boolean(),
              permissions: z.unknown(),
            }),
          )
          .nullable()
          .optional(),
      }),
    )
    .nullable()
    .optional()
    .transform((value) => value ?? []),
});

const roleEmbed = z.object({
  slug: z.string(),
  name: z.string(),
  scope: z.enum(["platform", "client", "project"]),
  allows_permission_overrides: z.boolean(),
});

function permissionSlug(value: unknown) {
  const record = Array.isArray(value) ? value[0] : value;
  if (!record || typeof record !== "object" || !("slug" in record)) return null;
  return typeof record.slug === "string" ? record.slug : null;
}

export type RoleRecord = {
  id: string;
  slug: string;
  name: string;
  description: string;
  scope: "platform" | "client" | "project";
  allowsPermissionOverrides: boolean;
  permissionSlugs: string[];
};

export type MembershipRecord = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  active: boolean;
  roleId: string;
  roleName: string;
  roleSlug: string;
  scope: "platform" | "client" | "project";
  allowsPermissionOverrides: boolean;
  grantCategories: boolean;
};

export type UserRecord = {
  id: string;
  email: string;
  fullName: string;
  status: "active" | "inactive";
  createdAt: string;
  memberships: MembershipRecord[];
};

export type PermissionRecord = z.infer<typeof permissionRow>;

function mapRole(row: z.infer<typeof roleRow>): RoleRecord {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    scope: row.scope,
    allowsPermissionOverrides: row.allows_permission_overrides,
    permissionSlugs: row.role_permissions.flatMap((item) => {
      const slug = permissionSlug(item.permissions);
      return slug ? [slug] : [];
    }),
  };
}

function mapUser(row: z.infer<typeof userRow>): UserRecord {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    createdAt: row.created_at,
    memberships: row.memberships.flatMap((membership) => {
      const roleSource = Array.isArray(membership.roles) ? membership.roles[0] : membership.roles;
      const role = roleEmbed.safeParse(roleSource);
      if (!role.success) return [];
      const overrides = membership.membership_permission_overrides ?? [];
      return [
        {
          id: membership.id,
          clientId: membership.client_id,
          clientName: embedName(membership.clients),
          projectId: membership.project_id,
          projectName: embedName(membership.projects),
          active: membership.active,
          roleId: membership.role_id,
          roleName: role.data.name,
          roleSlug: role.data.slug,
          scope: role.data.scope,
          allowsPermissionOverrides: role.data.allows_permission_overrides,
          grantCategories: overrides.some(
            (override) => override.granted && permissionSlug(override.permissions) === "categories.write",
          ),
        },
      ];
    }),
  };
}

export async function listRoles(supabase: DbClient) {
  const { data, error } = await supabase
    .from("roles")
    .select(
      "id, slug, name, description, scope, allows_permission_overrides, role_permissions(permissions(slug))",
    )
    .order("sort_order");
  if (error) failQuery(error);
  return parseRows(roleRow, data).map(mapRole);
}

export async function listPermissions(supabase: DbClient) {
  const { data, error } = await supabase
    .from("permissions")
    .select("id, slug, name, description, sort_order")
    .order("sort_order");
  if (error) failQuery(error);
  return parseRows(permissionRow, data);
}

export async function listUsers(supabase: DbClient) {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      `id, email, full_name, status, created_at,
       memberships (
         id, client_id, project_id, active, role_id,
         roles ( slug, name, scope, allows_permission_overrides ),
         clients ( name ),
         projects ( name ),
         membership_permission_overrides ( granted, permissions ( slug ) )
       )`,
    )
    .order("full_name");
  if (error) failQuery(error);
  return parseRows(userRow, data).map(mapUser);
}

export async function getUser(supabase: DbClient, id: string) {
  const users = await listUsers(supabase);
  return users.find((user) => user.id === id) ?? null;
}
