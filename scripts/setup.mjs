import { copyFileSync, existsSync } from "node:fs";
if (!existsSync(".env")) copyFileSync(".env.example", ".env");
// Prisma 6 on some Linux hosts requires the initial SQLite file to exist.
if (!existsSync("prisma/dev.db")) {
  const { closeSync, openSync } = await import("node:fs");
  closeSync(openSync("prisma/dev.db", "a"));
}
