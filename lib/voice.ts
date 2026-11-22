export type VoiceLang = "de-DE" | "ar-MA";
export type VoiceOptions = {
  lang: VoiceLang;
  speed: number;
  signal: AbortSignal;
};
export interface TTSProvider {
  speak(text: string, options: VoiceOptions): Promise<void>;
}
export interface STTProvider {
  start(
    lang: VoiceLang,
    onText: (text: string) => void,
    onEnd: () => void,
    onError: (reason: string) => void,
  ): void;
  stop(): void;
  abort(): void;
}
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult:
    | ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void)
    | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
function engine() {
  const w = window as Window & {
    SpeechRecognition?: new () => Recognition;
    webkitSpeechRecognition?: new () => Recognition;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition;
}
export function hasRecognition() {
  return !!engine();
}
export class BrowserSTT implements STTProvider {
  private recognition?: Recognition;
  start(
    lang: VoiceLang,
    onText: (s: string) => void,
    onEnd: () => void,
    onError: (s: string) => void,
  ) {
    this.abort();
    const RecognitionClass = engine();
    if (!RecognitionClass) throw new Error("Unavailable");
    const r = new RecognitionClass();
    this.recognition = r;
    r.lang = lang;
    r.continuous = false;
    r.interimResults = true;
    r.onresult = (e) =>
      onText(Array.from(e.results, (x) => x[0].transcript).join(" "));
    r.onerror = (e) => {
      if (e.error !== "aborted") onError(e.error);
    };
    r.onend = () => {
      if (this.recognition === r) this.recognition = undefined;
      onEnd();
    };
    r.start();
  }
  stop() {
    this.recognition?.stop();
  }
  abort() {
    const r = this.recognition;
    if (r) {
      this.recognition = undefined;
      r.onerror = null;
      r.onresult = null;
      r.onend = null;
      r.abort();
    }
  }
}
function abortError() {
  return new DOMException("Cancelled", "AbortError");
}
export class BrowserTTS implements TTSProvider {
  async speak(text: string, { lang, speed, signal }: VoiceOptions) {
    if (signal.aborted) throw abortError();
    if (!window.speechSynthesis) throw new Error("Speech unavailable");
    const synth = window.speechSynthesis;
    await new Promise<void>((resolve, reject) => {
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const voice =
        voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
        voices.find((v) => v.lang.split("-")[0] === lang.split("-")[0]);
      if (voice) u.voice = voice;
      u.lang = lang;
      u.rate = speed;
      const finish = (error?: Error) => {
        clearTimeout(timer);
        signal.removeEventListener("abort", cancel);
        u.onend = null;
        u.onerror = null;
        if (error) reject(error);
        else resolve();
      };
      const cancel = () => {
        finish(abortError());
        synth.cancel();
      };
      const timer = setTimeout(
        () => {
          finish(new Error("Speech timeout"));
          synth.cancel();
        },
        Math.max(12000, text.length * 180),
      );
      signal.addEventListener("abort", cancel, { once: true });
      u.onend = () => finish();
      u.onerror = () => finish(new Error("Voice unavailable"));
      synth.speak(u);
    });
  }
}
export class EdgeTTS implements TTSProvider {
  constructor(private fallback: TTSProvider) {}
  async speak(text: string, options: VoiceOptions) {
    let url: string | undefined;
    try {
      const signal = AbortSignal.any([
        options.signal,
        AbortSignal.timeout(10500),
      ]);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang: options.lang }),
        signal,
      });
      if (!res.ok) throw new Error("Edge unavailable");
      url = URL.createObjectURL(await res.blob());
      if (options.signal.aborted) throw abortError();
      const audio = new Audio(url);
      audio.playbackRate = options.speed;
      await new Promise<void>((resolve, reject) => {
        const finish = (err?: Error) => {
          clearTimeout(timer);
          options.signal.removeEventListener("abort", cancel);
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          if (err) reject(err);
          else resolve();
        };
        const cancel = () => finish(abortError());
        const timer = setTimeout(
          () => finish(new Error("Playback timeout")),
          Math.max(12000, text.length * 180),
        );
        options.signal.addEventListener("abort", cancel, { once: true });
        audio.onended = () => finish();
        audio.onerror = () => finish(new Error("Playback error"));
        audio.play().catch(() => finish(new Error("Playback blocked")));
      });
    } catch (e) {
      if (options.signal.aborted) throw e;
      await this.fallback.speak(text, options);
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  }
}
const browser = new BrowserTTS();
export const voiceProvider = (edge: boolean): TTSProvider =>
  edge ? new EdgeTTS(browser) : browser;
