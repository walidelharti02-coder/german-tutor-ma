// Vercel is always browser-owned, including deployments with unrelated DB variables.
export function usesSqlite() {
  return !process.env.VERCEL && Boolean(process.env.DATABASE_URL?.trim());
}
