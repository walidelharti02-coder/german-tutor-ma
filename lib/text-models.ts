import { z } from "zod";

// Strongest first. Limits are the free-tier allowances this app plans around.
export const textModels = [
  { id: "gemini-3.8-flash", rpd: 20, rpm: 5, json: true },
  { id: "gemini-3.6-flash", rpd: 20, rpm: 5, json: true },
  { id: "gemini-3-flash", rpd: 20, rpm: 5, json: true },
  { id: "gemini-2.5-flash", rpd: 20, rpm: 5, json: true },
  { id: "gemini-3.5-flash-lite", rpd: 500, rpm: 15, json: true },
  { id: "gemini-3.1-flash-lite", rpd: 500, rpm: 15, json: true },
  // Gemma has no JSON mode or system instruction, so its reply is parsed by regex.
  { id: "gemma-4-31b", rpd: 14400, rpm: 30, json: false },
] as const;
export type TextModelId = (typeof textModels)[number]["id"];

export const RPM_COOLDOWN_MS = 65_000;
// A 429 on the first retry within this window after a cooldown means the daily quota is spent.
export const RETRY_WINDOW_MS = 10 * 60_000;

export const modelEntrySchema = z.object({
  cooldownUntil: z.number().finite().optional(),
  exhaustedUntil: z.number().finite().optional(),
});
export type ModelEntry = z.infer<typeof modelEntrySchema>;
export const modelStateSchema = z.record(z.string().max(64), modelEntrySchema);
export type ModelState = z.infer<typeof modelStateSchema>;

export function nextUtcMidnight(now = Date.now()) {
  const d = new Date(now);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
}

export function isAvailable(entry: ModelEntry | undefined, now = Date.now()) {
  if (!entry) return true;
  if (entry.exhaustedUntil && entry.exhaustedUntil > now) return false;
  if (entry.cooldownUntil && entry.cooldownUntil > now) return false;
  return true;
}

// Drops expired and unknown entries so the stored state stays small.
export function pruneState(state: ModelState, now = Date.now()): ModelState {
  const known = new Set<string>(textModels.map((m) => m.id));
  const out: ModelState = {};
  for (const [id, e] of Object.entries(state)) {
    if (!known.has(id)) continue;
    const entry: ModelEntry = {};
    if (e.exhaustedUntil && e.exhaustedUntil > now)
      entry.exhaustedUntil = e.exhaustedUntil;
    // Keep an expired cooldown inside the retry window to detect a repeat 429.
    if (e.cooldownUntil && e.cooldownUntil + RETRY_WINDOW_MS > now)
      entry.cooldownUntil = e.cooldownUntil;
    if (entry.exhaustedUntil || entry.cooldownUntil) out[id] = entry;
  }
  return out;
}

// First 429 rests the model 65 s. A 429 on the retry right after that rest,
// or an explicit per-day quota error, marks it spent until 00:00 UTC.
export function markRateLimited(
  state: ModelState,
  id: string,
  daily: boolean,
  now = Date.now(),
): ModelState {
  const prev = state[id];
  const retriedAfterCooldown =
    prev?.cooldownUntil !== undefined &&
    prev.cooldownUntil <= now &&
    now - prev.cooldownUntil < RETRY_WINDOW_MS;
  if (daily || retriedAfterCooldown)
    return { ...state, [id]: { exhaustedUntil: nextUtcMidnight(now) } };
  return { ...state, [id]: { cooldownUntil: now + RPM_COOLDOWN_MS } };
}

export function markSucceeded(state: ModelState, id: string): ModelState {
  if (!state[id]) return state;
  const next = { ...state };
  delete next[id];
  return next;
}

const stateKey = "oustad-walid.text-models.v1";
export function readModelState(): ModelState {
  try {
    const parsed = modelStateSchema.safeParse(
      JSON.parse(localStorage.getItem(stateKey) || "{}"),
    );
    return parsed.success ? pruneState(parsed.data) : {};
  } catch {
    return {};
  }
}
export function storeModelState(state: ModelState) {
  try {
    localStorage.setItem(stateKey, JSON.stringify(pruneState(state)));
  } catch {}
}
