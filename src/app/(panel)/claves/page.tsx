import type { Metadata } from "next";
import { AccessDenied, QueryBanner } from "@/components/feedback";
import { OpenAIKeyForm, ProjectOpenAIKeyForm } from "@/components/forms/openai-key-form";
import { DataTable, PageHeader, controlClass } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { canClient, canPlatform } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listClientProjectsWithKeys, listOpenAIKeys } from "@/lib/data/openai-keys";
import { listClients } from "@/lib/data/records";
import { readParam } from "@/lib/params";
import { deleteOpenAIKey } from "@/server/actions/openai-keys";

export const metadata: Metadata = { title: "Claves OpenAI" };

export default async function OpenAIKeysPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, access } = await getSessionContext();
  const params = await searchParams;
  const directory = canPlatform(access, PERMISSIONS.integrationsManage)
    ? (await listClients(supabase)).map((client) => ({ id: client.id, name: client.name }))
    : access.clients
        .filter((client) => client.permissions.includes(PERMISSIONS.integrationsManage))
        .map((client) => ({ id: client.id, name: client.name }));

  if (directory.length === 0) return <AccessDenied />;

  const requested = readParam(params.cliente);
  const client = directory.find((item) => item.id === requested) ?? directory[0];
  if (!client || !canClient(access, client.id, PERMISSIONS.integrationsManage)) return <AccessDenied />;

  const [keys, projects] = await Promise.all([
    listOpenAIKeys(supabase, client.id),
    listClientProjectsWithKeys(supabase, client.id),
  ]);
  const projectsByKey = new Map<string, string[]>();
  for (const project of projects) {
    if (!project.keyId) continue;
    projectsByKey.set(project.keyId, [...(projectsByKey.get(project.keyId) ?? []), project.name]);
  }
  const returnTo = `/claves?cliente=${client.id}`;

  return (
    <>
      <PageHeader
        title="Claves OpenAI"
        description={`Las claves pertenecen a ${client.name}. Abajo elegís qué proyecto usa cada una.`}
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok) ? "Clave guardada." : ""} />
      {directory.length > 1 ? (
        <form method="get" className="mb-6 max-w-sm">
          <label className="text-sm font-medium" htmlFor="cliente">
            Cliente
          </label>
          <select id="cliente" name="cliente" defaultValue={client.id} className={`${controlClass} mt-1.5`}>
            {directory.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <button type="submit" className="mt-3 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
            Ver claves
          </button>
        </form>
      ) : null}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <OpenAIKeyForm clientId={client.id} />
        <DataTable
          columns={["Nombre", "Clave", "Proyectos", ""]}
          empty="Este cliente todavía no cargó claves."
          rows={keys.map((key) => ({
            id: key.id,
            cells: [
              key.name,
              key.key_hint,
              projectsByKey.get(key.id)?.join(", ") || "Ningún proyecto",
              <form key="delete" action={deleteOpenAIKey}>
                <input type="hidden" name="clientId" value={client.id} />
                <input type="hidden" name="id" value={key.id} />
                <SubmitButton variant="danger" size="sm" pendingLabel="…">
                  Quitar
                </SubmitButton>
              </form>,
            ],
          }))}
        />
      </div>
      <h2 className="mb-3 mt-8 text-lg font-semibold">Qué proyecto usa cada clave</h2>
      {projects.length === 0 ? (
        <p className="text-sm text-muted">Este cliente todavía no tiene proyectos.</p>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <ProjectOpenAIKeyForm
              key={project.id}
              projectId={project.id}
              projectName={project.name}
              clientId={client.id}
              selectedId={project.keyId}
              returnTo={returnTo}
              keys={keys.map((key) => ({ id: key.id, name: key.name, keyHint: key.key_hint }))}
            />
          ))}
        </div>
      )}
    </>
  );
}
