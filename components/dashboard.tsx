"use client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  BookOpenText,
  Check,
  ChevronLeft,
  GraduationCap,
  Layers3,
  Mic,
  Play,
  Route,
} from "lucide-react";
import { useLearner } from "./learner";
import { dueCards } from "@/lib/learner";
import { DateLabel } from "@/components/shell";
type Props = {
  modules: {
    id: string;
    position: number;
    german: string;
    title: string;
    lessons: { id: string }[];
  }[];
  words: number;
  date: string;
};
export function Dashboard({ modules, words, date }: Props) {
  const { state } = useLearner();
  const due = dueCards(state.reviews).length;
  const completed = new Set(state.completed),
    all = modules.flatMap((m) => m.lessons),
    next = all.find((l) => !completed.has(l.id)) ?? all[0];
  const percent = all.length
    ? Math.round((completed.size / all.length) * 100)
    : 0;
  return (
    <>
      <div className="pageHeading">
        <div>
          <h1>لوحة التعلّم</h1>
          <p>مرحبا بيك! هادي هي رحلتك فتعلّم الألمانية.</p>
        </div>
        <DateLabel date={date} />
      </div>
      <section className="hero">
        <Image
          className="heroArt"
          src="/art/berlin.webp"
          alt="رسم لبوابة براندنبورغ وبرج التلفزيون فبرلين"
          width={1000}
          height={667}
          priority
        />
        <div className="heroText">
          <span className="leveltag">
            <GraduationCap size={16} />
            <bdi>A1</bdi>
            <i /> المستوى المبتدئ
          </span>
          <h2>
            رحلتك مع الألمانية
            <br />
            كتبدا من هنا<span>.</span>
          </h2>
          <p>دروس بالدارجة ومحادثات من الحياة اليومية.</p>
          <div className="heroActions">
            {next && (
              <Link className="btn primary" href={"/lessons/" + next.id}>
                <Play size={15} fill="currentColor" />
                {completed.size ? "كمّل التعلّم" : "بدا أول درس"}
              </Link>
            )}
            <Link className="btn light" href="/speak">
              <Mic size={16} />
              هضر مع الأستاذ
            </Link>
          </div>
        </div>
      </section>
      <div className="metrics">
        <div className="metric">
          <span className="metricIcon violet">
            <Route />
          </span>
          <div className="metricInfo">
            <small>التقدّم ديالك</small>
            <strong dir="ltr">{percent}%</strong>
          </div>
          <div
            className="metricProgress"
            role="progressbar"
            aria-label="التقدم فدروس A1"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <span style={{ width: percent + "%" }} />
          </div>
        </div>
        <Link href="/vocabulary" className="metric">
          <span className="metricIcon mint">
            <BookOpenText />
          </span>
          <div className="metricInfo">
            <small>بنك المفردات</small>
            <strong>
              {words} <em>كلمة</em>
            </strong>
          </div>
          <ChevronLeft className="metricArrow" size={16} />
        </Link>
        <Link href="/review" className="metric">
          <span className="metricIcon peach">
            <Layers3 />
          </span>
          <div className="metricInfo">
            <small>مراجعة اليوم</small>
            <strong>
              {due} <em>بطاقات</em>
            </strong>
          </div>
          <ChevronLeft className="metricArrow" size={16} />
        </Link>
      </div>
      <section id="modules">
        <div className="sectionTitle">
          <div>
            <h2>الوحدات الدراسية</h2>
            <p>ست وحدات باش تبني الأساس ديالك خطوة بخطوة.</p>
          </div>
          <span className="countTag">
            <BookOpen size={15} />
            {modules.length} وحدات
          </span>
        </div>
        <div className="moduleGrid">
          {modules.map((m) => {
            const count = m.lessons.filter((l) => completed.has(l.id)).length;
            const first =
              m.lessons.find((l) => !completed.has(l.id)) ?? m.lessons[0];
            return (
              <Link
                className="moduleCard"
                href={"/lessons/" + first.id}
                key={m.id}
              >
                <div className={"poster poster" + m.position}>
                  <Image
                    src={"/art/module-" + m.position + ".webp"}
                    alt=""
                    width={504}
                    height={504}
                  />
                  <span className="moduleTag">
                    الوحدة <b>{String(m.position).padStart(2, "0")}</b>
                  </span>
                </div>
                <div className="moduleContent">
                  <small lang="de" dir="ltr">
                    {m.german}
                  </small>
                  <h3>{m.title}</h3>
                  <div className="moduleFooter">
                    <span>
                      <BookOpen size={14} />5 دروس
                    </span>
                    <span>
                      {count === 5 ? (
                        <Check size={15} />
                      ) : (
                        <ArrowLeft size={16} />
                      )}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
