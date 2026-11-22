"use client";
import { useEffect, useRef, useState } from "react";
import { MessageSquare, PhoneCall, PhoneOff } from "lucide-react";
import { TutorRoom } from "./tutor-room";
import { LiveCall, type LiveStatus } from "@/lib/live-call";
import { readPhoneKey } from "@/lib/phone-key";
type Line = { speaker: "user" | "tutor"; text: string; turn: number };
function LiveRoom({ hasServerKey }: { hasServerKey: boolean }) {
  const call = useRef<LiveCall | null>(null),
    turn = useRef(0),
    log = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<"idle" | "connecting" | "active">("idle"),
    [notice, setNotice] = useState(""),
    [lines, setLines] = useState<Line[]>([]),
    [live, setLive] = useState<LiveStatus | null>(null);
  function stop(message = "سالات المكالمة.") {
    call.current?.stop();
    call.current = null;
    setPhase("idle");
    setNotice(message);
    setLive(null);
  }
  useEffect(() => {
    const hidden = () => {
      if (document.hidden && call.current)
        stop("توقّفات المكالمة حيث خرجتي من الصفحة.");
    };
    const leave = () => {
      if (call.current) stop();
    };
    document.addEventListener("visibilitychange", hidden);
    window.addEventListener("pagehide", leave);
    return () => {
      document.removeEventListener("visibilitychange", hidden);
      window.removeEventListener("pagehide", leave);
      call.current?.stop();
      call.current = null;
    };
  }, []);
  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [lines]);
  function start() {
    if (call.current) return;
    const key = readPhoneKey();
    if (!key && !hasServerKey) {
      setNotice(
        "زيد مفتاح Gemini من زر مفتاح الذكاء الاصطناعي فوق، ومن بعد بدا المكالمة.",
      );
      return;
    }
    if (
      !window.isSecureContext ||
      !navigator.mediaDevices?.getUserMedia ||
      !window.AudioContext ||
      !window.AudioWorkletNode
    ) {
      setNotice(
        "هاد المتصفح ما كيدعمش المكالمة. حلّ رابط HTTPS فمتصفح محدّث، أو اختار المحادثة بالكتابة.",
      );
      return;
    }
    try {
      setPhase("connecting");
      setNotice("كنوجد الميكروفون والاتصال…");
      setLines([]);
      turn.current = 0;
      const session = new LiveCall({
        connected: () => {
          setPhase("active");
          setNotice("الميكروفون خدام");
        },
        status: setLive,
        ended: (reason) => {
          setPhase("idle");
          setNotice(reason);
          setLive(null);
          call.current = null;
        },
        turnEnd: () => {
          turn.current++;
        },
        transcript: (speaker, chunk) => {
          const seq = turn.current;
          setLines((previous) => {
            const items = [...previous];
            const index = items.findIndex(
              (l) => l.turn === seq && l.speaker === speaker,
            );
            if (index >= 0)
              items[index] = {
                ...items[index],
                text: items[index].text + chunk,
              };
            else items.push({ speaker, text: chunk, turn: seq });
            return items;
          });
        },
      });
      call.current = session;
      void session.start(key);
    } catch {
      stop("تعذّر تشغيل المكالمة فهاد المتصفح. تقدر تكمّل بالمحادثة النصية.");
    }
  }
  return (
    <section className="panel stack">
      <div>
        <h2>
          <PhoneCall size={20} />
          مكالمة صوتية مباشرة
        </h2>
        <p>
          هضر بالألمانية ولا بالدارجة. تقدر تقاطع الأستاذ وتجاوب فوقت ما بغيتي.
          الصوت كيمشي مباشرة لـ Google أثناء المكالمة.
        </p>
      </div>
      <div className="callActions">
        {phase === "idle" ? (
          <button className="btn primary" onClick={start}>
            <PhoneCall size={16} />
            بدا المكالمة
          </button>
        ) : (
          <button className="btn light" onClick={() => stop()}>
            <PhoneOff size={16} />
            {phase === "connecting" ? "إلغاء الاتصال" : "سالي المكالمة"}
          </button>
        )}
        <span className="liveState" role="status">
          {notice}
        </span>
        {phase === "active" && live && <LiveBadge status={live} />}
      </div>
      {lines.length > 0 && (
        <div className="liveLog" ref={log} role="log" aria-label="نص المكالمة">
          {lines.map((l, i) => (
            <p key={i}>
              <small>{l.speaker === "user" ? "نتا" : "الأستاذ وليد"}</small>
              <bdi dir="auto">{l.text}</bdi>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
function LiveBadge({ status }: { status: LiveStatus }) {
  const primaryRest = status.resting.find((r) => r.model === status.primary);
  const fallback = status.model !== status.primary;
  return (
    <bdi
      dir="ltr"
      className={
        "modelBadge " + (fallback ? "fallback " : "") + (primaryRest ? "resting" : "")
      }
      title={
        primaryRest
          ? "الموديل الأساسي كيرتاح، غادي نرجعو ليه فأول وقفة"
          : "الموديل ديال المكالمة"
      }
    >
      {status.switching ? "↻ " : ""}
      {status.model}
      {fallback && primaryRest
        ? ` · ${status.primary} ${primaryRest.seconds}s`
        : ""}
    </bdi>
  );
}
export function SpeakModes({ hasServerKey }: { hasServerKey: boolean }) {
  const [live, setLive] = useState(true);
  return (
    <div className="stack">
      <div className="callTabs">
        <button
          className="btn light"
          aria-pressed={live}
          onClick={() => setLive(true)}
        >
          <PhoneCall size={16} />
          مكالمة صوتية مباشرة
        </button>
        <button
          className="btn light"
          aria-pressed={!live}
          onClick={() => setLive(false)}
        >
          <MessageSquare size={16} />
          اضغط وتكلّم أو كتب
        </button>
      </div>
      {live ? <LiveRoom hasServerKey={hasServerKey} /> : <TutorRoom />}
    </div>
  );
}
