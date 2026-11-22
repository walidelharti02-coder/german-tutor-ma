import { GoogleGenAI, Type } from "@google/genai";
import { usesSqlite } from "@/lib/storage-mode";
import {
  textModels,
  isAvailable,
  markRateLimited,
  markSucceeded,
  pruneState,
  type ModelState,
} from "@/lib/text-models";
import {
  requestSchema,
  replySchema,
  mockReply,
  modeNames,
  scenarios,
  type Reply,
} from "@/lib/tutor";
export const maxDuration = 60;
export const runtime = "nodejs";
// Leave headroom under maxDuration for the database write and response.
const budgetMs = 45_000;
const str = { type: Type.STRING };
const schema = {
  type: Type.OBJECT,
  required: ["germanReply", "darijaNote", "mistakes"],
  properties: {
    germanReply: str,
    darijaNote: str,
    mistakes: {
      type: Type.ARRAY,
      maxItems: 2,
      items: {
        type: Type.OBJECT,
        required: [
          "sentence",
          "correctedSentence",
          "errorType",
          "explanationDarija",
        ],
        properties: {
          sentence: str,
          correctedSentence: str,
          errorType: {
            type: Type.STRING,
            enum: [
              "artikel",
              "case",
              "word_order",
              "vocabulary",
              "pronunciation",
              "style",
            ],
          },
          explanationDarija: str,
        },
      },
    },
  },
};
// Gemma answers in free text. Take the outermost JSON object it wrote.
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const object = source.match(/\{[\s\S]*\}/)?.[0];
  if (!object) throw new Error("No JSON object in reply");
  return JSON.parse(object);
}
// Keep the strict reply fields and at most two corrections; drop extra keys.
function normalize(raw: unknown): Reply {
  const r = (raw ?? {}) as Record<string, unknown>;
  const mistakes = Array.isArray(r.mistakes) ? r.mistakes.slice(0, 2) : [];
  return replySchema.parse({
    germanReply: r.germanReply,
    darijaNote: typeof r.darijaNote === "string" ? r.darijaNote : "",
    mistakes: mistakes.map((m) => {
      const x = (m ?? {}) as Record<string, unknown>;
      return {
        sentence: x.sentence,
        correctedSentence: x.correctedSentence,
        errorType: x.errorType,
        explanationDarija: x.explanationDarija ?? "",
      };
    }),
  });
}
function rateLimit(cause: unknown) {
  const c = cause as { status?: number; code?: number; message?: string };
  const message = String(c?.message ?? "");
  const limited =
    c?.status === 429 ||
    c?.code === 429 ||
    /resource.?exhausted|rate.?limit|too many requests|\b429\b/i.test(message);
  if (!limited) return null;
  return { daily: /per.?day|perday|daily/i.test(message) };
}
export async function POST(req: Request) {
  const result = requestSchema.safeParse(await req.json().catch(() => null));
  if (!result.success)
    return Response.json({ error: "Invalid tutor turn" }, { status: 400 });
  const t = result.data;
  const local = usesSqlite() ? await import("@/lib/db") : null;
  const level = local
    ? (
        await local.db.user.findUniqueOrThrow({
          where: { id: local.userId },
          select: { level: true },
        })
      ).level
    : "A1";
  const key =
    req.headers.get("x-gemini-api-key")?.trim() ||
    t.apiKey ||
    process.env.GEMINI_API_KEY?.trim();
  const started = Date.now();
  let state: ModelState = pruneState(t.modelState, started);
  let reply: Reply = mockReply(t),
    source = "mock",
    activeModel = "mock";
  const instruction = `You are Oustad Walid, a patient, encouraging Moroccan teacher living in Germany. Level ${level}. A1-A2: 60% simple German / 40% Moroccan Darija. B1-B2: 85% German / 15% Darija. C1-C2: 100% professional German, empty Darija note, explanations in German. Use Arabic script for Darija. Give a short practical German reply and a follow-up. Correct zero to two genuine, important mistakes in the latest user turn, exact original sentence and corrected sentence. Explain in simple Darija. Never infer pronunciation from transcribed text. Current mode ${modeNames[t.mode]}. Role-play setting ${scenarios[t.scenario]}. In exam mode give approximate non-official feedback on the written turn and an A1 speaking prompt. Remain in the selected teaching mode. Return only the schema.`;
  const jsonShape = `Reply with one JSON object only, no prose and no code fence: {"germanReply": string, "darijaNote": string, "mistakes": [{"sentence": string, "correctedSentence": string, "errorType": "artikel"|"case"|"word_order"|"vocabulary"|"pronunciation"|"style", "explanationDarija": string}]} with at most 2 mistakes.`;
  const contents = [
    ...t.history.map((h) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }],
    })),
    { role: "user", parts: [{ text: t.message }] },
  ];
  if (key) {
    const ai = new GoogleGenAI({
      apiKey: key,
      httpOptions: { timeout: 10000 },
    });
    for (const model of textModels) {
      if (req.signal.aborted || Date.now() - started > budgetMs) break;
      if (!isAvailable(state[model.id])) continue;
      try {
        const response = await ai.models.generateContent(
          model.json
            ? {
                model: model.id,
                contents,
                config: {
                  systemInstruction: instruction,
                  responseMimeType: "application/json",
                  responseSchema: schema,
                },
              }
            : {
                model: model.id,
                contents: [
                  {
                    role: "user",
                    parts: [{ text: instruction + "\n\n" + jsonShape }],
                  },
                  {
                    role: "model",
                    parts: [{ text: "Verstanden. Ich antworte nur mit JSON." }],
                  },
                  ...contents,
                ],
              },
        );
        const text = response.text ?? "";
        reply = normalize(model.json ? JSON.parse(text) : extractJson(text));
        state = markSucceeded(state, model.id);
        source = "gemini";
        activeModel = model.id;
        break;
      } catch (cause) {
        const limited = rateLimit(cause);
        if (limited) {
          state = markRateLimited(state, model.id, limited.daily);
          continue;
        }
        const status = (cause as { status?: number })?.status;
        if (status === 401 || status === 403 || req.signal.aborted) break;
      }
    }
  }
  if (local) {
    const { db, userId } = local;
    await db.$transaction(async (tx) => {
      for (const [i, m] of reply.mistakes.entries()) {
        const id = `${userId}-${t.turnId}-${i}`;
        await tx.mistake.upsert({
          where: { id },
          create: { id, userId, ...m },
          update: {},
        });
        await tx.review.upsert({
          where: { mistakeId: id },
          create: { userId, mistakeId: id },
          update: {},
        });
      }
    });
  }
  return Response.json(
    { ...reply, activeModel, modelState: pruneState(state) },
    {
      headers: {
        "X-Tutor-Provider": source,
        "X-Tutor-Model": activeModel,
        "Cache-Control": "no-store",
      },
    },
  );
}
