"use client";
import Link from "next/link";
import { KeySettings } from "./key-settings";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  GraduationCap,
  Headphones,
  House,
  Layers3,
  LayoutDashboard,
  Menu,
  MessagesSquare,
  Mic,
  NotebookPen,
  X,
} from "lucide-react";
import { LexiconContext, type Lexicon } from "./german";
const nav = [
  { href: "/", label: "لوحة التعلّم", icon: LayoutDashboard },
  { href: "/#modules", label: "الوحدات الدراسية", icon: BookOpen },
  { href: "/vocabulary", label: "بنك المفردات", icon: BookOpenText },
  { href: "/speak", label: "غرفة المحادثة", icon: Mic },
  { href: "/mistakes", label: "دفتر الأخطاء", icon: NotebookPen },
  { href: "/review", label: "المراجعة اليومية", icon: Layers3 },
];
export function Shell({
  children,
  lexicon,
  hasServerKey,
}: {
  hasServerKey: boolean;
  children: React.ReactNode;
  lexicon: Lexicon;
}) {
  const path = usePathname(),
    [open, setOpen] = useState(false),
    [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [path]);
  useEffect(() => {
    if (!open) return;
    const close = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open]);
  const active =
    path.startsWith("/lessons") || (path === "/" && hash === "#modules")
      ? "/#modules"
      : path;
  return (
    <LexiconContext.Provider value={lexicon}>
      <div className="shell">
        {open && (
          <button
            className="veil"
            aria-label="سد القائمة"
            onClick={() => setOpen(false)}
          />
        )}
        <aside className={"sidebar " + (open ? "expanded" : "")}>
          <Link
            href="/"
            onClick={() => {
              setOpen(false);
              setHash("");
            }}
            className="brand"
          >
            <span className="brandmark">
              <MessagesSquare size={31} strokeWidth={2.4} />
            </span>
            <span>
              <strong>الأستاذ وليد</strong>
              <small lang="de">Oustad Walid</small>
            </span>
          </Link>
          <button
            className="closeMenu"
            aria-label="سد القائمة"
            onClick={() => setOpen(false)}
          >
            <X />
          </button>
          <div className="navtitle">مساحة التعلّم</div>
          <nav aria-label="القائمة الرئيسية">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link
                href={href}
                key={href}
                className={active === href ? "selected" : ""}
                aria-current={active === href ? "page" : undefined}
                onClick={() => {
                  setOpen(false);
                  setHash(href.includes("#") ? "#modules" : "");
                }}
              >
                <Icon size={19} />
                <span>{label}</span>
                {active === href && <i />}
              </Link>
            ))}
          </nav>
          <div className="sidefoot">
            <div className="sidecourse">
              <GraduationCap size={23} />
              <div>
                <small>المسار الحالي</small>
                <strong>الألمانية للمبتدئين</strong>
              </div>
              <b lang="de">A1</b>
            </div>
            <div className="profile">
              <span>
                <Headphones size={18} />
              </span>{" "}
              حساب المتعلّم المحلي
            </div>
          </div>
        </aside>
        <main>
          <header className="topbar">
            <div className="crumb">
              <button
                className="menuBtn"
                aria-label="فتح القائمة"
                aria-expanded={open}
                onClick={() => setOpen(true)}
              >
                <Menu />
              </button>
              <House size={16} />
              <span>مساحتي</span>
              <ChevronLeft size={13} />
              <strong>
                {nav.find((n) => n.href === active)?.label || "الدرس"}
              </strong>
            </div>
            <div className="topActions">
              <KeySettings hasServerKey={hasServerKey} />
              <span className="langpill" dir="ltr">
                <i className="flag" /> Deutsch <b>·</b> A1
              </span>
            </div>
          </header>
          <div className="page">{children}</div>
        </main>
      </div>
    </LexiconContext.Provider>
  );
}
export function DateLabel({ date }: { date: string }) {
  return (
    <span className="date">
      <CalendarDays size={16} />
      {date}
    </span>
  );
}
