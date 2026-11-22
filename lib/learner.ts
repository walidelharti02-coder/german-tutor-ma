import { z } from "zod";
import { mistakeSchema } from "./tutor";

export const learnerSchema = z.object({
  completed: z.array(z.string()),
  mistakes: z.array(
    mistakeSchema.extend({ id: z.string(), createdAt: z.string().datetime() }),
  ),
  reviews: z.array(
    z.object({
      id: z.string(),
      mistakeId: z.string(),
      dueAt: z.string().datetime(),
      intervalDays: z.number().int().nonnegative(),
    }),
  ),
});
export type Learner = z.infer<typeof learnerSchema>;
export const emptyLearner: Learner = {
  completed: [],
  mistakes: [],
  reviews: [],
};
export type Grade = "hard" | "medium" | "easy";
export function schedule(interval: number, grade: Grade, now = new Date()) {
  const steps = [1, 3, 7, 14, 30];
  const current = Math.max(0, steps.indexOf(interval));
  const days =
    grade === "hard"
      ? 1
      : steps[Math.min(4, current + (grade === "easy" ? 2 : 1))];
  const next = new Date(now);
  next.setHours(0, 0, 0, 0);
  next.setDate(next.getDate() + days);
  return { intervalDays: days, dueAt: next.toISOString() };
}
export function dueCards(reviews: Learner["reviews"], now = new Date()) {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return reviews
    .filter((r) => Date.parse(r.dueAt) < end.getTime())
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
}
