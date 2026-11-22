import { PrismaClient } from "@prisma/client";
import { readdir, readFile } from "node:fs/promises";
import { z } from "zod";

const prisma = new PrismaClient();
const exercise = z.object({
  question: z.string(),
  options: z.array(z.string()).length(3),
  answer: z.number().int().min(0).max(2),
  feedback: z.string(),
});
const lesson = z.object({
  title: z.string(),
  german: z.string(),
  body: z.string(),
  examples: z.array(z.object({ de: z.string(), ar: z.string() })).min(2),
  exercises: z.array(exercise).min(1),
});
const vocabulary = z.object({
  word: z.string(),
  article: z.enum(["der", "die", "das"]),
  plural: z.string(),
  meaning: z.string(),
  example: z.string(),
});
const moduleData = z.object({
  id: z.string(),
  position: z.number(),
  title: z.string(),
  german: z.string(),
  description: z.string(),
  lessons: z.array(lesson).length(5),
  vocabulary: z.array(vocabulary).length(25),
});
async function seed() {
  const files = (await readdir("content/a1"))
    .filter((f) => f.endsWith(".json"))
    .sort();
  if (files.length !== 6) throw new Error("Expected six A1 modules");
  const modules = await Promise.all(
    files.map(async (f) =>
      moduleData.parse(JSON.parse(await readFile("content/a1/" + f, "utf8"))),
    ),
  );
  await prisma.$transaction(
    async (db) => {
      await db.user.upsert({
        where: { id: "local" },
        create: { id: "local", name: "المتعلم", level: "A1" },
        update: {},
      });
      for (const { lessons, vocabulary, ...m } of modules) {
        await db.module.upsert({ where: { id: m.id }, create: m, update: m });
        for (const [index, l] of lessons.entries()) {
          const data = { ...l, position: index + 1, moduleId: m.id };
          const id = m.id + "-" + (index + 1);
          await db.lesson.upsert({
            where: { id },
            create: { id, ...data },
            update: data,
          });
        }
        for (const v of vocabulary) {
          const id = m.id + "-" + v.word;
          const data = { ...v, moduleId: m.id };
          await db.vocabulary.upsert({
            where: { id },
            create: { id, ...data },
            update: data,
          });
        }
      }
    },
    { timeout: 60000 },
  );
  console.log("Seeded 6 modules, 30 lessons and 150 vocabulary entries.");
}
seed()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
