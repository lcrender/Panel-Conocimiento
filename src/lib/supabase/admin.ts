import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ConfigError } from "@/lib/errors";
import { getSupabaseEnv } from "./env";

// La service role solo se usa en el servidor: crear usuarios de Auth y leer el secreto
// de OpenAI después de que la sesión del usuario autorizó el proyecto.
// Las membresías se insertan con la sesión del administrador, así RLS evalúa su permiso.
export function createAdminClient() {
  const { url } = getSupabaseEnv();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new ConfigError("Falta SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
