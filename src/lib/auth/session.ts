import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  accessSchema,
  resolveActiveProject,
  type ActiveAccess,
  type ProjectAccess,
} from "@/domain/access";
import { ConfigError } from "@/lib/errors";
import { createClient, type DbClient } from "@/lib/supabase/server";

export const ACTIVE_PROJECT_COOKIE = "pa_active_project";

export type SessionContext = {
  supabase: DbClient;
  access: ActiveAccess;
  project: ProjectAccess | null;
};

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.rpc("my_access");
  if (error) {
    console.error(error.message);
    throw new ConfigError(
      "No se pudo leer el acceso. Confirmá que la migración esté aplicada en Supabase.",
    );
  }

  const parsed = accessSchema.safeParse(data);
  if (!parsed.success) {
    console.error(parsed.error);
    throw new ConfigError("El acceso devolvió un formato inesperado. Volvé a aplicar la migración.");
  }

  if (!parsed.data.active || !parsed.data.user) {
    await supabase.auth.signOut();
    redirect("/login?motivo=inactivo");
  }

  const cookieStore = await cookies();
  const project = resolveActiveProject(
    parsed.data.projects,
    cookieStore.get(ACTIVE_PROJECT_COOKIE)?.value,
  );

  return {
    supabase,
    access: { ...parsed.data, user: parsed.data.user },
    project,
  };
});

export function projectCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
