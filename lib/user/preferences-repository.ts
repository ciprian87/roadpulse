import { getUserById, updateUserPreferences } from "@/lib/auth/user-repository";

export interface UserPreferences {
  theme: "dark" | "light" | "system";
  defaultRegion?: string;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "dark",
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  // Merge stored prefs with defaults so new preference keys always have a value
  const stored = (user.preferences ?? {}) as Partial<UserPreferences>;
  return { ...DEFAULT_PREFERENCES, ...stored };
}

export async function setPreferences(
  userId: string,
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const current = await getPreferences(userId);
  const merged = { ...current, ...updates };
  await updateUserPreferences(userId, merged as Record<string, unknown>);
  return merged;
}
