import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { CategoryForm } from "@/components/forms/entity-forms";
import { AccessDenied, QueryBanner, WrongProject } from "@/components/feedback";
import { PageHeader, Panel, StatusBadge } from "@/components/ui/primitives";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { getCategory } from "@/lib/data/records";
import { readParam } from "@/lib/params";

export const metadata: Metadata = { title: "Categoría" };

export default async function CategoryDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { supabase, access, project } = await getSessionContext();
  const category = await getCategory(supabase, id);
  if (!category) notFound();
  const target = access.projects.find((item) => item.id === category.project_id);
  if (!target || !canProject(target, PERMISSIONS.categoriesRead)) return <AccessDenied />;
  if (!project || project.id !== category.project_id) {
    return <WrongProject projectId={category.project_id} label={category.name} next={`/categorias/${category.id}`} />;
  }
  const query = await searchParams;
  const canWrite = canProject(project, PERMISSIONS.categoriesWrite);

  return (
    <>
      <PageHeader title={category.name} description="Categoría del proyecto activo." />
      <QueryBanner error={readParam(query.error)} ok={readParam(query.ok)} />
      {canWrite ? (
        <CategoryForm category={category} />
      ) : (
        <Panel>
          <StatusBadge status={category.active} />
          <p className="mt-3 text-sm leading-6">{category.description || "Sin descripción."}</p>
        </Panel>
      )}
    </>
  );
}
