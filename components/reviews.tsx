"use client";
import Link from "next/link";
import { useState } from "react";
import { useLearner } from "./learner";
import { dueCards, type Grade } from "@/lib/learner";
import { CheckCheck, Layers3, RotateCcw } from "lucide-react";
import { German } from "./german";
import { Listen } from "./listen";
export function Reviews() {
  const learner = useLearner();
  const cards = dueCards(learner.state.reviews);
  const [revealed, setRevealed] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const c = cards[0],
    mistake = learner.state.mistakes.find((m) => m.id === c?.mistakeId);
  const show = c?.id === revealed;
  async function grade(rating: Grade) {
    setBusy(true);
    setError("");
    try {
      await learner.grade(c.id, c.dueAt, rating);
      setRevealed("");
    } catch {
      setError("ما تسجلاتش المراجعة. عاود المحاولة.");
    } finally {
      setBusy(false);
    }
  }
  if (!c || !mistake)
    return (
      <div className="empty">
        <span className="emptyIcon">
          <CheckCheck />
        </span>
        <h2>ساليتي مراجعة اليوم</h2>
        <p>ملي توصل نوبة شي بطاقة، غتلقاها هنا.</p>
        <Link className="btn primary" href="/speak">
          تمرّن مع الأستاذ
        </Link>
      </div>
    );
  return (
    <section className="panel reviewCard">
      <span className="leveltag">
        <Layers3 size={16} />
        بطاقات باقية: {cards.length}
      </span>
      <h2>كيفاش تصلّح هاد الجملة؟</h2>
      <div className="promptSentence" dir="auto">
        {mistake.sentence}
      </div>
      {show ? (
        <>
          <div className="example">
            <German text={mistake.correctedSentence} />
            <Listen text={mistake.correctedSentence} />
          </div>
          <p>{mistake.explanationDarija}</p>
          <h3>كيف جاتك هاد البطاقة؟</h3>
          <div className="actionRow">
            {[
              ["hard", "صعيبة", "Hard"],
              ["medium", "متوسطة", "Medium"],
              ["easy", "ساهلة", "Easy"],
            ].map(([key, ar, en]) => (
              <button
                key={key}
                className="btn light"
                disabled={busy}
                onClick={() => grade(key as Grade)}
              >
                {ar} <small>{en}</small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button className="btn primary" onClick={() => setRevealed(c.id)}>
          <RotateCcw size={16} />
          شوف التصحيح
        </button>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
