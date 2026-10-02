export function parseKeywords(value: string): { keywords: string[]; error?: string } {
  const parts = value
    .split(/[,;\n]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  if (parts.some((part) => part.length > 40)) {
    return { keywords: [], error: "Cada palabra clave puede tener hasta 40 caracteres." };
  }

  const keywords = [...new Set(parts)];
  if (keywords.length > 30) {
    return { keywords: [], error: "Podés cargar hasta 30 palabras clave." };
  }

  return { keywords };
}

export function sanitizeIlike(value: string) {
  return value
    .replace(/[^0-9A-Za-zÁÉÍÓÚÜÑáéíóúüñ ]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

export function safeNextPath(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("://") || value.includes("\\")) {
    return "/";
  }
  return value;
}
