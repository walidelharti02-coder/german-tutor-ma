import { usesSqlite } from "@/lib/storage-mode";
import { z } from "zod";
export async function POST(req: Request) {
  if (!usesSqlite())
    return Response.json(
      { error: "Progress is stored in this browser" },
      { status: 409 },
    );
  const { db, userId } = await import("@/lib/db");
  const result = z
    .object({ lessonId: z.string().max(100) })
    .safeParse(await req.json().catch(() => null));
  if (!result.success)
    return Response.json({ error: "Invalid lesson" }, { status: 400 });
  const { lessonId } = result.data;
  if (!(await db.lesson.findUnique({ where: { id: lessonId } })))
    return Response.json({ error: "Unknown lesson" }, { status: 404 });
  await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: { userId, lessonId },
    update: {},
  });
  return Response.json({ completed: true });
}
