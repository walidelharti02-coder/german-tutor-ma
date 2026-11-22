"use client";
import { useEffect, useRef, useState } from "react";
import { Volume2, Square, VolumeX } from "lucide-react";
import { voiceProvider } from "@/lib/voice";
import { plain } from "@/lib/types";
let active: AbortController | undefined;
export function Listen({ text }: { text: string }) {
  const [state, setState] = useState<"idle" | "playing" | "error">("idle");
  const current = useRef<AbortController | null>(null);
  useEffect(() => () => current.current?.abort(), []);
  async function play() {
    if (state === "playing") {
      current.current?.abort();
      return;
    }
    active?.abort();
    const c = new AbortController();
    active = c;
    current.current = c;
    setState("playing");
    try {
      await voiceProvider(false).speak(plain(text), {
        lang: "de-DE",
        speed: 0.9,
        signal: c.signal,
      });
      setState("idle");
    } catch {
      setState(c.signal.aborted ? "idle" : "error");
    }
  }
  const label =
    state === "playing"
      ? "وقف الصوت"
      : state === "error"
        ? "الصوت ما خدمش. عاود المحاولة"
        : "سمع النطق";
  return (
    <span className="listenWrap">
      <button
        className="listen"
        type="button"
        aria-label={label + " · " + plain(text)}
        title={label}
        onClick={play}
      >
        {state === "playing" ? (
          <Square size={15} />
        ) : state === "error" ? (
          <VolumeX size={17} />
        ) : (
          <Volume2 size={17} />
        )}
      </button>
      {state === "error" && <small role="status">الصوت ما خدمش</small>}
    </span>
  );
}
