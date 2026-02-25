import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// A single shared connection pool for the application.
// DATABASE_URL must be set; fail fast on startup if it's missing.
const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new Pool({
  connectionString: databaseUrl,
  // In production the database may be on a remote host — require TLS so credentials
  // and query data are never transmitted in plaintext over the network.
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  // Keep idle connections for up to 30 seconds; 10 connections is enough for dev/staging.
  idleTimeoutMillis: 30_000,
  max: 10,
});

export const db = drizzle(pool, { schema });

// Export pool separately so migrate.ts can use it directly for raw SQL
export { pool };
