import type { Metadata } from "next";
import Link from "next/link";
import { AccessDenied, ProjectGate, QueryBanner } from "@/components/feedback";
import { ButtonLink, DataTable, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listCategories } from "@/lib/data/records";
import { formatDate } from "@/lib/format";
import { readParam } from "@/lib/params";
import { setCategoryStatus } from "@/server/actions/categories";

export const metadata: Metadata = { title: "Categorías" };

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { supabase, project } = await getSessionContext();
  return (
    <ProjectGate project={project}>
      {project && canProject(project, PERMISSIONS.categoriesRead) ? (
        <CategoriesContent supabase={supabase} project={project} searchParams={searchParams} />
      ) : (
        <AccessDenied />
      )}
    </ProjectGate>
  );
}

async function CategoriesContent({
  supabase,
  project,
  searchParams,
}: {
  supabase: Awaited<ReturnType<typeof getSessionContext>>["supabase"];
  project: NonNullable<Awaited<ReturnType<typeof getSessionContext>>["project"]>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const categories = await listCategories(supabase, project.id);
  const canWrite = canProject(project, PERMISSIONS.categoriesWrite);

  return (
    <>
      <PageHeader
        title="Categorías"
        description={`Categorías de ${project.name}.`}
        action={canWrite ? <ButtonLink href="/categorias/nuevo">Nueva categoría</ButtonLink> : null}
      />
      <QueryBanner error={readParam(params.error)} ok={readParam(params.ok)} />
      <DataTable
        columns={["Nombre", "Descripción", "Estado", "Actualización", ""]}
        empty="Todavía no hay categorías en este proyecto."
        rows={categories.map((category) => ({
          id: category.id,
          cells: [
            <Link key="name" href={`/categorias/${category.id}`} className="font-medium hover:underline">
              {category.name}
            </Link>,
            <span key="description" className="line-clamp-2 max-w-sm text-muted">
              {category.description || "—"}
            </span>,
            <StatusBadge key="status" status={category.active} />,
            formatDate(category.updated_at),
            canWrite ? (
              <form key="form" action={setCategoryStatus}>
                <input type="hidden" name="id" value={category.id} />
                <input type="hidden" name="active" value={category.active ? "false" : "true"} />
                <SubmitButton variant="secondary" size="sm" pendingLabel="…">
                  {category.active ? "Desactivar" : "Activar"}
                </SubmitButton>
              </form>
            ) : null,
          ],
        }))}
      />
    </>
  );
}
