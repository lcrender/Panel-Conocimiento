import "server-only";
import { z } from "zod";
import { createEmbedding } from "@/modules/knowledge/openai";
import type { AIProvider, AnswerGenerationInput, RawModelAnswer } from "@/modules/ai/types";

const rawAnswerSchema = z.object({
  status: z.enum(["answered", "no_answer", "clarification_needed", "conflicting_information"]),
  answer: z.string(),
  used_knowledge_ids: z.array(z.string()),
  conflicting_knowledge_ids: z.array(z.string()),
  confidence: z.enum(["high", "medium", "low"]),
});

export class AnswerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnswerError";
  }
}

async function openAI(path: string, apiKey: string, body: unknown, missingKeyMessage: string) {
  const key = apiKey.trim();
  if (!key) throw new AnswerError(missingKeyMessage);

  let response: Response;
  try {
    response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new AnswerError("No se pudo conectar con OpenAI.");
  }

  if (response.status === 401) throw new AnswerError("La clave de OpenAI fue rechazada.");
  if (response.status === 429) throw new AnswerError("OpenAI limitó la solicitud. Probá de nuevo en un momento.");
  if (!response.ok) throw new AnswerError("OpenAI no pudo completar la solicitud.");
  return response.json();
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";

  generateEmbedding(input: string, apiKey: string) {
    return createEmbedding(input, apiKey);
  }

  async generateAnswer(input: AnswerGenerationInput): Promise<RawModelAnswer> {
    const payload = await openAI(
      "chat/completions",
      input.apiKey,
      {
        model: input.model,
        temperature: input.temperature,
        messages: [
          { role: "system", content: input.systemPrompt },
          { role: "user", content: input.userMessage },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "knowledge_answer",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              required: ["status", "answer", "used_knowledge_ids", "conflicting_knowledge_ids", "confidence"],
              properties: {
                status: {
                  type: "string",
                  enum: ["answered", "no_answer", "clarification_needed", "conflicting_information"],
                },
                answer: { type: "string" },
                used_knowledge_ids: { type: "array", items: { type: "string" } },
                conflicting_knowledge_ids: { type: "array", items: { type: "string" } },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
              },
            },
          },
        },
      },
      "Este proyecto no tiene una clave de OpenAI seleccionada.",
    );

    const content = z.object({
      choices: z.array(z.object({ message: z.object({ content: z.string() }) })).min(1),
    }).safeParse(payload);
    if (!content.success) throw new AnswerError("OpenAI devolvió una respuesta inválida.");

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(content.data.choices[0].message.content);
    } catch {
      throw new AnswerError("OpenAI devolvió una respuesta inválida.");
    }

    const raw = rawAnswerSchema.safeParse(parsedJson);
    if (!raw.success) throw new AnswerError("OpenAI devolvió una respuesta inválida.");
    return {
      status: raw.data.status,
      answer: raw.data.answer,
      usedKnowledgeIds: raw.data.used_knowledge_ids,
      conflictingKnowledgeIds: raw.data.conflicting_knowledge_ids,
      confidence: raw.data.confidence,
    };
  }
}

export function getAIProvider(): AIProvider {
  return new OpenAIProvider();
}
