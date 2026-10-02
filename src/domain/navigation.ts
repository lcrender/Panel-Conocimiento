import {
  canAnyClient,
  canPlatform,
  canProject,
  type AccessSnapshot,
  type ProjectAccess,
} from "./access";
import { PERMISSIONS } from "./permissions";

export type NavItem = {
  href: string;
  label: string;
  group: "operacion" | "administracion";
};

type NavDefinition = NavItem & {
  permission: string | null;
  scope: "always" | "platform" | "client" | "project";
};

const NAV: NavDefinition[] = [
  { href: "/", label: "Inicio", group: "operacion", permission: null, scope: "always" },
  {
    href: "/conocimiento",
    label: "Conocimiento",
    group: "operacion",
    permission: PERMISSIONS.knowledgeRead,
    scope: "project",
  },
  {
    href: "/categorias",
    label: "Categorías",
    group: "operacion",
    permission: PERMISSIONS.categoriesRead,
    scope: "project",
  },
  {
    href: "/probar",
    label: "Probar conocimiento",
    group: "operacion",
    permission: PERMISSIONS.knowledgeRead,
    scope: "project",
  },
  {
    href: "/clientes",
    label: "Clientes",
    group: "administracion",
    permission: PERMISSIONS.clientsRead,
    scope: "platform",
  },
  {
    href: "/proyectos",
    label: "Proyectos",
    group: "administracion",
    permission: PERMISSIONS.projectsRead,
    scope: "client",
  },
  {
    href: "/usuarios",
    label: "Usuarios",
    group: "administracion",
    permission: PERMISSIONS.usersRead,
    scope: "client",
  },
  {
    href: "/roles",
    label: "Roles",
    group: "administracion",
    permission: PERMISSIONS.rolesManage,
    scope: "platform",
  },
  {
    href: "/actividad",
    label: "Actividad",
    group: "administracion",
    permission: PERMISSIONS.activityRead,
    scope: "project",
  },
];

export function navigationFor(access: AccessSnapshot, project: ProjectAccess | null): NavItem[] {
  return NAV.filter((item) => {
    if (item.scope === "always" || item.permission === null) return true;
    if (item.scope === "platform") return canPlatform(access, item.permission);
    if (item.scope === "client") return canAnyClient(access, item.permission);
    return canProject(project, item.permission);
  }).map(({ href, label, group }) => ({ href, label, group }));
}
