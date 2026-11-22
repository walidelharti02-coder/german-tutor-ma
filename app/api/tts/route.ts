import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { z } from "zod";
export const runtime = "nodejs";
export async function POST(req: Request) {
  const input = z
    .object({
      text: z.string().trim().min(1).max(2200),
      lang: z.enum(["de-DE", "ar-MA"]),
    })
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return Response.json({ error: "Invalid speech request" }, { status: 400 });
  const tts = new MsEdgeTTS();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stream: ReturnType<MsEdgeTTS["toStream"]>["audioStream"] | undefined;
  let expired = false;
  try {
    const bytes = await Promise.race([
      (async () => {
        await tts.setMetadata(
          input.data.lang === "de-DE"
            ? "de-DE-ConradNeural"
            : "ar-MA-JamalNeural",
          OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
        );
        if (expired) throw new Error("Expired");
        const safe = input.data.text
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        stream = tts.toStream(safe).audioStream;
        const parts: Buffer[] = [];
        let size = 0;
        for await (const chunk of stream) {
          size += chunk.length;
          if (size > 4_000_000) throw new Error("Audio too large");
          parts.push(Buffer.from(chunk));
        }
        if (!size) throw new Error("Empty audio");
        return new Uint8Array(Buffer.concat(parts));
      })(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error("Timed out"));
        }, 8000);
      }),
    ]);
    return new Response(bytes, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "Browser voice available" }, { status: 503 });
  } finally {
    clearTimeout(timer);
    stream?.destroy();
    tts.close();
  }
}
