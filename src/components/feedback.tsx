import type { ReactNode } from "react";
import { setActiveProject } from "@/server/actions/context";
import { Alert, ButtonLink, EmptyState } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/ui/submit-button";

export function QueryBanner({ error, ok }: { error?: string; ok?: string }) {
  if (error) return <div className="mb-4"><Alert>{error.slice(0, 180)}</Alert></div>;
  if (ok) return <div className="mb-4"><Alert tone="ok">Los cambios quedaron guardados.</Alert></div>;
  return null;
}

export function AccessDenied() {
  return (
    <EmptyState
      title="No tenés acceso a esta sección"
      body="Tu rol no incluye este permiso."
    />
  );
}

export function ProjectGate({ project, children }: { project: unknown; children: ReactNode }) {
  if (!project) {
    return (
      <EmptyState
        title="Todavía no hay un proyecto en tu acceso"
        body="Cuando tengas un proyecto asignado, esta sección muestra su información."
      />
    );
  }
  return children;
}

export function WrongProject({
  projectId,
  label,
  next,
}: {
  projectId: string;
  label: string;
  next: string;
}) {
  return (
    <form action={setActiveProject} className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <h2 className="text-lg font-semibold">Este registro está en otro proyecto</h2>
      <p className="mt-2 text-sm text-muted">{label}</p>
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="next" value={next} />
      <div className="mt-4">
        <SubmitButton>Abrir ese proyecto</SubmitButton>
      </div>
    </form>
  );
}

export function NewLink({ href, children }: { href: string; children: ReactNode }) {
  return <ButtonLink href={href}>{children}</ButtonLink>;
}
