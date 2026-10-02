export const STATUS_LABELS = {
  active: "Activo",
  inactive: "Inactivo",
} as const;

export const PRIORITY_LABELS = {
  normal: "Normal",
  high: "Alta",
  critical: "Crítica",
} as const;

export const SCOPE_LABELS = {
  platform: "Plataforma",
  client: "Cliente",
  project: "Proyecto",
} as const;

const ACTION_LABELS: Record<string, string> = {
  "clients.created": "creó un cliente",
  "clients.updated": "editó un cliente",
  "clients.status_changed": "cambió el estado de un cliente",
  "projects.created": "creó un proyecto",
  "projects.updated": "editó un proyecto",
  "projects.status_changed": "cambió el estado de un proyecto",
  "categories.created": "creó una categoría",
  "categories.updated": "editó una categoría",
  "categories.status_changed": "cambió el estado de una categoría",
  "knowledge_items.created": "creó contenido",
  "knowledge_items.updated": "editó una respuesta",
  "knowledge_items.status_changed": "cambió el estado de un contenido",
  "memberships.created": "asignó un acceso",
  "memberships.updated": "modificó un acceso",
  "memberships.status_changed": "cambió el estado de un acceso",
  "profiles.created": "registró un usuario",
  "profiles.updated": "editó un usuario",
  "profiles.status_changed": "cambió el estado de un usuario",
  "roles.created": "creó un rol",
  "roles.updated": "editó un rol",
  "roles.permissions_updated": "actualizó permisos de un rol",
};

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

export function matchLevel(score: number) {
  if (score >= 80) return "Alta";
  if (score >= 40) return "Media";
  return "Baja";
}

export function entityHref(entityType: string, entityId: string | null) {
  if (!entityId) return null;
  if (entityType === "clients") return `/clientes/${entityId}`;
  if (entityType === "projects") return `/proyectos/${entityId}`;
  if (entityType === "categories") return `/categorias/${entityId}`;
  if (entityType === "knowledge_items") return `/conocimiento/${entityId}`;
  return null;
}
