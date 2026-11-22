import { notFound } from "next/navigation";
import Link from "next/link";
import { BookOpen, ChevronLeft } from "lucide-react";
import { modules } from "@/lib/curriculum";
import { LessonBody, LessonNumber } from "@/components/lesson";
import type { Example, Exercise } from "@/lib/types";
export default async function Page({
  params,
}: {
  params: Promise<{ lessonId: string }>;
}) {
  const { lessonId } = await params;
  const unit = modules.find((m) => m.lessons.some((l) => l.id === lessonId));
  const lesson = unit?.lessons.find((l) => l.id === lessonId);
  if (!unit || !lesson) notFound();
  const l = { ...lesson, module: unit };
  const next =
    unit.lessons[l.position]?.id ??
    modules[unit.position]?.lessons[0]?.id ??
    null;
  return (
    <>
      <div className="pageHeading">
        <div>
          <div className="eyeline">
            {l.module.title} <ChevronLeft size={13} /> الدرس {l.position} من 5
          </div>
          <h1>{l.title}</h1>
          <p dir="ltr" lang="de">
            {l.german}
          </p>
        </div>
      </div>
      <div className="lessonLayout">
        <LessonBody
          key={l.id}
          id={l.id}
          body={l.body}
          examples={l.examples as Example[]}
          exercises={l.exercises as Exercise[]}
          next={next}
        />
        <aside className="panel contents">
          <h2>
            <BookOpen size={19} />
            دروس الوحدة
          </h2>
          {l.module.lessons.map((x) => (
            <Link
              className={x.id === l.id ? "current" : ""}
              key={x.id}
              href={"/lessons/" + x.id}
            >
              <LessonNumber id={x.id} position={x.position} />
              {x.title}
            </Link>
          ))}
          <Link className="inlineLink" href="/#modules">
            جميع الوحدات <ChevronLeft size={14} />
          </Link>
        </aside>
      </div>
    </>
  );
}
