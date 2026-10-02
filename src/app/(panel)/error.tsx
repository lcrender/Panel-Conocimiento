"use client";

export default function PanelError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="rounded-2xl bg-surface p-6 ring-1 ring-line">
      <h1 className="text-lg font-semibold">No se pudo cargar esta sección</h1>
      <p className="mt-2 text-sm text-muted">Reintentá. Si sigue igual, revisá la conexión con Supabase.</p>
      <button type="button" onClick={reset} className="mt-4 rounded-lg bg-accent px-3 py-2 text-sm text-white">
        Reintentar
      </button>
    </div>
  );
}
