import assert from "node:assert/strict";
import test from "node:test";
import { isOpenAIKey, openAIKeyHint } from "./key";

test("la pista de la clave muestra solo los últimos cuatro caracteres", () => {
  assert.equal(openAIKeyHint("sk-proj-1234567890abcd"), "••••abcd");
  assert.equal(isOpenAIKey("sk-proj-1234567890abcd"), true);
  assert.equal(isOpenAIKey("no-es-una-clave"), false);
});
