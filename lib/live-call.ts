import { liveModels, primaryLiveModel } from "./live-models";
// This client opens Google's BidiGenerateContent socket only after the learner taps Call.
const endpoint =
  "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const COOLDOWN_MS = 65_000;
const cooldownKey = "oustad-walid.live-cooldowns.v1";
// Conditions for a natural pause before switching back to the primary model.
const USER_QUIET_MS = 1500,
  SERVER_QUIET_MS = 1000,
  VOICE_RMS = 0.02;
const HANDOFF_TURNS = 6,
  HANDOFF_CHARS = 240;
const instruction =
  "You are Oustad Walid, a patient Moroccan German teacher living in Germany. This is an A1 speaking lesson. Speak about 60% simple German and 40% natural Moroccan Darija. Understand both languages, including code-switching. Keep each turn short, correct at most two important mistakes, and invite the learner to respond. When interrupted, listen.";
type Content = {
  interrupted?: boolean;
  turnComplete?: boolean;
  inputTranscription?: { text?: string };
  outputTranscription?: { text?: string };
  modelTurn?: { parts?: { inlineData?: { data: string; mimeType: string } }[] };
};
export type LiveStatus = {
  model: string;
  primary: string;
  resting: { model: string; seconds: number }[];
  switching: boolean;
};
type Events = {
  connected: (model: string) => void;
  transcript: (speaker: "user" | "tutor", chunk: string) => void;
  turnEnd: () => void;
  ended: (reason: string) => void;
  status?: (status: LiveStatus) => void;
};
type Failure = "quota" | "denied" | "unsupported" | "network" | "cancelled";
type Attempt = { ok: true; ws: WebSocket } | { ok: false; kind: Failure };
function failure(message: string) {
  return new Error(message);
}
const unavailable =
  "هاد الموديلات ما متاحاش دابا بهاد المفتاح. جرّب المحادثة النصية.";
const disconnected = "تقطعات المكالمة. تقدر تعاود تتصل ولا تكمّل بالكتابة.";
const denied =
  "تأكد من المفتاح وصلاحية Gemini Live والحصة المتاحة فـ Google AI Studio.";
const resting =
  "جميع موديلات المكالمة كيرتاحو دقيقة. عاود جرّب من بعد شوية ولا كمّل بالكتابة.";
