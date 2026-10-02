import type { Metadata } from "next";
import { CategoryForm } from "@/components/forms/entity-forms";
import { AccessDenied, ProjectGate } from "@/components/feedback";
import { PageHeader } from "@/components/ui/primitives";
import { canProject } from "@/domain/access";
import { PERMISSIONS } from "@/domain/permissions";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Nueva categoría" };

export default async function NewCategoryPage() {
  const { project } = await getSessionContext();
  return (
    <ProjectGate project={project}>
      {project && canProject(project, PERMISSIONS.categoriesWrite) ? (
        <>
          <PageHeader title="Nueva categoría" description={`Se crea en ${project.name}.`} />
          <CategoryForm />
        </>
      ) : (
        <AccessDenied />
      )}
    </ProjectGate>
  );
}
