"use client";
import { useEffect, useRef, useState } from "react";
import {
  AudioLines,
  BookOpenCheck,
  Check,
  CircleDot,
  Headphones,
  MessageCircle,
  Mic,
  Send,
  Settings2,
  Square,
  Store,
  Volume2,
} from "lucide-react";
import {
  BrowserSTT,
  hasRecognition,
  voiceProvider,
  type STTProvider,
  type VoiceLang,
} from "@/lib/voice";
import {
  modeNames,
  scenarios,
  replySchema,
  type Reply,
  type Turn,
} from "@/lib/tutor";
import { readPhoneKey } from "@/lib/phone-key";
import {
  readModelState,
  storeModelState,
  modelStateSchema,
  textModels,
} from "@/lib/text-models";
import { useLearner } from "./learner";
import { German } from "./german";
import { errorLabels } from "@/lib/types";
type Status = "Ready" | "Listening" | "Thinking" | "Speaking" | "Error";
type Message = {
  id: string;
  user: string;
  reply: Reply;
  provider: string;
  model: string;
};
const statusText = {
  Ready: "واجد",
  Listening: "كيسمع",
  Thinking: "كيفكّر",
  Speaking: "كيهضر",
  Error: "وقع مشكل",
};
const modes = {
  free: { ar: "محادثة حرّة", icon: MessageCircle },
  role: { ar: "لعب الأدوار", icon: Store },
  exam: { ar: "تدريب الامتحان", icon: BookOpenCheck },
};
const roleGreeting = {
  bakery: "Guten Morgen! Was möchten Sie kaufen?",
  doctor: "Guten Tag! Was tut Ihnen weh?",
  housing: "Guten Tag! Wie kann ich Ihnen im Bürgerbüro helfen?",
  interview: "Willkommen! Warum möchten Sie diese Ausbildung machen?",
};
function makeTurnId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
export function TutorRoom() {
  const learner = useLearner();
  const [mode, setMode] = useState<Turn["mode"]>("free"),
    [scenario, setScenario] = useState<Turn["scenario"]>("bakery");
  const [lang, setLang] = useState<VoiceLang>("de-DE"),
    [speed, setSpeed] = useState(1),
    [edge, setEdge] = useState(false),
    [supported, setSupported] = useState(false);
  const [status, setStatus] = useState<Status>("Ready"),
    [notice, setNotice] = useState(""),
    [draft, setDraft] = useState(""),
    [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState(""),
    [settings, setSettings] = useState(true);
  const phase = useRef<Status>("Ready"),
    alive = useRef(true),
    stt = useRef<STTProvider | null>(null),
    voice = useRef<AbortController | null>(null),
    network = useRef<AbortController | null>(null),
    log = useRef<HTMLDivElement | null>(null);
  const retry = useRef<{ message: string; id: string } | null>(null);
  const greeting =
    mode === "free"
      ? "Hallo! Ich bin Walid. Wie heißen Sie?"
      : mode === "role"
        ? roleGreeting[scenario]
        : "Stellen Sie sich bitte kurz vor. Wie heißen Sie und woher kommen Sie?";
  const note =
    mode === "free"
      ? "مرحبا بيك! قول ليا شنو سميتك ونبداو نتعارفو."
      : mode === "role"
        ? "تخيّل راسك فهاد الموقف وجاوبني بجملة بسيطة."
        : "تدريب تقريبي على الشفوي ديال Goethe/telc A1. قدّم راسك فشي جوج جمل.";
  function change(s: Status) {
    phase.current = s;
    if (alive.current) setStatus(s);
  }
  useEffect(() => {
    alive.current = true;
    setSupported(hasRecognition());
    stt.current = new BrowserSTT();
    return () => {
      alive.current = false;
      stt.current?.abort();
      voice.current?.abort();
      network.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, pending]);
  function reset() {
    stt.current?.abort();
    voice.current?.abort();
    setMessages([]);
    setDraft("");
    setNotice("");
    retry.current = null;
    change("Ready");
  }
  async function speak(de: string, ar: string) {
    stt.current?.abort();
    voice.current?.abort();
    const c = new AbortController();
    voice.current = c;
    change("Speaking");
    setNotice("");
    try {
      const provider = voiceProvider(edge);
      await provider.speak(de, { lang: "de-DE", speed, signal: c.signal });
      if (ar)
        await provider.speak(ar, { lang: "ar-MA", speed, signal: c.signal });
    } catch {
      if (!c.signal.aborted && alive.current) {
        setNotice("الصوت ما خدمش فهاد المتصفح. الجواب كامل مكتوب هنا.");
        change("Error");
        return;
      }
    } finally {
      if (voice.current === c && phase.current === "Speaking") change("Ready");
    }
  }
  function stopVoice() {
    voice.current?.abort();
    change("Ready");
  }
  function listen() {
    if (!supported || !["Ready", "Error"].includes(phase.current)) return;
    setNotice("");
    const prefix = draft.trim();
    change("Listening");
    try {
      stt.current?.start(
        lang,
        (text) => setDraft((prefix ? prefix + " " : "") + text),
        () => {
          if (phase.current === "Listening") change("Ready");
        },
        () => {
          setNotice("التعرّف على الصوت ما خدمش. تقدر تكتب الجواب لتحت.");
          change("Error");
        },
      );
    } catch {
      change("Error");
      setNotice("الميكروفون ما خدمش. كتب الجواب ديالك.");
    }
  }
  async function send() {
    const message = draft.trim();
    if (!message || !["Ready", "Error", "Listening"].includes(phase.current))
      return;
    stt.current?.abort();
    change("Thinking");
    setPending(message);
    setDraft("");
    setNotice("");
    const id =
      retry.current?.message === message ? retry.current.id : makeTurnId();
    retry.current = { message, id };
    const c = new AbortController();
    network.current = c;
    try {
      const history: Turn["history"] = messages.slice(-4).flatMap((m) => [
        { role: "user" as const, text: m.user },
        {
          role: "assistant" as const,
          text: m.reply.germanReply + " " + m.reply.darijaNote,
        },
      ]);
      const phoneKey = readPhoneKey();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(phoneKey ? { "x-gemini-api-key": phoneKey } : {}),
        },
        body: JSON.stringify({
          message,
          mode,
          scenario,
          turnId: id,
          history,
          modelState: readModelState(),
        }),
        signal: c.signal,
      });
      if (!res.ok) throw Error();
      const {
        activeModel,
        modelState,
        ...body
      }: { activeModel?: unknown; modelState?: unknown } =
        await res.json();
      const reply = replySchema.parse(body);
      const nextState = modelStateSchema.safeParse(modelState);
      if (nextState.success) storeModelState(nextState.data);
      await learner.corrections(id, reply.mistakes);
      if (!alive.current) return;
      setMessages((prev) => [
        ...prev,
        {
          id,
          user: message,
          reply,
          provider: res.headers.get("X-Tutor-Provider") ?? "mock",
          model: typeof activeModel === "string" ? activeModel : "mock",
        },
      ]);
      setPending("");
      retry.current = null;
      await speak(reply.germanReply, reply.darijaNote);
    } catch {
      if (alive.current && !c.signal.aborted) {
        setPending("");
        setDraft(message);
        change("Error");
        setNotice("ما وصلش الجواب. عاود صيفط الرسالة.");
      }
    }
  }
  const busy = status === "Thinking" || status === "Speaking",
    blocked = busy || status === "Listening";
  return (
    <div className="stack">
      <div className="modeGrid">
        {(Object.keys(modes) as Turn["mode"][]).map((k) => {
          const Icon = modes[k].icon;
          return (
            <button
              className={"mode " + (mode === k ? "active" : "")}
              key={k}
              disabled={blocked}
              aria-pressed={mode === k}
              onClick={() => {
                if (k !== mode) {
                  reset();
                  setMode(k);
                }
              }}
            >
              <Icon size={20} />
              <span>
                {modes[k].ar}
                <small lang="de">{modeNames[k]}</small>
              </span>
              {mode === k && <Check size={16} />}
            </button>
          );
        })}
      </div>
      {mode === "role" && (
        <label className="scenario">
          اختار الموقف{" "}
          <select
            value={scenario}
            disabled={blocked}
            onChange={(e) => {
              reset();
              setScenario(e.target.value as Turn["scenario"]);
            }}
          >
            {Object.entries(scenarios).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="panel chat">
        <div className="chatHead">
          <span className="brandmark small">
            <AudioLines />
          </span>
          <div>
            <h2>الأستاذ وليد</h2>
            <small>
              {messages.at(-1)?.provider === "mock"
                ? "تدريب محلي · Mock"
                : messages.at(-1)?.provider === "gemini"
                  ? "Gemini · A1"
                  : modeNames[mode]}
              {messages.at(-1)?.provider === "gemini" && (
                <bdi
                  className={
                    "modelBadge " +
                    (messages.at(-1)?.model === textModels[0].id
                      ? ""
                      : "fallback")
                  }
                  dir="ltr"
                  title="الموديل اللي جاوب"
                >
                  {messages.at(-1)?.model}
                </bdi>
              )}
            </small>
          </div>
          <span className={"state " + status} role="status">
            <CircleDot size={13} />
            {statusText[status]} <bdi>{status}</bdi>
          </span>
        </div>
        <div className="chatLog" role="log" ref={log} aria-live="polite">
          <div className="bubble">
            <div className="bubbleDe">
              <German text={greeting} />
            </div>
            <p>{note}</p>
            <button
              disabled={blocked}
              onClick={() => speak(greeting, note)}
              className="audioLink"
            >
              <Volume2 size={15} />
              سمع
            </button>
          </div>
          {messages.map((m) => (
            <div className="turn" key={m.id}>
              <div className="userBubble" dir="auto">
                {m.user}
              </div>
              <div className="bubble">
                <div className="bubbleDe">
                  <German text={m.reply.germanReply} />
                </div>
                <p>{m.reply.darijaNote}</p>
                {m.reply.mistakes.map((x, i) => (
                  <div className="tutorFix" key={i}>
                    <strong>{errorLabels[x.errorType]}</strong>
                    <del dir="auto">{x.sentence}</del>
                    <div dir="ltr">
                      <German text={x.correctedSentence} />
                    </div>
                    <p>{x.explanationDarija}</p>
                  </div>
                ))}
                <button
                  className="audioLink"
                  disabled={blocked}
                  onClick={() => speak(m.reply.germanReply, m.reply.darijaNote)}
                >
                  <Volume2 size={15} />
                  سمع
                </button>
              </div>
            </div>
          ))}
          {pending && (
            <div className="userBubble" dir="auto">
              {pending}
            </div>
          )}
        </div>
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label className="sr-only" htmlFor="answer">
            الجواب ديالك
          </label>
          <textarea
            id="answer"
            dir="auto"
            maxLength={1200}
            rows={2}
            placeholder="كتب الجواب ديالك هنا…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <div className="composerBtns">
            <button className="btn primary" disabled={busy || !draft.trim()}>
              <Send size={16} />
              صيفط
            </button>
            {status === "Speaking" ? (
              <button type="button" className="btn light" onClick={stopVoice}>
                <Square size={15} />
                وقف الصوت
              </button>
            ) : (
              <button
                type="button"
                className={
                  "btn light ptt " + (status === "Listening" ? "recording" : "")
                }
                disabled={!supported || busy}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  listen();
                }}
                onPointerUp={() => stt.current?.stop()}
                onPointerCancel={() => {
                  stt.current?.abort();
                  change("Ready");
                }}
                onKeyDown={(e) => {
                  if ([" ", "Enter"].includes(e.key)) {
                    e.preventDefault();
                    if (!e.repeat) listen();
                  }
                }}
                onKeyUp={(e) => {
                  if ([" ", "Enter"].includes(e.key)) {
                    e.preventDefault();
                    stt.current?.stop();
                  }
                }}
                onBlur={() => {
                  if (phase.current === "Listening") stt.current?.stop();
                }}
              >
                <Mic size={17} />
                {status === "Listening" ? "طلق ملي تسالي" : "شدّ باش تهضر"}
              </button>
            )}
            <button
              type="button"
              className="settingsBtn"
              aria-expanded={settings}
              aria-label="إعدادات الصوت"
              onClick={() => setSettings(!settings)}
            >
              <Settings2 size={19} />
            </button>
          </div>
        </form>
        {!supported && (
          <div className="voiceHint">
            <Headphones size={15} />
            هاد المتصفح ما كيدعمش التعرف على الصوت. تقدر تجاوب بالكتابة.
          </div>
        )}
        {notice && (
          <div className="warnBox" role="status">
            {notice}
          </div>
        )}
      </div>
      {settings && (
        <div className="panel voiceSettings">
          <h2>
            <Settings2 size={18} />
            إعدادات الصوت
          </h2>
          <div className="settingsRow">
            <label>
              لغة الميكروفون
              <select
                disabled={blocked}
                value={lang}
                onChange={(e) => setLang(e.target.value as VoiceLang)}
              >
                <option value="de-DE">الألمانية · de-DE</option>
                <option value="ar-MA">الدارجة · ar-MA</option>
              </select>
            </label>
            <label>
              سرعة النطق
              <select
                disabled={blocked}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
              >
                <option value={0.75}>بطيئة</option>
                <option value={1}>عادية</option>
                <option value={1.25}>سريعة</option>
              </select>
            </label>
            <label className="checkLabel">
              <input
                type="checkbox"
                checked={edge}
                disabled={blocked}
                onChange={(e) => setEdge(e.target.checked)}
              />
              استعمل Edge TTS
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
