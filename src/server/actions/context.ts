"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_PROJECT_COOKIE, getSessionContext, projectCookieOptions } from "@/lib/auth/session";
import { readText } from "@/lib/form";
import { safeNextPath } from "@/lib/validation/keywords";

export async function setActiveProject(formData: FormData) {
  const { access } = await getSessionContext();
  const projectId = readText(formData, "projectId");
  const next = safeNextPath(formData.get("next"));

  if (!access.projects.some((project) => project.id === projectId)) {
    redirect(`/?error=${encodeURIComponent("No tenés acceso a ese proyecto.")}`);
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROJECT_COOKIE, projectId, projectCookieOptions());
  revalidatePath("/", "layout");
  redirect(next);
}
