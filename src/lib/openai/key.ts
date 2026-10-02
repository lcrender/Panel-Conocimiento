export function openAIKeyHint(secret: string) {
  return `••••${secret.trim().slice(-4)}`;
}

export function isOpenAIKey(secret: string) {
  const value = secret.trim();
  return value.startsWith("sk-") && value.length >= 20 && value.length <= 300 && !/\s/.test(value);
}
