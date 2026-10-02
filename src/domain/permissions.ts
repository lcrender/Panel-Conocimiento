// Estos identificadores se siembran en supabase/migrations/20261002120000_init.sql.
// Si se agrega un permiso, hay que sumarlo en los dos lugares.

export const PERMISSIONS = {
  clientsRead: "clients.read",
  clientsWrite: "clients.write",
  projectsRead: "projects.read",
  projectsWrite: "projects.write",
  usersRead: "users.read",
  usersManage: "users.manage",
  rolesManage: "roles.manage",
  categoriesRead: "categories.read",
  categoriesWrite: "categories.write",
  knowledgeRead: "knowledge.read",
  knowledgeWrite: "knowledge.write",
  activityRead: "activity.read",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LIST = Object.values(PERMISSIONS);
