#!/usr/bin/env node
// Applies the hand-written SQL files in drizzle/ (see CLAUDE.md's note on why
// `drizzle-kit generate`'s own migrator isn't used here) against the local
// SQLite file, in filename order, skipping any already applied. Run once at
// container startup (see Dockerfile/docker-compose.yml) and safe to re-run.

import Database from "better-sqlite3";
import { readdirSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "drizzle");
const dbPath = process.env.DATABASE_PATH ?? "./data/pigskinz.db";

// The Docker volume mount always exists as a directory, but a fresh local
// checkout's ./data doesn't -- better-sqlite3 refuses to create the file
// otherwise ("Cannot open database because the directory does not exist").
// Same fix as src/db/index.ts, needed here too since this runs as its own
// process before the app ever starts (see Dockerfile's CMD).
mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
  )
`);

const applied = new Set(db.prepare("SELECT name FROM _migrations").all().map((r) => r.name));

const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

for (const file of files) {
  if (applied.has(file)) continue;

  const sql = readFileSync(join(migrationsDir, file), "utf8");
  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`Applying ${file} (${statements.length} statement${statements.length === 1 ? "" : "s"})...`);

  const applyMigration = db.transaction(() => {
    for (const statement of statements) {
      db.exec(statement);
    }
    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(file, Date.now());
  });

  applyMigration();
}

console.log("Migrations up to date.");
db.close();
