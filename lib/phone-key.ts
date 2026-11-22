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
// Set only when this page has to override inaccessible or read-only storage.
let memoryOverride: string | undefined;

export function readPhoneKey() {
  if (memoryOverride !== undefined) return memoryOverride;
  try {
    const temporary = sessionStorage.getItem(keyName);
    if (temporary !== null) return temporary.trim();
  } catch {}
  try {
    migrateLegacyKey(keyName, legacyKeyName);
    return localStorage.getItem(keyName)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function storePhoneKey(value: string): "local" | "session" | "memory" {
  const key = value.trim();
  memoryOverride = key;
  try {
    if (key) localStorage.setItem(keyName, key);
    else {
      localStorage.removeItem(legacyKeyName);
      localStorage.removeItem(keyName);
    }
    try {
      sessionStorage.removeItem(keyName);
      memoryOverride = undefined;
    } catch {}
    return "local";
  } catch {
    try {
      // An empty value masks an older local key when removal is denied.
      sessionStorage.setItem(keyName, key);
      memoryOverride = undefined;
      return "session";
    } catch {
      return "memory";
    }
  }
}
