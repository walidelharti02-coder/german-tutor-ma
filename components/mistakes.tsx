"use client";
import Link from "next/link";
import { Mic, NotebookPen } from "lucide-react";
import { useLearner } from "./learner";
import { errorLabels } from "@/lib/types";
import { German } from "@/components/german";
import { Listen } from "@/components/listen";
export function Mistakes() {
  const {
    state: { mistakes: items },
  } = useLearner();
  return (
    <>
      <div className="pageHeading">
        <div>
          <h1>دفتر الأخطاء</h1>
          <p>رجع للتصحيحات ديالك وفهم السبب بالدارجة.</p>
        </div>
        {items.length > 0 && (
          <Link className="btn primary" href="/review">
            راجع البطاقات
          </Link>
        )}
      </div>
      {!items.length ? (
        <div className="empty">
          <span className="emptyIcon">
            <NotebookPen />
          </span>
          <h2>الدفتر ديالك باقي خاوي</h2>
          <p>ملي الأستاذ يصحّح ليك شي جملة فالمحادثة، غتلقاها هنا.</p>
          <Link href="/speak" className="btn primary">
            <Mic size={17} />
            بدا محادثة
          </Link>
        </div>
      ) : (
        <div className="stack">
          {items.map((m) => (
            <article key={m.id} className="panel">
              <span className="leveltag">
                {errorLabels[m.errorType as keyof typeof errorLabels]}
              </span>
              <div className="correction">
                <small>الجملة ديالك</small>
                <div dir="auto">{m.sentence}</div>
                <small>التصحيح</small>
                <div className="fixed" dir="ltr">
                  <German text={m.correctedSentence} />
                  <Listen text={m.correctedSentence} />
                </div>
              </div>
              <p>{m.explanationDarija}</p>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
