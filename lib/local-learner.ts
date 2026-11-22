import { usesSqlite } from "./storage-mode";
import { learnerSchema } from "./learner";
export async function loadLocalLearner() {
  if (!usesSqlite()) return null;
  const { db, userId } = await import("./db");
  const [progress, mistakes, reviews] = await Promise.all([
    db.lessonProgress.findMany({
      where: { userId },
      select: { lessonId: true },
    }),
    db.mistake.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sentence: true,
        correctedSentence: true,
        errorType: true,
        explanationDarija: true,
        createdAt: true,
      },
    }),
    db.review.findMany({ where: { userId } }),
  ]);
  return learnerSchema.parse({
    completed: progress.map((p) => p.lessonId),
    mistakes: mistakes.map((m) => ({
      ...m,
      createdAt: m.createdAt.toISOString(),
    })),
    reviews: reviews.map((r) => ({ ...r, dueAt: r.dueAt.toISOString() })),
  });
}
