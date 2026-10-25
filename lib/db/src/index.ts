import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Add a Postgres database (e.g. Neon via the Vercel Marketplace).",
  );
}

// Serverless functions each hold their own pool, so keep it small and let idle
// connections go quickly. Use the provider's pooled connection string.
export const pool = new Pool({
  connectionString,
  max: Number(process.env.DATABASE_POOL_MAX ?? 3),
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
