"use client";
import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
} from "react";
import { useRouter } from "next/navigation";
import {
  emptyLearner,
  learnerSchema,
  schedule,
  type Grade,
  type Learner,
} from "@/lib/learner";
import type { Reply } from "@/lib/tutor";
import { migrateLegacyKey } from "@/lib/phone-key";

const storageKey = "oustad-walid.learner.v1",
  changed = "oustad-learner-changed";
const LocalContext = createContext<Learner | null>(null);
export function LearnerProvider({
  value,
  children,
}: {
  value: Learner | null;
  children: React.ReactNode;
}) {
  return (
    <LocalContext.Provider value={value}>{children}</LocalContext.Provider>
  );
}
function subscribe(fn: () => void) {
  window.addEventListener("storage", fn);
  window.addEventListener(changed, fn);
  return () => {
    window.removeEventListener("storage", fn);
    window.removeEventListener(changed, fn);
  };
}
function snapshot() {
  try {
    migrateLegacyKey(storageKey, "oustad-amin.learner.v1");
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}
function decode(value: string | null): Learner {
  return value ? learnerSchema.parse(JSON.parse(value)) : emptyLearner;
}
async function update(edit: (s: Learner) => Learner) {
  function write() {
    migrateLegacyKey(storageKey, "oustad-amin.learner.v1");
    const next = edit(decode(localStorage.getItem(storageKey)));
    localStorage.setItem(storageKey, JSON.stringify(next));
    window.dispatchEvent(new Event(changed));
  }
  if (navigator.locks) await navigator.locks.request(storageKey, write);
  else write();
}
async function post(path: string, data: unknown) {
  return fetch("/api/" + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}
export function useLearner() {
  const local = useContext(LocalContext),
    router = useRouter();
  const raw = useSyncExternalStore(subscribe, snapshot, () => null);
  const state = useMemo(() => {
    if (local) return local;
    try {
      return decode(raw);
    } catch {
      return emptyLearner;
    }
  }, [local, raw]);
  async function complete(lessonId: string) {
    if (local) {
      if (!(await post("progress", { lessonId })).ok) throw Error();
      router.refresh();
      return;
    }
    await update((s) =>
      s.completed.includes(lessonId)
        ? s
        : { ...s, completed: [...s.completed, lessonId] },
    );
  }
  async function corrections(turnId: string, items: Reply["mistakes"]) {
    if (!items.length) return;
    if (local) {
      router.refresh();
      return;
    }
    const time = new Date().toISOString();
    await update((s) => {
      const added = items
        .map((m, i) => ({ ...m, id: turnId + "-" + i, createdAt: time }))
        .filter((m) => !s.mistakes.some((old) => old.id === m.id));
      return {
        ...s,
        mistakes: [...added, ...s.mistakes],
        reviews: [
          ...s.reviews,
          ...added.map((m) => ({
            id: m.id,
            mistakeId: m.id,
            dueAt: time,
            intervalDays: 0,
          })),
        ],
      };
    });
  }
  async function grade(id: string, dueAt: string, rating: Grade) {
    if (local) {
      const res = await post("review", { id, dueAt, grade: rating });
      if (!res.ok && res.status !== 409) throw Error();
      router.refresh();
      return;
    }
    await update((s) => ({
      ...s,
      reviews: s.reviews.map((r) =>
        r.id === id && r.dueAt === dueAt
          ? { ...r, ...schedule(r.intervalDays, rating) }
          : r,
      ),
    }));
  }
  return { state, complete, corrections, grade };
}
