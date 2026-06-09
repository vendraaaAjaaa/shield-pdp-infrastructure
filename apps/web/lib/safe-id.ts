const uuidLikePattern = "10000000-1000-4000-8000-100000000000";

// Demo UI/request/correlation IDs only. Do not use this helper for access
// tokens, refresh tokens, passwords, cryptographic keys, or other secrets.
export function safeClientId(prefix: "req" | "ui" | "correlation" | string = "ui") {
  return `${prefix}-${safeUuidLikeId()}`;
}

function safeUuidLikeId() {
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi?.getRandomValues === "function") {
    return uuidLikePattern.replace(/[018]/g, (character) => {
      const randomByte = cryptoApi.getRandomValues(new Uint8Array(1))[0];
      const value = Number(character) ^ (randomByte & (15 >> (Number(character) / 4)));
      return value.toString(16);
    });
  }

  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 14);
  return `${timestamp}-${random}`;
}
