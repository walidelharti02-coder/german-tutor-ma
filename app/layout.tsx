import type { Metadata } from "next";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/noto-sans-arabic/wght.css";
import "./globals.css";
import { Shell } from "@/components/shell";
import { vocabulary as words } from "@/lib/curriculum";
import { loadLocalLearner } from "@/lib/local-learner";
import { LearnerProvider } from "@/components/learner";
export const metadata: Metadata = {
  title: {
    default: "الأستاذ وليد | لوحة التعلّم",
    template: "%s | الأستاذ وليد",
  },
  description: "تعلم الألمانية بالدارجة المغربية مع الأستاذ وليد",
};
export const dynamic = "force-dynamic";
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const initial = await loadLocalLearner();
  const lexicon: Record<string, string> = {};
  for (const v of words) {
    const w = v.word.toLowerCase(),
      p = v.plural.toLowerCase();
    lexicon[w] =
      (lexicon[w] || "") + ({ der: "m", die: "f", das: "n" }[v.article] || "");
    lexicon[p] = (lexicon[p] || "") + "p";
  }
  return (
    <html lang="ary" dir="rtl">
      <body>
        <LearnerProvider value={initial}>
          <Shell lexicon={lexicon}>{children}</Shell>
        </LearnerProvider>
      </body>
    </html>
  );
}
