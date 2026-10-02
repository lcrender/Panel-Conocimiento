import { ButtonLink } from "@/components/ui/primitives";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6">
      <h1 className="text-2xl font-semibold">No se encontró la página</h1>
      <p className="mt-2 text-sm text-muted">El registro no existe o no está en tu acceso.</p>
      <div className="mt-5">
        <ButtonLink href="/">Volver al inicio</ButtonLink>
      </div>
    </main>
  );
}
