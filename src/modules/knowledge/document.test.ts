import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  EMBEDDING_DIMENSIONS,
  buildKnowledgeDocument,
  hashKnowledgeDocument,
  matchesKeyword,
  relatedHits,
  selectKnowledgeMatches,
  similarityThreshold,
  toVectorLiteral,
} from "./document";

test("el documento de embedding incluye título, pregunta, respuesta y palabras clave", () => {
  const document = buildKnowledgeDocument({
    title: "Medios de pago",
    question: "¿Cómo puedo pagar?",
    answer: "Podés pagar con tarjeta.",
    keywords: ["tarjeta", "transferencia"],
  });
  assert.match(document, /Medios de pago/);
  assert.match(document, /¿Cómo puedo pagar\?/);
  assert.match(document, /Podés pagar con tarjeta\./);
  assert.match(document, /tarjeta, transferencia/);
});

test("el hash cambia cuando cambia el texto", () => {
  const first = hashKnowledgeDocument("tarjeta");
  const second = hashKnowledgeDocument("tarjetas");
  assert.notEqual(first, second);
  assert.equal(first, hashKnowledgeDocument("tarjeta"));
});

test("el umbral inválido vuelve al valor por defecto", () => {
  const previous = process.env.KNOWLEDGE_SIMILARITY_THRESHOLD;
  process.env.KNOWLEDGE_SIMILARITY_THRESHOLD = "2";
  assert.equal(similarityThreshold(), DEFAULT_SIMILARITY_THRESHOLD);
  process.env.KNOWLEDGE_SIMILARITY_THRESHOLD = "0.42";
  assert.equal(similarityThreshold(), 0.42);
  if (previous === undefined) delete process.env.KNOWLEDGE_SIMILARITY_THRESHOLD;
  else process.env.KNOWLEDGE_SIMILARITY_THRESHOLD = previous;
});

test("solo pasan los resultados que superan el umbral", () => {
  const hits = relatedHits(
    [
      { id: "a", similarity: 0.8 },
      { id: "b", similarity: 0.35 },
      { id: "c", similarity: 0.34 },
    ],
    0.35,
  );
  assert.deepEqual(
    hits.map((hit) => hit.id),
    ["a", "b"],
  );
});

test("una consulta con la palabra clave seña se conserva aunque no llegue al umbral", () => {
  assert.equal(matchesKeyword("¿como dejo la seña?", ["pago", "seña", "tarjeta"]), true);
  const hits = selectKnowledgeMatches(
    [
      {
        id: "pagos",
        similarity: 0.22,
        keywords: ["pago", "seña", "tarjeta"],
      },
      {
        id: "mascotas",
        similarity: 0.21,
        keywords: ["perro"],
      },
    ],
    "¿como dejo la seña?",
    0.35,
  );
  assert.deepEqual(
    hits.map((hit) => hit.id),
    ["pagos"],
  );
});

test("el literal vectorial exige 1536 números finitos", () => {
  const values = Array.from({ length: EMBEDDING_DIMENSIONS }, () => 0.1);
  assert.equal(toVectorLiteral(values).startsWith("[0.1,0.1,"), true);
  assert.throws(() => toVectorLiteral(values.slice(0, 3)));
});
