import { db } from "@/lib/db";
import { savedRoutes } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type { SavedRoute, NewSavedRoute } from "@/lib/db/schema";

export type SavedRouteInput = Pick<
  NewSavedRoute,
  | "name"
  | "origin_address"
  | "origin_lat"
  | "origin_lng"
  | "destination_address"
  | "destination_lat"
  | "destination_lng"
  | "is_favorite"
>;

export async function getSavedRoutes(userId: string): Promise<SavedRoute[]> {
  return db
    .select()
    .from(savedRoutes)
    .where(eq(savedRoutes.user_id, userId))
    // Favorites first, then most recently created
    .orderBy(desc(savedRoutes.is_favorite), desc(savedRoutes.created_at));
}

export async function createSavedRoute(
  userId: string,
  data: SavedRouteInput
): Promise<SavedRoute> {
  const rows = await db
    .insert(savedRoutes)
    .values({ ...data, user_id: userId })
    .returning();

  if (!rows[0]) throw new Error("Saved route insert returned no rows");
  return rows[0];
}

export async function updateSavedRoute(
  id: string,
  userId: string,
  updates: Partial<Pick<SavedRoute, "name" | "is_favorite" | "last_checked_at">>
): Promise<SavedRoute | null> {
  const rows = await db
    .update(savedRoutes)
    .set(updates)
    .where(and(eq(savedRoutes.id, id), eq(savedRoutes.user_id, userId)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteSavedRoute(id: string, userId: string): Promise<boolean> {
  const rows = await db
    .delete(savedRoutes)
    .where(and(eq(savedRoutes.id, id), eq(savedRoutes.user_id, userId)))
    .returning({ id: savedRoutes.id });
  return rows.length > 0;
}
