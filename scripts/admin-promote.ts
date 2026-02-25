/**
 * Promote a user to the admin role.
 * Usage: npm run admin:promote <email>
 */
import { Pool } from "pg";

async function promote(): Promise<void> {
  const email = process.argv[2];
  if (!email) {
    process.stderr.write("Usage: npm run admin:promote <email>\n");
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    process.stderr.write("DATABASE_URL environment variable is not set\n");
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    const result = await pool.query<{ email: string; role: string }>(
      "UPDATE users SET role = 'admin', updated_at = NOW() WHERE email = $1 RETURNING email, role",
      [email.toLowerCase()]
    );
    if ((result.rowCount ?? 0) === 0) {
      process.stderr.write(`No user found with email: ${email}\n`);
      process.exit(1);
    }
    process.stdout.write(`Promoted ${result.rows[0].email} to admin.\n`);
  } finally {
    await pool.end();
  }
}

promote().catch((err: unknown) => {
  process.stderr.write(`Error: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
