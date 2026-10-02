import { z } from "zod";

export type ActionState = { error: string | null };

export const initialActionState: ActionState = { error: null };

export function readText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function readSecret(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export function readChecked(formData: FormData, key: string) {
  const values = formData.getAll(key);
  const last = values.at(-1);
  return last === "true" || last === "on";
}

export function readIds(formData: FormData, key: string) {
  return [
    ...new Set(
      formData
        .getAll(key)
        .filter((value): value is string => typeof value === "string" && z.uuid().safeParse(value).success),
    ),
  ];
}

export function firstIssue(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisá los datos del formulario.";
}
