import { usesSqlite } from "@/lib/storage-mode";
import { z } from "zod";
import { schedule } from "@/lib/learner";
export async function POST(req: Request) {
  if (!usesSqlite())
    return Response.json(
      { error: "Progress is stored in this browser" },
      { status: 409 },
    );
  const { db, endOfToday, userId } = await import("@/lib/db");
  const input = z
    .object({
      id: z.string(),
      grade: z.enum(["hard", "medium", "easy"]),
      dueAt: z.string().datetime(),
    })
    .safeParse(await req.json().catch(() => null));
  if (!input.success)
    return Response.json({ error: "Invalid grade" }, { status: 400 });
  const { id, grade, dueAt } = input.data;
  const card = await db.review.findFirst({
    where: { id, userId, dueAt: { equals: new Date(dueAt), lt: endOfToday() } },
  });
  if (!card)
    return Response.json({ error: "Card already scheduled" }, { status: 409 });
  const { intervalDays: days, dueAt: next } = schedule(
    card.intervalDays,
    grade,
  );
  const updated = await db.review.updateMany({
    where: { id, userId, dueAt: card.dueAt },
    data: { intervalDays: days, dueAt: next },
  });
  return Response.json(
    updated.count
      ? { intervalDays: days, dueAt: next }
      : { error: "Card already scheduled" },
    { status: updated.count ? 200 : 409 },
  );
}
