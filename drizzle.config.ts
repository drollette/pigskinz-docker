import { defineConfig } from "drizzle-kit";

// Used by `drizzle-kit studio` to browse the local SQLite file. Actual
// migrations are hand-written SQL files in drizzle/ applied by
// scripts/migrate.mjs at container startup -- see CLAUDE.md's note on why
// `drizzle-kit generate` isn't trusted blindly in this repo.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DATABASE_PATH ?? "./data/pigskinz.db",
  },
});
