import { z } from "zod";

export const clientSchema = z.object({
  name: z.string().trim().min(2, "El nombre necesita al menos 2 caracteres.").max(120, "El nombre es demasiado largo."),
  status: z.enum(["active", "inactive"], { error: "Elegí un estado." }),
});

export const projectSchema = z.object({
  clientId: z.uuid("Elegí un cliente."),
  name: z.string().trim().min(2, "El nombre necesita al menos 2 caracteres.").max(120, "El nombre es demasiado largo."),
  description: z.string().trim().max(2000, "La descripción es demasiado larga."),
  status: z.enum(["active", "inactive"], { error: "Elegí un estado." }),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, "El nombre necesita al menos 2 caracteres.").max(120, "El nombre es demasiado largo."),
  description: z.string().trim().max(2000, "La descripción es demasiado larga."),
  active: z.boolean(),
});

export const knowledgeSchema = z.object({
  title: z.string().trim().min(2, "El título necesita al menos 2 caracteres.").max(140, "El título es demasiado largo."),
  question: z.string().trim().min(3, "La pregunta necesita al menos 3 caracteres.").max(400, "La pregunta es demasiado larga."),
  answer: z.string().trim().min(2, "La respuesta está vacía.").max(8000, "La respuesta es demasiado larga."),
  categoryId: z.uuid("Elegí una categoría."),
  priority: z.enum(["normal", "high", "critical"], { error: "Elegí una prioridad." }),
  allowAiRewrite: z.boolean(),
  active: z.boolean(),
});

export const roleSchema = z.object({
  name: z.string().trim().min(2, "El nombre necesita al menos 2 caracteres.").max(80, "El nombre es demasiado largo."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_]{1,40}$/, "Usá minúsculas, números y guion bajo. Empezá con una letra."),
  description: z.string().trim().max(300, "La descripción es demasiado larga."),
  scope: z.enum(["platform", "client", "project"], { error: "Elegí el alcance del rol." }),
  allowsOverrides: z.boolean(),
});

export const profileSchema = z.object({
  id: z.uuid(),
  fullName: z.string().trim().min(2, "El nombre necesita al menos 2 caracteres.").max(120, "El nombre es demasiado largo."),
  status: z.enum(["active", "inactive"]).optional(),
});
