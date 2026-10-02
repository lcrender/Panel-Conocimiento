import { unstable_rethrow } from "next/navigation";
import { AppShell } from "@/components/layout/shell";
import { SetupScreen } from "@/components/setup-screen";
import { navigationFor } from "@/domain/navigation";
import { getSessionContext } from "@/lib/auth/session";
import { ConfigError } from "@/lib/errors";
import { hasSupabaseEnv } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!hasSupabaseEnv()) return <SetupScreen />;

  let session: Awaited<ReturnType<typeof getSessionContext>> | null = null;
  let configMessage: string | null = null;
  try {
    session = await getSessionContext();
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof ConfigError) configMessage = error.message;
    else throw error;
  }

  if (!session) return <SetupScreen message={configMessage ?? undefined} />;

  return (
    <AppShell
      items={navigationFor(session.access, session.project)}
      user={{ fullName: session.access.user.fullName, email: session.access.user.email }}
      project={session.project}
      projects={session.access.projects}
    >
      {children}
    </AppShell>
  );
}
