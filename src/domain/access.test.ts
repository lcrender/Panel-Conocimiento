import assert from "node:assert/strict";
import test from "node:test";
import { resolveActiveProject, type AccessSnapshot, type ProjectAccess } from "./access";
import { navigationFor } from "./navigation";
import { PERMISSIONS } from "./permissions";

function project(partial: Partial<ProjectAccess> & Pick<ProjectAccess, "id" | "permissions">): ProjectAccess {
  return {
    clientId: "11111111-1111-4111-8111-111111111111",
    clientName: "Empresa ABC",
    name: "Hotel",
    status: "active",
    ...partial,
  };
}

const baseAccess: AccessSnapshot = {
  authenticated: true,
  active: true,
  isSuperAdmin: false,
  user: {
    id: "22222222-2222-4222-8222-222222222222",
    email: "ana@example.com",
    fullName: "Ana",
  },
  platformPermissions: [],
  clients: [],
  projects: [],
};

test("una cookie de otro proyecto no se acepta", () => {
  const visible = project({
    id: "33333333-3333-4333-8333-333333333333",
    permissions: [PERMISSIONS.knowledgeRead],
  });
  const selected = resolveActiveProject([visible], "99999999-9999-4999-8999-999999999999");
  assert.equal(selected?.id, visible.id);
});

test("el editor no ve clientes ni roles", () => {
  const active = project({
    id: "33333333-3333-4333-8333-333333333333",
    permissions: [PERMISSIONS.projectsRead, PERMISSIONS.categoriesRead, PERMISSIONS.knowledgeRead, PERMISSIONS.knowledgeWrite],
  });
  const access: AccessSnapshot = {
    ...baseAccess,
    clients: [
      {
        id: active.clientId,
        name: active.clientName,
        status: "active",
        permissions: active.permissions,
      },
    ],
    projects: [active],
  };
  const labels = navigationFor(access, active).map((item) => item.label);
  assert.deepEqual(labels, ["Inicio", "Conocimiento", "Categorías", "Probar conocimiento", "Proyectos"]);
});

test("el super admin ve la administración de la plataforma", () => {
  const active = project({
    id: "33333333-3333-4333-8333-333333333333",
    permissions: Object.values(PERMISSIONS),
  });
  const access: AccessSnapshot = {
    ...baseAccess,
    isSuperAdmin: true,
    platformPermissions: Object.values(PERMISSIONS),
    clients: [
      {
        id: active.clientId,
        name: active.clientName,
        status: "active",
        permissions: Object.values(PERMISSIONS),
      },
    ],
    projects: [active],
  };
  const labels = navigationFor(access, active).map((item) => item.label);
  assert.ok(labels.includes("Clientes"));
  assert.ok(labels.includes("Roles"));
  assert.ok(labels.includes("Usuarios"));
});
