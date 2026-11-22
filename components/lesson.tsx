"use client";
import { useState } from "react";
import { useLearner } from "./learner";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Headphones,
  Lightbulb,
  ListChecks,
} from "lucide-react";
import { German, Legend } from "./german";
import { Listen } from "./listen";
import type { Example, Exercise } from "@/lib/types";
export function LessonBody({
  id,
  body,
  examples,
  exercises,
  next,
}: {
  id: string;
  body: string;
  examples: Example[];
  exercises: Exercise[];
  next: string | null;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  const learner = useLearner();
  const complete = learner.state.completed.includes(id);
  async function save() {
    setBusy(true);
    setError(false);
    try {
      await learner.complete(id);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <section className="panel lessonIntro">
        <h2>
          <Lightbulb size={21} />
          الشرح بالدارجة
        </h2>
        <p className="prose">{body}</p>
      </section>
      <section className="panel">
        <h2>
          <Headphones size={21} />
          سمع وعاود
        </h2>
        <Legend />
        {examples.map((e) => (
          <div className="example" key={e.de}>
            <div>
              <div className="deLine">
                <German text={e.de} />
              </div>
              <p>{e.ar}</p>
            </div>
            <Listen text={e.de} />
          </div>
        ))}
      </section>
      <section className="panel">
        <h2>
          <ListChecks size={21} />
          جرّب راسك
        </h2>
        {exercises.map((e, i) => (
          <div className="exercise" key={i}>
            <p dir="auto">{e.question}</p>
            <div className="options">
              {e.options.map((o, j) => (
                <div className="optionRow" key={o}>
                  <button
                    className={
                      "choice " +
                      (answers[i] === j
                        ? j === e.answer
                          ? "correct"
                          : "incorrect"
                        : "")
                    }
                    onClick={() => setAnswers((a) => ({ ...a, [i]: j }))}
                    aria-pressed={answers[i] === j}
                  >
                    <span className="radio" />
                    {/[\u0600-\u06ff]/.test(o) ? o : <German text={o} />}
                  </button>
                  {!/[\u0600-\u06ff]/.test(o) && <Listen text={o} />}
                </div>
              ))}
            </div>
            {answers[i] !== undefined && (
              <p
                role="status"
                className={answers[i] === e.answer ? "successBox" : "warnBox"}
              >
                {answers[i] === e.answer ? "صحيح! " : "عاود جرّب. "}
                {e.feedback}
              </p>
            )}
          </div>
        ))}
        <div className="actionRow">
          {complete ? (
            <>
              <span className="completed">
                <CheckCircle2 size={18} />
                الدرس مكتمل
              </span>
              <Link
                className="btn primary"
                href={next ? "/lessons/" + next : "/"}
              >
                {next ? "الدرس الموالي" : "رجع للوحة التعلّم"}
                <ArrowLeft size={16} />
              </Link>
            </>
          ) : (
            <button
              className="btn primary"
              disabled={
                busy || exercises.some((e, i) => answers[i] !== e.answer)
              }
              onClick={save}
            >
              <Check size={17} />
              {busy ? "كيتسجل…" : "كمّل وسجّل الدرس"}
            </button>
          )}
        </div>
        {error && <p role="alert">ما تسجّلش التقدّم. عاود المحاولة.</p>}
      </section>
    </div>
  );
}

export function LessonNumber({
  id,
  position,
}: {
  id: string;
  position: number;
}) {
  const { state } = useLearner();
  return state.completed.includes(id) ? (
    <CheckCircle2 size={17} />
  ) : (
    <b>{position}</b>
  );
}
