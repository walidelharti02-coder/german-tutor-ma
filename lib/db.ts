import { PrismaClient } from "@prisma/client";
const local = globalThis as unknown as { prisma?: PrismaClient };
export const db = local.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") local.prisma = db;
export const userId = "local";
export function endOfToday(now = new Date()) {
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  return end;
}
