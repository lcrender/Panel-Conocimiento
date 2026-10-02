import "server-only";
import { z } from "zod";
import { DataError } from "@/lib/errors";

export function parseRows<T>(schema: z.ZodType<T>, rows: unknown): T[] {
  const parsed = z.array(schema).safeParse(rows ?? []);
  if (!parsed.success) {
    console.error(parsed.error);
    throw new DataError("La base devolvió un formato inesperado.");
  }
  return parsed.data;
}

export function parseRow<T>(schema: z.ZodType<T>, row: unknown): T {
  const parsed = schema.safeParse(row);
  if (!parsed.success) {
    console.error(parsed.error);
    throw new DataError("La base devolvió un formato inesperado.");
  }
  return parsed.data;
}

export function embedName(value: unknown) {
  if (!value) return null;
  if (Array.isArray(value)) return embedName(value[0]);
  if (typeof value === "object" && "name" in value && typeof value.name === "string") return value.name;
  return null;
}

export function failQuery(error: { message: string }): never {
  console.error(error.message);
  throw new DataError();
}
