import { z } from "zod";

const permissionList = z.array(z.string()).default([]);

export const projectAccessSchema = z.object({
  id: z.uuid(),
  clientId: z.uuid(),
  clientName: z.string(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
  permissions: permissionList,
});

export const clientAccessSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  status: z.enum(["active", "inactive"]),
  permissions: permissionList,
});

export const accessSchema = z.object({
  authenticated: z.boolean(),
  active: z.boolean().default(false),
  isSuperAdmin: z.boolean().default(false),
  user: z
    .object({
      id: z.uuid(),
      email: z.string(),
      fullName: z.string(),
    })
    .optional(),
  platformPermissions: permissionList,
  clients: z.array(clientAccessSchema).default([]),
  projects: z.array(projectAccessSchema).default([]),
});

export type AccessSnapshot = z.infer<typeof accessSchema>;
export type ProjectAccess = z.infer<typeof projectAccessSchema>;
export type ClientAccess = z.infer<typeof clientAccessSchema>;

export type ActiveAccess = AccessSnapshot & {
  user: NonNullable<AccessSnapshot["user"]>;
};

export function resolveActiveProject(
  projects: ProjectAccess[],
  cookieValue: string | undefined,
) {
  if (cookieValue) {
    const selected = projects.find((project) => project.id === cookieValue);
    if (selected) return selected;
  }
  return projects.find((project) => project.status === "active") ?? projects[0] ?? null;
}

export function canPlatform(access: AccessSnapshot, permission: string) {
  return access.platformPermissions.includes(permission);
}

export function canAnyClient(access: AccessSnapshot, permission: string) {
  return (
    canPlatform(access, permission) ||
    access.clients.some((client) => client.permissions.includes(permission))
  );
}

export function canProject(project: ProjectAccess | null, permission: string) {
  return project?.permissions.includes(permission) ?? false;
}
