import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ConfigError } from "@/lib/errors";
import { getSupabaseEnv } from "./env";

// Solo para crear o invitar usuarios en Auth.
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
