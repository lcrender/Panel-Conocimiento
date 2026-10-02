"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { accessSchema } from "@/domain/access";
import { firstIssue, readSecret, readText, type ActionState } from "@/lib/form";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export async function login(_state: ActionState, formData: FormData): Promise<ActionState> {
  if (!hasSupabaseEnv()) return { error: "Falta la configuración de Supabase." };

  const parsed = z
    .object({
      email: z.email("Ingresá un email válido."),
      password: z.string().min(1, "Ingresá la contraseña."),
    })
    .safeParse({
      email: readText(formData, "email").toLowerCase(),
      password: readSecret(formData, "password"),
    });

  if (!parsed.success) return { error: firstIssue(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Email o contraseña incorrectos." };

  const accessResult = await supabase.rpc("my_access");
  if (accessResult.error) {
    await supabase.auth.signOut();
    return { error: "No se pudo validar el acceso. Revisá que la migración esté aplicada." };
  }

  const access = accessSchema.safeParse(accessResult.data);
  if (!access.success || !access.data.active) {
    await supabase.auth.signOut();
    return { error: "Tu usuario está desactivado." };
  }

  redirect("/");
}

export async function signOut() {
  if (hasSupabaseEnv()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
