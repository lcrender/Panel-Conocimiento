import { createHash } from "node:crypto";

export const EMBEDDING_MODEL = "text-embedding-3-small";
export const EMBEDDING_DIMENSIONS = 1536;
export const DEFAULT_SIMILARITY_THRESHOLD = 0.35;
export const SEMANTIC_MATCH_COUNT = 5;

const MAX_DOCUMENT_CHARS = 8000;

export function buildKnowledgeDocument(input: {
  title: string;
  question: string;
  answer: string;
  keywords: string[];
}) {
  const keywords = input.keywords.map((keyword) => keyword.trim()).filter(Boolean).join(", ");
  return [
    `Título: ${input.title.trim()}`,
    `Pregunta: ${input.question.trim()}`,
    `Respuesta: ${input.answer.trim()}`,
    `Palabras clave: ${keywords}`,
  ]
    .join("\n")
    .slice(0, MAX_DOCUMENT_CHARS);
}

export function hashKnowledgeDocument(document: string) {
  return createHash("sha256").update(document).digest("hex");
}

export function similarityThreshold() {
  const raw = process.env.KNOWLEDGE_SIMILARITY_THRESHOLD;
  if (!raw?.trim()) return DEFAULT_SIMILARITY_THRESHOLD;
  return parseSimilarityThresholdInput(raw) ?? DEFAULT_SIMILARITY_THRESHOLD;
}

export function parseSimilarityThresholdInput(raw: string) {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const value = Number(trimmed);
  if (!Number.isFinite(value) || value < 0 || value > 1) return null;
  return Math.round(value * 1000) / 1000;
}

export function toVectorLiteral(values: number[]) {
  if (values.length !== EMBEDDING_DIMENSIONS || values.some((value) => !Number.isFinite(value))) {
    throw new Error("El embedding no tiene la dimensión esperada.");
  }
  return `[${values.join(",")}]`;
}

const STOPWORDS = new Set([
  "de", "la", "el", "los", "las", "un", "una", "unos", "unas", "y", "o", "u", "en", "con", "por", "para",
  "que", "es", "del", "al", "como", "puedo", "puede", "se", "su", "sus", "mi", "me", "te", "lo", "le",
  "hay", "son", "esta", "este", "esto", "esa", "ese", "a", "the", "and", "or", "donde", "cuando",
]);

const ACCENTED = "ÁÉÍÓÚÜÑáéíóúüñ";
const PLAIN = "AEIOUUNaeiouun";

export function normalizeSearchText(input: string) {
  let text = "";
  for (const char of input) {
    const index = ACCENTED.indexOf(char);
    text += index >= 0 ? PLAIN[index] : char;
  }
  return text.toLowerCase().replaceAll("%", "").replaceAll("_", "");
}

export function queryTokens(query: string) {
  return [...new Set(normalizeSearchText(query).split(/[^a-z0-9]+/))].filter(
    (token) => token.length >= 3 && !STOPWORDS.has(token),
  );
}

function keywordForms(keyword: string) {
  const normalized = normalizeSearchText(keyword).replace(/[^a-z0-9]+/g, "");
  if (normalized.length < 4) return normalized ? [normalized] : [];
  return [normalized, `${normalized}s`, `${normalized}es`];
}

export function matchesKeyword(query: string, keywords: string[]) {
  const tokens = new Set(queryTokens(query));
  return keywords.some((keyword) => keywordForms(keyword).some((form) => tokens.has(form)));
}

export function relatedHits<T extends { similarity: number }>(hits: T[], threshold: number) {
  return hits.filter((hit) => hit.similarity >= threshold).slice(0, SEMANTIC_MATCH_COUNT);
}

export function selectKnowledgeMatches<T extends { id: string; similarity: number | null; keywords: string[] }>(
  hits: T[],
  query: string,
  threshold: number,
  limit = SEMANTIC_MATCH_COUNT,
) {
  const selected = hits.filter(
    (hit) => (hit.similarity !== null && hit.similarity >= threshold) || matchesKeyword(query, hit.keywords),
  );
  selected.sort((left, right) => (right.similarity ?? -1) - (left.similarity ?? -1));
  return selected.slice(0, limit);
}
