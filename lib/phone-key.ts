const keyName = "oustad-walid.gemini-key",
  legacyKeyName = "oustad-amin.gemini-key";
// Carries data saved under the persona's previous storage prefix.
export function migrateLegacyKey(current: string, legacy: string) {
  try {
    const old = localStorage.getItem(legacy);
    if (old !== null) {
      if (localStorage.getItem(current) === null)
        localStorage.setItem(current, old);
      localStorage.removeItem(legacy);
    }
  } catch {}
}
export function readPhoneKey() {
  try {
    migrateLegacyKey(keyName, legacyKeyName);
    return localStorage.getItem(keyName)?.trim() ?? "";
  } catch {
    return "";
  }
}
export function storePhoneKey(value: string) {
  const key = value.trim();
  if (key && !/^[A-Za-z0-9_-]{10,256}$/.test(key))
    throw new Error("Invalid key format");
  if (key) localStorage.setItem(keyName, key);
  else localStorage.removeItem(keyName);
}
