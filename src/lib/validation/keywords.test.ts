import assert from "node:assert/strict";
import test from "node:test";
import { parseKeywords, safeNextPath, sanitizeIlike } from "./keywords";

test("normaliza palabras clave", () => {
  const parsed = parseKeywords("Pago, tarjeta, pago\nefectivo");
  assert.deepEqual(parsed.keywords, ["pago", "tarjeta", "efectivo"]);
});

test("rechaza una ruta externa", () => {
  assert.equal(safeNextPath("https://example.com"), "/");
  assert.equal(safeNextPath("//example.com"), "/");
  assert.equal(safeNextPath("/conocimiento/1"), "/conocimiento/1");
});

test("limpia caracteres que alteran un filtro", () => {
  assert.equal(sanitizeIlike("pago%, (tarjeta)"), "pago tarjeta");
});
