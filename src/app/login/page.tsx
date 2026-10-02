import type { Metadata } from "next";
import { LoginForm } from "@/components/forms/login-form";
import { SetupScreen } from "@/components/setup-screen";
import { Panel } from "@/components/ui/primitives";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Ingresar" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ motivo?: string }>;
}) {
  if (!hasSupabaseEnv()) return <SetupScreen />;
  const params = await searchParams;
  const notice =
    params.motivo === "inactivo" ? "Tu usuario está desactivado. Pedile a un administrador que lo reactive." : undefined;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <p className="text-xs uppercase tracking-[0.16em] text-muted">Base de conocimiento</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight">Panel de agentes</h1>
      <p className="mt-2 text-sm leading-6 text-muted">
        Cada cliente ve sus proyectos. El acceso llega por invitación.
      </p>
      <div className="mt-6">
        <Panel>
          <LoginForm notice={notice} />
        </Panel>
      </div>
    </main>
  );
}
