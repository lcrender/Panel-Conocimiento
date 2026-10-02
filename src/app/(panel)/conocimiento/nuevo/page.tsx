import type { Metadata } from "next";
import { KnowledgeForm } from "@/components/forms/entity-forms";
import { AccessDenied, ProjectGate } from "@/components/feedback";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";
import { listCategories } from "@/lib/data/records";

export const metadata: Metadata = { title: "Nuevo contenido" };

export default async function NewKnowledgePage() {
  const { supabase, project } = await getSessionContext();
  if (!project) return <ProjectGate project={null}>{null}</ProjectGate>;
  if (!canProject(project, PERMISSIONS.knowledgeWrite)) return <AccessDenied />;
  const categories = await listCategories(supabase, project.id);
  if (categories.length === 0) {
    return (
      <EmptyState
        title="Primero hace falta una categoría"
        body={
          canProject(project, PERMISSIONS.categoriesWrite)
            ? "El contenido se organiza en categorías de este proyecto."
            : "Pedile a un administrador que cree una categoría en este proyecto."
        }
        action={
          canProject(project, PERMISSIONS.categoriesWrite) ? (
            <ButtonLink href="/categorias/nuevo">Nueva categoría</ButtonLink>
          ) : null
        }
      />
    );
  }

  return (
    <>
      <PageHeader title="Nuevo contenido" description={`Se guarda en ${project.name}.`} />
      <KnowledgeForm categories={categories} />
    </>
  );
}
