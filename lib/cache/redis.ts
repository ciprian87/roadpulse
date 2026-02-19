import Redis from "ioredis";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error("REDIS_URL environment variable is not set");
}

// Singleton Redis client. ioredis handles reconnection automatically.
// In development, prevent multiple connections across hot-reloads by using the global registry.
const globalForRedis = global as typeof globalThis & { _redis?: Redis };

const redis =
  globalForRedis._redis ??
  new Redis(redisUrl, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis._redis = redis;
}

// Surface connection errors without crashing — cache failures degrade gracefully.
// The ingest pipeline catches cache errors individually and continues without cache.
redis.on("error", (err: Error) => {
  process.stderr.write(`[Redis] ${err.message}\n`);
});

export async function cacheGet(key: string): Promise<string | null> {
  return redis.get(key);
}

export async function cacheSet(
  key: string,
  value: string,
  ttlSeconds: number
): Promise<void> {
  await redis.set(key, value, "EX", ttlSeconds);
}

export async function cacheDelete(key: string): Promise<void> {
  await redis.del(key);
}

export { redis };
