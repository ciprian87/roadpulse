import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { User, NewUser } from "@/lib/db/schema";

export async function getUserByEmail(email: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return rows[0] ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function createUser(
  data: Pick<NewUser, "email" | "password_hash" | "name">
): Promise<User> {
  const rows = await db
    .insert(users)
    .values({
      email: data.email,
      password_hash: data.password_hash,
      name: data.name,
      role: "driver",
    })
    .returning();

  if (!rows[0]) {
    throw new Error("User insert returned no rows");
  }
  return rows[0];
}

export async function updateUserPreferences(
  id: string,
  preferences: Record<string, unknown>
): Promise<void> {
  await db
    .update(users)
    .set({ preferences, updated_at: new Date() })
    .where(eq(users.id, id));
}
