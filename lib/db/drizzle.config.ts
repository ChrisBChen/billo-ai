import { defineConfig } from "drizzle-kit";
import path from "path";

if (!(process.env.DATABASE_URL ?? process.env.POSTGRES_URL)) {
  throw new Error("DATABASE_URL, set it to a Postgres connection string");
}

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: (process.env.DATABASE_URL ?? process.env.POSTGRES_URL)!,
  },
});
