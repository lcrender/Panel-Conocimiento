import "server-only";
import { z } from "zod";
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from "@/modules/knowledge/document";

const embeddingResponse = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()) })).min(1),
});

export class EmbeddingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmbeddingError";
  }
}

export function hasOpenAIEnv() {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function createEmbedding(input: string) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new EmbeddingError("Falta OPENAI_API_KEY para generar el embedding.");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input,
        dimensions: EMBEDDING_DIMENSIONS,
        encoding_format: "float",
      }),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new EmbeddingError("No se pudo conectar con OpenAI para generar el embedding.");
  }

  if (response.status === 401) throw new EmbeddingError("La clave de OpenAI fue rechazada.");
  if (response.status === 429) {
    throw new EmbeddingError("OpenAI limitó la solicitud. Probá de nuevo en un momento.");
  }
  if (!response.ok) throw new EmbeddingError("No se pudo generar el embedding.");

  const parsed = embeddingResponse.safeParse(await response.json());
  const embedding = parsed.success ? parsed.data.data[0]?.embedding : null;
  if (!embedding || embedding.length !== EMBEDDING_DIMENSIONS || embedding.some((value) => !Number.isFinite(value))) {
    throw new EmbeddingError("OpenAI devolvió un embedding inválido.");
  }
  return embedding;
}
