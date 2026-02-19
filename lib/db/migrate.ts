/**
 * Migration runner — executes in order:
 *   1. CREATE EXTENSION IF NOT EXISTS postgis
 *   2. All SQL files in /lib/db/migrations/ (alphabetical)
 *
 * Run with: npm run db:migrate
 */

import { readdir, readFile } from "fs/promises";
import path from "path";
import { Pool } from "pg";

async function migrate(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    console.log("Connecting to database…");

    // PostGIS must exist before any geometry column is created
    await client.query("CREATE EXTENSION IF NOT EXISTS postgis;");
    console.log("PostGIS extension verified.");

    const migrationsDir = path.join(process.cwd(), "lib/db/migrations");
    const files = (await readdir(migrationsDir))
      .filter((f) => f.endsWith(".sql"))
      .sort(); // alphabetical = chronological given the 000N_ prefix convention

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = await readFile(filePath, "utf8");
      console.log(`Running migration: ${file}`);
      await client.query(sql);
      console.log(`  ✓ ${file}`);
    }

    console.log("All migrations completed successfully.");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((err: unknown) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
