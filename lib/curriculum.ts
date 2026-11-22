import introduction from "@/content/a1/01-kennenlernen.json";
import time from "@/content/a1/02-zeit.json";
import shopping from "@/content/a1/03-einkaufen.json";
import housing from "@/content/a1/04-wohnen.json";
import health from "@/content/a1/05-gesundheit.json";
import work from "@/content/a1/06-ausbildung.json";

// Match the stable identifiers used by the SQLite seed.
export const modules = [
  introduction,
  time,
  shopping,
  housing,
  health,
  work,
].map((m) => ({
  ...m,
  lessons: m.lessons.map((l, index) => ({
    ...l,
    id: m.id + "-" + (index + 1),
    position: index + 1,
  })),
  vocabulary: m.vocabulary
    .map((v) => ({ ...v, id: m.id + "-" + v.word, moduleId: m.id }))
    .sort((a, b) => a.word.localeCompare(b.word, "de")),
}));
export const vocabulary = modules.flatMap((m) => m.vocabulary);