function classify(message: string, code?: number): Failure {
  if (
    /api.?key|permission.denied|unauthenticated|billing/i.test(message) ||
    code === 401 ||
    code === 403
  )
    return "denied";
  if (
    code === 429 ||
    /resource.?exhausted|quota|rate.?limit|too many requests/i.test(message)
  )
    return "quota";
  // Model lookup failures can arrive in a frame or a 1008 close.
  if (
    code === 404 ||
    code === 1008 ||
    /model|not found|not supported|not available/i.test(message)
  )
    return "unsupported";
  return "network";
}
function loadCooldowns(): Map<string, number> {
  const now = Date.now(),
    out = new Map<string, number>();
  try {
    const raw = JSON.parse(localStorage.getItem(cooldownKey) || "{}");
    for (const m of liveModels)
      if (typeof raw[m] === "number" && raw[m] > now) out.set(m, raw[m]);
  } catch {}
  return out;
}
function detach(ws: WebSocket) {
  ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
  try {
    ws.close();
  } catch {}
}
export class LiveCall {
  private context: AudioContext;
  private socket: WebSocket | null = null;
  private model = "";
  private key = "";
  private stream: MediaStream | null = null;
  private capture: AudioWorkletNode | null = null;
  private players = new Set<AudioBufferSourceNode>();
  private nextStart = 0;
  private closed = false;
  private ready = false;
  private switching = false;
  private upgrading = false;
  private refreshWanted = false;
  private nextUpgradeAt = 0;
  private cooldowns = loadCooldowns();
  private unsupported = new Set<string>();
  private recoveries: number[] = [];
  private history: { speaker: "user" | "tutor"; text: string }[] = [];
  private tutorTurnOpen = false;
  private lastUserVoice = 0;
  private lastServerEvent = 0;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private cancels = new Set<() => void>();
  constructor(private events: Events) {
    this.context = new AudioContext({ latencyHint: "interactive" });
  }
  async start(key: string) {
    this.key = key;
    try {
      // Resume playback during the original tap, before waiting for permission.
      await this.context.resume();
      this.ensureActive();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      if (this.closed) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      this.stream = stream;
      for (const track of stream.getAudioTracks())
        track.onended = () => this.finish(disconnected);
      await this.context.audioWorklet.addModule("/audio/pcm-capture.js");
      this.ensureActive();
      this.capture = new AudioWorkletNode(this.context, "oustad-pcm", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
      });
      // The worklet writes only to its message port. Its output is silence.
      this.context
        .createMediaStreamSource(stream)
        .connect(this.capture)
        .connect(this.context.destination);
      this.capture.port.onmessage = ({ data }: { data: ArrayBuffer }) => {
        this.trackVoice(data);
        const ws = this.socket;
        if (
          !this.ready ||
          ws?.readyState !== WebSocket.OPEN ||
          ws.bufferedAmount > 64000
        )
          return;
        const pcm = btoa(String.fromCharCode(...new Uint8Array(data)));
        ws.send(
          JSON.stringify({
            realtimeInput: {
              audio: { data: pcm, mimeType: "audio/pcm;rate=16000" },
            },
          }),
        );
      };
      const result = await this.openBest();
      if (result !== true)
        throw failure(
          result === "denied"
            ? denied
            : result === "quota"
              ? resting
              : result === "network"
                ? disconnected
                : unavailable,
        );
      this.ticker = setInterval(() => this.tick(), 1000);
    } catch (e) {
      if (this.closed) return;
      const code = e instanceof Error ? e.name : "";
      const message = e instanceof Error ? e.message : "";
      this.finish(
        code === "NotAllowedError"
          ? "اسمح للمتصفح يستعمل الميكروفون وعاود اتصل."
          : code === "NotFoundError"
            ? "ما لقيناش ميكروفون فهاد الجهاز."
            : [denied, unavailable, disconnected, resting].includes(message)
              ? message
              : "تعذّر تشغيل الصوت. تأكد من الاتصال وصلاحية الميكروفون.",
      );
    }
  }
  private ensureActive() {
    if (this.closed) throw failure("cancelled");
  }
  private cooling(model: string, now = Date.now()) {
    const until = this.cooldowns.get(model);
    if (until && until > now) return true;
    if (until) this.cooldowns.delete(model);
    return false;
  }
  private rest(model: string) {
    this.cooldowns.set(model, Date.now() + COOLDOWN_MS);
    try {
      localStorage.setItem(
        cooldownKey,
        JSON.stringify(Object.fromEntries(this.cooldowns)),
      );
    } catch {}
    this.emitStatus();
  }
  private candidates(stronger?: string) {
    const limit = stronger
      ? liveModels.indexOf(stronger as (typeof liveModels)[number])
      : liveModels.length;
    return liveModels
      .slice(0, limit < 0 ? liveModels.length : limit)
      .filter((m) => !this.cooling(m) && !this.unsupported.has(m));
  }
  // Tries models strongest first. Returns true or the most relevant failure.
  private async openBest(): Promise<true | Failure> {
    let worst: Failure = "unsupported";
    if (!this.candidates().length && this.cooldowns.size) worst = "quota";
    for (const model of this.candidates()) {
      if (this.closed) return "cancelled";
      const attempt = await this.connect(model);
      if (attempt.ok) {
        this.activate(attempt.ws, model);
        return true;
      }
      if (attempt.kind === "cancelled") return "cancelled";
      if (attempt.kind === "denied") return "denied";
      if (attempt.kind === "quota") {
        this.rest(model);
        worst = "quota";
      } else if (attempt.kind === "unsupported") this.unsupported.add(model);
      else if (worst !== "quota") worst = "network";
    }
    return worst;
  }
  // A compact summary of the last turns lets a new model continue the call.
  private handoff() {
    const turns = this.history
      .filter((h) => h.text.trim())
      .slice(-HANDOFF_TURNS)
      .map((h) => {
        const text = h.text.replace(/\s+/g, " ").trim();
        const short =
          text.length > HANDOFF_CHARS
            ? "…" + text.slice(-HANDOFF_CHARS)
            : text;
        return (h.speaker === "user" ? "Learner: " : "Oustad Walid: ") + short;
      });
    if (!turns.length) return instruction;
    return (
      instruction +
      "\n\nContext handoff: this voice call is continuing on a new connection. Do not greet the learner again or restart the lesson. Recent turns, oldest first:\n" +
      turns.join("\n") +
      "\nContinue naturally from the last turn. If the learner's last turn is unanswered, answer it briefly."
    );
  }
  private async connect(model: string): Promise<Attempt> {
    let url = endpoint + "?key=" + encodeURIComponent(this.key);
    if (!this.key) {
      try {
        const response = await fetch("/api/key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
          cache: "no-store",
        });
        if (!response.ok) return { ok: false, kind: classify("", response.status) };
        const { token } = await response.json();
        if (typeof token !== "string" || !token) return { ok: false, kind: "denied" };
        url = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContentConstrained?access_token=" + encodeURIComponent(token);
      } catch {
        return { ok: false, kind: "network" };
      }
    }
    if (this.closed) return { ok: false, kind: "cancelled" };
    return new Promise((resolve) => {
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      let settled = false;
      const settle = (result: Attempt) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancels.delete(cancel);
        if (!result.ok) detach(ws);
        resolve(result);
      };
      const cancel = () => settle({ ok: false, kind: "cancelled" });
      this.cancels.add(cancel);
      const timer = setTimeout(
        () => settle({ ok: false, kind: "network" }),
        10000,
      );
      ws.onopen = () =>
        ws.send(
          JSON.stringify({
            setup: {
              model: "models/" + model,
              generationConfig: { responseModalities: ["AUDIO"] },
              systemInstruction: { parts: [{ text: this.handoff() }] },
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              realtimeInputConfig: {
                automaticActivityDetection: { disabled: false },
                activityHandling: "START_OF_ACTIVITY_INTERRUPTS",
              },
            },
          }),
        );
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(
            typeof event.data === "string"
              ? event.data
              : new TextDecoder().decode(event.data),
          );
          if (data.error)
            settle({
              ok: false,
              kind: classify(String(data.error.message || ""), data.error.code),
            });
          else if (data.setupComplete) settle({ ok: true, ws });
        } catch {
          settle({ ok: false, kind: "network" });
        }
      };
      ws.onclose = (e) =>
        settle({ ok: false, kind: classify(e.reason, e.code) });
      ws.onerror = () => settle({ ok: false, kind: "network" });
    });
  }
  // Makes ws the live session and closes the previous one.
  private activate(ws: WebSocket, model: string) {
    const old = this.socket;
    this.socket = ws;
    this.model = model;
    this.ready = true;
    this.tutorTurnOpen = false;
    this.refreshWanted = false;
    if (old && old !== ws) detach(old);
    ws.onmessage = (event) => {
      if (this.closed || ws !== this.socket) return;
      try {
        const data = JSON.parse(
          typeof event.data === "string"
            ? event.data
            : new TextDecoder().decode(event.data),
        );
        if (data.error) {
          this.lost(
            ws,
            classify(String(data.error.message || ""), data.error.code),
          );
          return;
        }
        // The server will end this session soon. Move at the next pause.
        if (data.goAway) this.refreshWanted = true;
        if (data.serverContent) this.receive(data.serverContent);
      } catch {
        this.lost(ws, "network");
      }
    };
    ws.onclose = (e) => this.lost(ws, classify(e.reason, e.code));
    ws.onerror = () => this.lost(ws, "network");
    this.events.connected(model);
    this.emitStatus();
  }
  // The active session dropped. Rest the model on quota and hand off to the next.
  private lost(ws: WebSocket, kind: Failure) {
    if (this.closed || ws !== this.socket) return;
    detach(ws);
    this.socket = null;
    this.ready = false;
    if (kind === "denied") return this.finish(denied);
    if (kind === "quota") this.rest(this.model);
    else if (kind === "unsupported") this.unsupported.add(this.model);
    // The upgrade in flight will replace the session or recover after it.
    if (this.upgrading) return;
    void this.recover(kind);
  }
  private async recover(kind: Failure) {
    const now = Date.now();
    this.recoveries = this.recoveries.filter((t) => now - t < 60_000);
    if (kind !== "quota" && this.recoveries.length >= 3)
      return this.finish(disconnected);
    this.recoveries.push(now);
    this.switching = true;
    this.emitStatus();
    const result = await this.openBest();
    this.switching = false;
    if (this.closed) return;
    if (result !== true)
      this.finish(
        result === "denied"
          ? denied
          : result === "quota"
            ? resting
            : disconnected,
      );
    else this.emitStatus();
  }
  private idle(now = Date.now()) {
    return (
      this.players.size === 0 &&
      this.context.currentTime >= this.nextStart &&
      !this.tutorTurnOpen &&
      now - this.lastUserVoice > USER_QUIET_MS &&
      now - this.lastServerEvent > SERVER_QUIET_MS
    );
  }
  private tick() {
    if (this.closed) return;
    this.emitStatus();
    if (
      !this.ready ||
      this.switching ||
      this.upgrading ||
      Date.now() < this.nextUpgradeAt ||
      !this.idle()
    )
      return;
    const index = liveModels.indexOf(
      this.model as (typeof liveModels)[number],
    );
    if (index > 0 && this.candidates(this.model).length)
      void this.upgrade(this.model);
    else if (this.refreshWanted) void this.upgrade();
  }
  // Opens a stronger (or fresh) session while the current one keeps running.
  private async upgrade(stronger?: string) {
    this.upgrading = true;
    this.emitStatus();
    const list = stronger
      ? this.candidates(stronger)
      : this.candidates().slice(0, 1);
    for (const model of list) {
      if (this.closed) break;
      const attempt = await this.connect(model);
      if (this.closed) {
        if (attempt.ok) detach(attempt.ws);
        break;
      }
      if (attempt.ok) {
        this.activate(attempt.ws, model);
        break;
      }
      if (attempt.kind === "cancelled") break;
      if (attempt.kind === "quota") this.rest(model);
      else if (attempt.kind === "unsupported") this.unsupported.add(model);
    }
    this.upgrading = false;
    // Back off before trying again if no stronger session opened.
    this.nextUpgradeAt = Date.now() + 10_000;
    if (this.closed) return;
    if (!this.socket) void this.recover("network");
    else this.emitStatus();
  }
  private trackVoice(data: ArrayBuffer) {
    const samples = new Int16Array(data);
    let sum = 0;
    for (const s of samples) sum += s * s;
    const rms = Math.sqrt(sum / Math.max(1, samples.length)) / 32768;
    if (rms > VOICE_RMS) this.lastUserVoice = Date.now();
  }
  private remember(speaker: "user" | "tutor", chunk: string) {
    const last = this.history.at(-1);
    if (last && last.speaker === speaker) last.text += chunk;
    else this.history.push({ speaker, text: chunk });
    if (this.history.length > 12) this.history.splice(0, 2);
  }
  private emitStatus() {
    if (!this.events.status || !this.model) return;
    const now = Date.now();
    this.events.status({
      model: this.model,
      primary: primaryLiveModel,
      resting: liveModels
        .filter((m) => this.cooling(m, now))
        .map((m) => ({
          model: m,
          seconds: Math.ceil(((this.cooldowns.get(m) ?? now) - now) / 1000),
        })),
      switching: this.switching || this.upgrading,
    });
  }
  private receive(content: Content) {
    this.lastServerEvent = Date.now();
    if (content.interrupted) {
      this.clearPlayback();
      this.tutorTurnOpen = false;
      this.events.turnEnd();
    }
    if (content.inputTranscription?.text) {
      this.lastUserVoice = Date.now();
      this.remember("user", content.inputTranscription.text);
      this.events.transcript("user", content.inputTranscription.text);
    }
    if (content.outputTranscription?.text) {
      this.tutorTurnOpen = true;
      this.remember("tutor", content.outputTranscription.text);
      this.events.transcript("tutor", content.outputTranscription.text);
    }
    if (!content.interrupted)
      for (const part of content.modelTurn?.parts ?? []) {
        const audio = part.inlineData;
        if (!audio?.data || !audio.mimeType.startsWith("audio/pcm")) continue;
        const raw = atob(audio.data);
        if (raw.length < 2) continue;
        this.tutorTurnOpen = true;
        const rate = Number(audio.mimeType.match(/rate=(\d+)/)?.[1] ?? 24000);
        const buffer = this.context.createBuffer(
          1,
          Math.floor(raw.length / 2),
          rate,
        );
        const samples = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i++) {
          const value =
            raw.charCodeAt(i * 2) | (raw.charCodeAt(i * 2 + 1) << 8);
          samples[i] = (value >= 32768 ? value - 65536 : value) / 32768;
        }
        const player = this.context.createBufferSource();
        player.buffer = buffer;
        player.connect(this.context.destination);
        this.players.add(player);
        player.onended = () => {
          this.players.delete(player);
          player.disconnect();
        };
        this.nextStart = Math.max(
          this.nextStart,
          this.context.currentTime + 0.02,
        );
        player.start(this.nextStart);
        this.nextStart += buffer.duration;
      }
    if (content.turnComplete) {
      this.tutorTurnOpen = false;
      this.events.turnEnd();
    }
  }
  private clearPlayback() {
    for (const player of this.players) {
      player.stop();
      player.disconnect();
    }
    this.players.clear();
    this.nextStart = 0;
  }
  private finish(reason: string) {
    if (this.closed) return;
    this.stop();
    this.events.ended(reason);
  }
  stop() {
    if (this.closed) return;
    this.closed = true;
    this.ready = false;
    if (this.ticker) clearInterval(this.ticker);
    this.ticker = null;
    for (const cancel of [...this.cancels]) cancel();
    if (this.socket) {
      detach(this.socket);
      this.socket = null;
    }
    this.stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    if (this.capture) {
      this.capture.port.onmessage = null;
      this.capture.port.close();
      this.capture.disconnect();
    }
    this.clearPlayback();
    void this.context.close().catch(() => {});
  }
}
