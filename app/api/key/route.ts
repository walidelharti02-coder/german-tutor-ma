import { GoogleGenAI } from "@google/genai";
import { liveModels } from "@/lib/live-models";

export const dynamic = "force-dynamic";

function json(data: object, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}

export function GET() {
  return json({ hasServerKey: Boolean(process.env.GEMINI_API_KEY?.trim()) });
}

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return json({ error: "Expected JSON" }, 415);
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return json({ error: "Server key unavailable" }, 403);
  const body = await request.json().catch(() => null);
  if (!liveModels.includes(body?.model)) return json({ error: "Unknown Live model" }, 400);
  const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: "v1alpha", timeout: 8000 } });
  try {
    const token = await ai.authTokens.create({
      config: { uses: 1, liveConnectConstraints: { model: body.model } },
    });
    if (!token.name) return json({ error: "Live token unavailable" }, 502);
    return json({ token: token.name });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    return json({ error: "Live token unavailable" }, status && [401, 403, 404, 429].includes(status) ? status : 502);
  }
}
