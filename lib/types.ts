export type Example = { de: string; ar: string };
export type Exercise = {
  question: string;
  options: string[];
  answer: number;
  feedback: string;
};
export const colors = {
  m: "text-blue-600",
  f: "text-red-600",
  n: "text-green-600",
  p: "text-orange-500",
  d: "text-purple-600",
  a: "text-amber-500",
} as const;
export type Grammar = keyof typeof colors;
export const articleColor = {
  der: colors.m,
  die: colors.f,
  das: colors.n,
} as const;
export const plain = (s: string) => s.replace(/\{[mfnpda]:([^}]+)\}/g, "$1");
export const errorLabels = {
  artikel: "أداة التعريف",
  case: "الحالة الإعرابية",
  word_order: "ترتيب الكلمات",
  vocabulary: "المفردات",
  pronunciation: "النطق",
  style: "الأسلوب",
};
