import assert from "node:assert/strict";
import test from "node:test";
import type { AnswerSource } from "@/modules/ai/types";
import { NO_ANSWER_TEXT, buildAnswerContext, finalizeAnswer } from "./answer-policy";

const payment: AnswerSource = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Medios de pago",
  question: "¿Cómo puedo pagar?",
  answer: "Podés pagar por transferencia bancaria, tarjeta de crédito o débito.",
  categoryName: "Pagos",
  priority: "high",
  allowAiRewrite: true,
  similarity: 0.8,
  keywords: ["tarjeta", "seña"],
};

const address: AnswerSource = {
  ...payment,
  id: "22222222-2222-4222-8222-222222222222",
  title: "Dirección",
  question: "¿Dónde están?",
  answer: "Av. Siempre Viva 123.",
  allowAiRewrite: false,
  keywords: ["dirección"],
};

test("sin fuentes válidas la respuesta queda en no_answer", () => {
  const result = finalizeAnswer(
    {
      status: "answered",
      answer: "Inventé un horario.",
      usedKnowledgeIds: ["fuera-del-proyecto"],
      conflictingKnowledgeIds: [],
      confidence: "high",
    },
    [payment],
  );
  assert.equal(result.status, "no_answer");
  assert.equal(result.answer, NO_ANSWER_TEXT);
  assert.deepEqual(result.usedKnowledgeIds, []);
});

test("un contenido no reformulable se copia de forma textual", () => {
  const result = finalizeAnswer(
    {
      status: "answered",
      answer: "Están cerca del centro.",
      usedKnowledgeIds: [address.id],
      conflictingKnowledgeIds: [],
      confidence: "high",
    },
    [address],
  );
  assert.equal(result.answer, "Av. Siempre Viva 123.");
});

test("un contenido reformulable conserva la redacción del modelo", () => {
  const result = finalizeAnswer(
    {
      status: "answered",
      answer: "Sí, podés pagar con tarjeta de crédito o débito.",
      usedKnowledgeIds: [payment.id],
      conflictingKnowledgeIds: [],
      confidence: "high",
    },
    [payment],
  );
  assert.equal(result.answer, "Sí, podés pagar con tarjeta de crédito o débito.");
  assert.deepEqual(result.usedKnowledgeIds, [payment.id]);
});

test("un conflicto con menos de dos fuentes no elige una respuesta", () => {
  const result = finalizeAnswer(
    {
      status: "conflicting_information",
      answer: "Uso la primera.",
      usedKnowledgeIds: [payment.id],
      conflictingKnowledgeIds: [payment.id],
      confidence: "medium",
    },
    [payment, address],
  );
  assert.equal(result.status, "no_answer");
});

test("el contexto enviado al modelo solo incluye las fuentes recibidas", () => {
  const context = buildAnswerContext("¿Aceptan tarjetas?", [payment]);
  assert.match(context, /Medios de pago/);
  assert.doesNotMatch(context, /Av\. Siempre Viva/);
});
