# RoadPulse Security Audit Report
Date: 2026-02-25

## Executive Summary

A comprehensive security audit of the RoadPulse codebase was conducted, examining all API routes, authentication flows, database interactions, Redis usage, external API integrations, and infrastructure configuration.

- **Total findings: 22**
- **Critical: 2, High: 5, Medium: 9, Low: 6**

### Top 3 Priorities to Fix Immediately

1. **[CRIT-01]** `/api/cron/ingest` is publicly accessible with zero authentication — any attacker can trigger feed ingestion and exhaust external API quotas (OpenRouteService 2000/day) on demand.
2. **[CRIT-02]** `/api/admin/ingest` has no authentication at all — the comment states "No auth required in Phase 3 — add NextAuth protection before going to production" but this endpoint is live and exposes full ingestion control to unauthenticated callers.
3. **[HIGH-01]** No brute-force protection on the login endpoint (`/api/auth/[...nextauth]`) — NextAuth's Credentials provider processes unlimited password attempts with no rate limit, enabling automated credential stuffing.

---

## Critical Findings

### [CRIT-01] Unauthenticated Cron Ingest Endpoint
**File:** `app/api/cron/ingest/route.ts:14-22`
**Vulnerability:** Both `GET` and `POST` handlers call `runAllIngestJobs()` with no authentication check. A comment in the file acknowledges this: _"In production, protect this route with a secret header: if (request.headers.get("x-cron-secret") !== process.env.CRON_SECRET) → 401"_ — but the check was never implemented.
**Attack Scenario:** An attacker can call `GET /api/cron/ingest` repeatedly, exhausting the OpenRouteService free-tier quota (2,000 requests/day), overloading the NWS API (violating their ~1 req/s requirement), hammering 511 feeds, and filling up the database with ingestion log rows. This is a trivially exploitable denial-of-service that also burns third-party API quotas.
**Fix:**
```typescript
export async function GET(request: NextRequest): Promise<NextResponse<CronResponse>> {
  const secret = request.headers.get("x-cron-secret");
  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  const results = await runAllIngestJobs();
  return NextResponse.json({ results, timestamp: new Date().toISOString() });
}
```
Add `CRON_SECRET` to `.env.example` and generate a 32-byte random hex value in production.

---

### [CRIT-02] Unauthenticated Admin Ingest Trigger
**File:** `app/api/admin/ingest/route.ts:24-25`
**Vulnerability:** The `POST /api/admin/ingest` endpoint has an explicit comment: _"No auth required in Phase 3 — add NextAuth protection before going to production."_ The authentication guard was never added. Any unauthenticated caller can trigger any registered feed adapter or the entire ingestion pipeline.
**Attack Scenario:** An attacker can enumerate all registered feed adapters via the error message in the 400 response (`error: Unknown feed: X. Valid values: all, nws-alerts, iowa-wzdx, ...`), selectively trigger individual feeds to cause targeted API abuse, or call `feed=all` in a loop to exhaust all external API rate limits simultaneously.
**Fix:**
```typescript
export async function POST(request: NextRequest): Promise<NextResponse<...>> {
  // Add this block at the top of the handler, before body parsing:
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  // ... rest of handler unchanged
}
```

---

## High Findings

### [HIGH-01] No Rate Limiting on Login Endpoint
**File:** `app/api/auth/[...nextauth]/route.ts` (NextAuth handler) and `lib/auth/config.ts:19-37`
**Vulnerability:** The NextAuth Credentials provider `authorize` callback performs a `bcrypt.compare` (compute-intensive) on every call with no rate limiting. The `/api/auth/callback/credentials` POST endpoint is fully unprotected against brute-force attacks. There is no login attempt counter, lockout mechanism, or IP-based throttle.
**Attack Scenario:** An attacker with a list of known email addresses can mount a credential stuffing or password spray attack. Each bcrypt comparison at 12 rounds takes ~200ms of CPU, which also constitutes a CPU exhaustion DoS at sufficient request rates.
**Fix:**
```typescript
// In lib/auth/config.ts, inside the authorize callback:
authorize: async (credentials) => {
  const email = credentials?.email as string | undefined;
  const password = credentials?.password as string | undefined;
  if (!email || !password) return null;

  // Rate limit per email (prevents targeted brute force)
  const rl = await checkRateLimit(`rl:login:${email.toLowerCase()}`, 10, 900).catch(() => ({ allowed: true }));
  if (!rl.allowed) return null;  // NextAuth treats null as auth failure

  const user = await getUserByEmail(email);
  if (!user || !user.password_hash) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  return { id: user.id, email: user.email, name: user.name ?? undefined, role: user.role };
},
```

---

### [HIGH-02] No Rate Limiting on User Registration Endpoint
**File:** `app/api/auth/register/route.ts:17-67`
**Vulnerability:** `POST /api/auth/register` has no rate limiting. Any caller can create unlimited user accounts. Each registration call also does a `getUserByEmail` database read (timing oracle for email enumeration) and a `bcrypt.hash(password, 12)` which takes ~200ms of CPU per call.
**Attack Scenario:** An attacker can flood the registration endpoint to: (1) fill the users table with garbage accounts, (2) exhaust database connection pool, (3) DoS the server via bcrypt CPU exhaustion, (4) enumerate valid email addresses by comparing response timing between "An account with that email already exists" (fast — no bcrypt) and new registration (slow — bcrypt hash computed).
**Fix:**
```typescript
export async function POST(req: NextRequest): Promise<NextResponse> {
  // Add IP-based rate limit at the top:
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rl:register:${ip}`, 5, 3600).catch(() => ({ allowed: true }));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many registration attempts. Try again later.", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }
  // ... rest unchanged
}
```
Also mitigate the email enumeration oracle by using a constant-time response pattern (always hash, always return success, validate asynchronously via email).

---

### [HIGH-03] SQL Injection via `($1 || ' days')::INTERVAL` Pattern
**File:** `lib/admin/usage-repository.ts:103`, `lib/admin/user-admin-repository.ts:165`, `lib/admin/ingestion-repository.ts:88`
**Vulnerability:** The pattern `NOW() - ($1 || ' days')::INTERVAL` concatenates a parameterized integer with the string `' days'` inside PostgreSQL's INTERVAL cast. While the `$1` parameter itself is sanitized by the pg driver, PostgreSQL evaluates this as dynamic SQL string construction inside the query. If a future code change passes a non-integer `days` value (e.g., from a user-controlled source without proper sanitization), this becomes a SQL injection point. Currently, admin API callers control this value and it is clamped to `Math.min(days, 90)`, but the pattern itself is dangerous.

Additionally, in `lib/community/report-repository.ts:149`, the template literal `` `NOW() + INTERVAL '${expiryHours} hours'` `` is concatenated directly into SQL. While `expiryHours` comes from a hardcoded constant (`REPORT_EXPIRY_HOURS`) keyed by a validated enum type, this pattern violates the project's own standard of parameterized queries and creates a maintenance trap.
**Attack Scenario:** If any caller passes a string like `0); DROP TABLE users; --` and the `Math.min` or `parseInt` guard is bypassed (e.g., `NaN` from `parseInt("abc")` produces `NaN`, and `Math.min(NaN, 90)` returns `NaN`), the INTERVAL construction would fail. More broadly, the pattern is a footgun for future developers.
**Fix:**
```typescript
// In usage-repository.ts and similar — use INTERVAL with multiplication instead:
WHERE created_at >= NOW() - ($1 * INTERVAL '1 day')
// Parameter: [days]  (already an integer — no string concatenation needed)

// In report-repository.ts — use a parameter:
INSERT INTO community_reports (..., expires_at)
VALUES (..., NOW() + ($1 * INTERVAL '1 hour'))
// Parameter at position N: [expiryHours]
```

---

### [HIGH-04] No Security Headers Configured
**File:** `next.config.ts:53-58`
**Vulnerability:** The Next.js config contains no `headers()` function. As a result, responses lack: `Strict-Transport-Security` (HSTS), `X-Content-Type-Options`, `X-Frame-Options`, `Content-Security-Policy`, `Referrer-Policy`, and `Permissions-Policy`. Notably, the absence of CSP means no protection against cross-site scripting if any future XSS is introduced, and no frame-busting protection.
**Attack Scenario:** Without `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`, the app is vulnerable to clickjacking. Without `X-Content-Type-Options: nosniff`, browsers may MIME-sniff JSON responses as executable content. Without HSTS, users on HTTP connections are vulnerable to SSL stripping.
**Fix:**
```typescript
// In next.config.ts:
const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",  // 'unsafe-inline' needed for Next.js inline scripts; tighten with nonces in a later phase
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https://*.basemaps.cartocdn.com https://*.openstreetmap.org",
              "connect-src 'self' https://api.openrouteservice.org https://api.weather.gov https://nominatim.openstreetmap.org",
              "frame-ancestors 'none'",
            ].join("; "),
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
};
```

---

### [HIGH-05] Unauthenticated Health Endpoint Exposes Internal Infrastructure Details
**File:** `app/api/health/route.ts:116-125`
**Vulnerability:** `GET /api/health` is publicly accessible (no auth check) and returns: database connection status, PostGIS availability, row counts for all 7 production tables (road_events, weather_alerts, users, saved_routes, community_reports, feed_status), and Redis connection status. This is a reconnaissance goldmine for attackers.
**Attack Scenario:** An attacker can determine: whether the app is running, exact database schema table names, approximate user count, whether a data store is reachable, and when the app is newly deployed (row counts near zero). This information directly aids targeted attacks.
**Fix:**
```typescript
// Add a bearer token check or restrict to internal network:
export async function GET(request: NextRequest): Promise<NextResponse<HealthResponse>> {
  const secret = request.headers.get("x-health-token");
  if (process.env.NODE_ENV === "production" && secret !== process.env.HEALTH_TOKEN) {
    // Return minimal status without internal details
    return NextResponse.json({ status: "ok" }, { status: 200 });
  }
  const [database, redis] = await Promise.all([checkDatabase(), checkRedis()]);
  // ... rest unchanged
}
```

---

## Medium Findings

### [MED-01] `X-Forwarded-For` IP Spoofing in Rate Limiter
**File:** `lib/middleware/rate-limit.ts:37-40`
**Vulnerability:** The `getClientIp` function reads `x-forwarded-for` directly from the request header without validating that the request is actually coming from a trusted proxy. Any client can set an arbitrary `X-Forwarded-For: 1.2.3.4` header to bypass IP-based rate limits.
**Attack Scenario:** An attacker making route check or event requests can rotate through arbitrary IP strings in the `X-Forwarded-For` header on every request, completely bypassing all IP-based rate limits on `/api/route/check`, `/api/events`, `/api/weather/alerts`, and `/api/auth/register`.
**Fix:**
```typescript
// In lib/middleware/rate-limit.ts — only trust the header when behind a known proxy:
export function getClientIp(request: Request): string {
  // In production behind a load balancer/CDN, only use x-forwarded-for if trusted.
  // For Vercel: use x-real-ip which Vercel sets and clients cannot spoof.
  const realIp = (request as NextRequest).headers.get("x-real-ip");
  if (realIp) return realIp.trim();

  const forwarded = request.headers.get("x-forwarded-for");
  // Only take the LAST address (the one added by your trusted proxy),
  // not the first (which clients can forge).
  if (forwarded) {
    const parts = forwarded.split(",");
    return parts[parts.length - 1]?.trim() ?? "unknown";
  }
  return "unknown";
}
```

---

### [MED-02] No JWT Session Expiry Configured
**File:** `lib/auth/auth.config.ts:6-40`
**Vulnerability:** The `authConfig` object sets `session: { strategy: "jwt" }` but does not configure `session.maxAge`. NextAuth v5 defaults to 30 days for JWT sessions. There is no explicit token rotation or short-lived token policy. Once a JWT is issued, it remains valid for 30 days even if the user's role changes or their account is deactivated.
**Attack Scenario:** An admin demotes a user from admin to driver via the admin panel. The user's existing JWT (30-day validity) continues to pass `session.user.role === "admin"` checks until it expires. Since the JWT is not stored server-side, there is no revocation mechanism. A compromised admin JWT is valid for 30 days.
**Fix:**
```typescript
// In lib/auth/auth.config.ts:
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt" as const,
    maxAge: 24 * 60 * 60,       // 24 hours for regular users
    updateAge: 60 * 60,          // Refresh token if >1 hour old on activity
  },
  // ...
};
// For admin roles, consider re-fetching the user's current role in the jwt() callback
// to detect role changes without waiting for expiry:
callbacks: {
  async jwt({ token, user, trigger }) {
    if (user) {
      token.id = user.id as string;
      token.role = user.role;
    }
    // On every session access, re-validate role from DB for admin tokens:
    if (token.role === "admin" && trigger !== "signIn") {
      const dbUser = await getUserById(token.id as string);
      token.role = dbUser?.role ?? "driver";
    }
    return token;
  },
}
```

---

### [MED-03] No Coordinate Bounds Validation on Route Check Inputs
**File:** `app/api/route/check/route.ts:238-245` and `248-291`
**Vulnerability:** When caller-supplied `originLat`, `originLng`, `destinationLat`, `destinationLng` are provided, they are passed directly to `fetchRoute()` (OpenRouteService API) and then to PostGIS without validating they are within valid WGS 84 bounds (lat: -90..90, lng: -180..180). The `isWithinUS` check only applies to community reports, not to route checks.
**Attack Scenario:** Supplying `lat=999` or `lat=NaN` to the ORS API will cause an ORS error, which is handled gracefully. However, extreme values like `lat=89.9&lng=-179.9` allow generating route corridors covering most of the Western hemisphere, triggering PostGIS ST_Buffer operations on transcontinental geometry. Combined with the 30 req/min rate limit, this could cause extreme PostGIS CPU load.
**Fix:**
```typescript
// In app/api/route/check/route.ts, add after parsing lat/lng params:
function isValidCoordinate(lat: number | undefined, lng: number | undefined): boolean {
  if (lat === undefined || lng === undefined) return true; // geocode will handle
  return isFinite(lat) && isFinite(lng) &&
         lat >= -90 && lat <= 90 &&
         lng >= -180 && lng <= 180;
}

// Before calling handleCheck:
if (!isValidCoordinate(data.originLat, data.originLng) ||
    !isValidCoordinate(data.destinationLat, data.destinationLng)) {
  return NextResponse.json(
    { error: "Invalid coordinates — lat must be -90..90, lng -180..180", code: "INVALID_COORDS" },
    { status: 400 }
  );
}
```

---

### [MED-04] No Rate Limiting on Geocode Endpoint (ORS API Quota Exhaustion)
**File:** `app/api/route/geocode/route.ts:5-23`
**Vulnerability:** `GET /api/route/geocode?q=...` calls OpenRouteService's geocoding API on every request with no rate limiting. ORS free tier has 2,000 requests/day across all endpoints. Any unauthenticated caller can drain this budget with a simple loop.
**Attack Scenario:** An attacker loops `GET /api/route/geocode?q=a`, `?q=b`, etc. and exhausts the daily ORS quota within seconds, breaking geocoding and routing for all legitimate users for the rest of the day.
**Fix:**
```typescript
// In app/api/route/geocode/route.ts:
import { checkRateLimit, getClientIp } from "@/lib/middleware/rate-limit";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`rl:geocode:${ip}`, 30, 60).catch(() => ({ allowed: true }));
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded", code: "RATE_LIMITED" },
      { status: 429 }
    );
  }
  // ... rest unchanged
}
```

---

### [MED-05] No Rate Limiting on Login Endpoint Creates Email Enumeration Oracle
**File:** `app/api/auth/register/route.ts:51-56`
**Vulnerability:** The registration endpoint returns `409 { error: "An account with that email already exists" }` when an email is taken. This is a deliberate, explicit email enumeration oracle. There is no protection against automated enumeration.
**Attack Scenario:** An attacker with a list of email addresses can call `POST /api/auth/register` for each one. A `409` response confirms the email is registered; a `201` confirms it is not. Given no rate limiting on registration (see HIGH-02), this enumeration is trivially automated.
**Fix:**
Always return a 201/200 success response even when the email already exists, and rely on an email-based confirmation flow. If confirmation is not desired, at minimum apply IP rate limiting (HIGH-02 fix) to slow enumeration. As a secondary fix, return a vague `202 Accepted` for already-registered emails while sending a "you already have an account" email to the registered address.

---

### [MED-06] Docker Compose Uses Default Weak Database Credentials
**File:** `docker-compose.yml:6-8`
**Vulnerability:** `POSTGRES_USER: roadpulse`, `POSTGRES_PASSWORD: roadpulse`. These default credentials are checked into version control and are identical to `DATABASE_URL` in `.env.example`. In any environment where the `.env` file is not overridden, the database uses these trivially guessable credentials.
**Attack Scenario:** If port 5432 is exposed (it is: `ports: - "5432:5432"`), any attacker with network access can connect to the database using credentials `roadpulse/roadpulse`.
**Fix:**
```yaml
# docker-compose.yml — use environment variables, never hardcoded passwords:
environment:
  POSTGRES_USER: ${DB_USER}
  POSTGRES_PASSWORD: ${DB_PASSWORD}  # Set from .env, generate with openssl rand -hex 32
  POSTGRES_DB: ${DB_NAME:-roadpulse}
ports:
  # In production: remove this block entirely. Bind only to localhost in dev:
  - "127.0.0.1:5432:5432"
```
Add a `DB_PASSWORD` with a generated value to `.env.example` documentation.

---

### [MED-07] Redis Has No Authentication Configured
**File:** `docker-compose.yml:21-33` and `lib/cache/redis.ts:14-18`
**Vulnerability:** The Redis container runs with no password (`command: redis-server --save 60 1 --loglevel warning` — no `--requirepass`). Port 6379 is exposed externally (`ports: - "6379:6379"`). The `REDIS_URL` in `.env.example` is `redis://localhost:6379` (no auth). Any process on the host or network can connect and read/write the Redis cache.
**Attack Scenario:** An attacker with network access can: read cached route check results (containing origin/destination addresses of all users), read cached NWS raw alerts, write arbitrary values to cache keys (cache poisoning), or delete all cached data to cause a cache stampede against the database.
**Fix:**
```yaml
# docker-compose.yml — add password protection:
redis:
  command: redis-server --save 60 1 --loglevel warning --requirepass ${REDIS_PASSWORD}
ports:
  - "127.0.0.1:6379:6379"  # Never expose to external network
```
Update `REDIS_URL` to `redis://:${REDIS_PASSWORD}@localhost:6379`.

---

### [MED-08] Middleware Does Not Cover `/api/admin/*` Routes
**File:** `middleware.ts:31-33`
**Vulnerability:** The middleware `matcher` is `["/account/:path*", "/admin/:path*"]`. It does not include `/api/admin/:path*`. Admin API routes are protected only by the `requireAdmin()` call inside each handler. If any admin API handler omits this call, there is no defense-in-depth.
**Attack Scenario:** If a developer adds a new admin API endpoint under `/api/admin/` and forgets the `requireAdmin()` call, that endpoint will be publicly accessible. The current `/api/admin/ingest` (CRIT-02) is exactly this scenario.
**Fix:**
```typescript
// In middleware.ts — expand the matcher:
export const config = {
  matcher: ["/account/:path*", "/admin/:path*", "/api/admin/:path*"],
};

// And add role check in the middleware itself for /api/admin routes:
if (pathname.startsWith("/api/admin")) {
  if (!session?.user) {
    return NextResponse.json({ error: "Authentication required", code: "UNAUTHORIZED" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required", code: "FORBIDDEN" }, { status: 403 });
  }
}
```

---

### [MED-09] No Body Size Limit on POST Endpoints
**File:** All POST API routes (no global body parser limit configured)
**Vulnerability:** Next.js App Router has a default body size limit of 4MB. However, no custom limit is configured for specific endpoints. The `POST /api/reports` and `POST /api/route/check` endpoints accept arbitrary JSON bodies. The route check endpoint passes user-supplied address strings to external geocoding APIs.
**Attack Scenario:** A client can send a 4MB JSON body with a 4MB address string to the geocode or route check endpoint, causing the geocoding API to receive an enormous string. The more immediate concern is that large request bodies tie up server threads while being parsed.
**Fix:**
```typescript
// Add a body size check in critical POST handlers, e.g. in app/api/reports/route.ts:
const contentLength = parseInt(req.headers.get("content-length") ?? "0", 10);
if (contentLength > 10_000) { // 10KB limit for report submissions
  return NextResponse.json({ error: "Request body too large", code: "PAYLOAD_TOO_LARGE" }, { status: 413 });
}
```
Alternatively, configure `export const config = { api: { bodyParser: { sizeLimit: "10kb" } } }` per route.

---

## Low Findings

### [LOW-01] Database SSL Not Enforced in Connection String
**File:** `lib/db/index.ts:12-17` and `.env.example:1`
**Vulnerability:** The `DATABASE_URL` in `.env.example` (`postgresql://roadpulse:roadpulse@localhost:5432/roadpulse`) does not include `?sslmode=require`. The `pg.Pool` constructor does not force SSL. In production, if the database is not on localhost, credentials and data traverse the network unencrypted.
**Fix:**
```typescript
const pool = new Pool({
  connectionString: databaseUrl,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
  idleTimeoutMillis: 30_000,
  max: 10,
});
```
And add `?sslmode=require` to the production `DATABASE_URL`.

---

### [LOW-02] Email Addresses Logged to Usage Events (PII in Audit Log)
**File:** `app/api/auth/register/route.ts:64`
**Vulnerability:** `logUsageEvent("USER_REGISTER", { email: email.toLowerCase() })` stores the user's email in the `usage_events.metadata` JSONB column. The `getRecentActivity()` function in `lib/admin/usage-repository.ts:158-160` then displays this email in the admin Activity Feed: `"New user registered: user@example.com"`. This means PII (email addresses) is stored in an append-only audit log table that is retained for 90 days by the purge policy.
**Fix:**
Replace the email with a non-PII identifier in the usage event metadata:
```typescript
// Replace:
await logUsageEvent("USER_REGISTER", { email: email.toLowerCase() }).catch(() => undefined);
// With:
await logUsageEvent("USER_REGISTER", { userId: newUser.id }).catch(() => undefined);
```
Update `buildActivityDescription` to display `User registered (ID: ...)` instead.

---

### [LOW-03] `defaultRegion` Preference Has No Input Validation
**File:** `app/api/user/preferences/route.ts:48-50`
**Vulnerability:** The `PATCH /api/user/preferences` endpoint validates the `theme` field but applies no validation to `defaultRegion`. Any authenticated user can set `defaultRegion` to an arbitrarily long string (up to PostgreSQL's JSONB limits, ~1GB). This string is later stored in the `users.preferences` JSONB column and returned to clients.
**Fix:**
```typescript
if (defaultRegion !== undefined) {
  if (typeof defaultRegion !== "string" || defaultRegion.length > 100) {
    return NextResponse.json(
      { error: "defaultRegion must be a string of at most 100 characters", code: "INVALID_REGION" },
      { status: 400 }
    );
  }
  updates.defaultRegion = defaultRegion;
}
```

---

### [LOW-04] No CSRF Protection Analysis / Missing SameSite Cookie Configuration
**File:** `lib/auth/auth.config.ts:6-40`
**Vulnerability:** The NextAuth configuration does not explicitly set `cookies` options including `sameSite`. NextAuth v5 defaults to `sameSite: "lax"` for the session cookie. This is adequate for most CSRF scenarios but does not prevent CSRF on cross-origin simple requests in older browsers. More importantly, the configuration does not explicitly set `httpOnly: true` and `secure: true` — these are NextAuth defaults but are not verified to be enforced.
**Fix:**
```typescript
export const authConfig = {
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" as const, maxAge: 86400 },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "strict" as const,  // Upgrade from "lax" to "strict" for admin-only flows
        secure: process.env.NODE_ENV === "production",
        path: "/",
      },
    },
  },
  // ...
};
```

---

### [LOW-05] Ingestion/Usage Log Tables Have No Archival Strategy
**File:** `lib/db/schema.ts:234-270` and `app/api/admin/settings/actions/route.ts:40-50`
**Vulnerability:** The `usage_events` table is purged every 90 days and `ingestion_logs` every 30 days via admin-triggered actions. However, these purges are not automatic — they require a human to trigger them from the admin settings panel. If forgotten, these tables grow unboundedly. The `usage_events` table also contains user email addresses (see LOW-02) and full origin/destination addresses from route checks.
**Fix:**
Add automated scheduled cleanup to the ingestion scheduler (`lib/ingestion/scheduler.ts`) alongside the `expireOldReports()` call, or configure a PostgreSQL pg_cron job to handle retention automatically.

---

### [LOW-06] No Validation of bbox Coordinate Bounds (Potential PostGIS Abuse)
**File:** `app/api/events/route.ts:113-133`, `app/api/weather/alerts/route.ts:124-143`, `lib/community/report-repository.ts:92-98`
**Vulnerability:** The `bbox` parameter is validated to have 4 numbers and none are `NaN`, but there is no validation that the coordinates are within valid WGS 84 bounds (`west`/`east` between -180..180, `south`/`north` between -90..90) or that `south < north` and `west < east`. PostGIS will handle degenerate envelopes without crashing, but accepting `bbox=-180,-90,180,90` (entire world) combined with a low zoom level triggers maximum-result queries.
**Fix:**
```typescript
function validateBbox(parts: number[]): string | null {
  const [west, south, east, north] = parts;
  if (west < -180 || east > 180 || south < -90 || north > 90) return "Coordinates out of WGS 84 bounds";
  if (south >= north) return "south must be less than north";
  if (Math.abs(east - west) > 30 || Math.abs(north - south) > 30) return "bbox area too large (max 30 degrees per axis)";
  return null;
}
```

---

## Dependency Audit

Run `npm audit` output (2026-02-25):

| Package | Severity | CVE/Advisory | Affected Via | Fix Available |
|---------|----------|--------------|--------------|---------------|
| `minimatch` | **HIGH** | GHSA-3ppc-4f35-3m26 — ReDoS via repeated wildcards | `@typescript-eslint/typescript-estree` | Yes |
| `minimatch` | **HIGH** | GHSA-3ppc-4f35-3m26 | direct (transitive) | Yes |
| `esbuild` | **Moderate** | GHSA-67mh-4wv8-2f99 — Dev server allows cross-origin requests | `drizzle-kit` → `@esbuild-kit/core-utils` | `drizzle-kit@0.18.1` (semver major) |
| `@esbuild-kit/core-utils` | **Moderate** | Inherits esbuild issue | `drizzle-kit` | `drizzle-kit@0.18.1` |
| `@esbuild-kit/esm-loader` | **Moderate** | Inherits esbuild issue | `drizzle-kit` | `drizzle-kit@0.18.1` |
| `ajv` | **Moderate** | GHSA-2g4f-4pwh-qvx6 — ReDoS with `$data` option | transitive | Yes (`npm audit fix`) |

**Total: 6 vulnerabilities (1 high, 5 moderate)**

The `minimatch` ReDoS is the most significant. It affects both direct and transitive dependencies via ESLint tooling. Since it's in dev dependencies, it only affects the build machine, not production runtime.

The `esbuild` vulnerability (cross-origin dev server requests) only affects `drizzle-kit` during development migrations. It does not affect the production Next.js server.

**Recommended actions:**
1. Run `npm audit fix` to resolve the `ajv` and `minimatch` issues.
2. Evaluate upgrading `drizzle-kit` to `0.18.1` (major version — review migration guide first).

---

## Security Headers Check

| Header | Current Status | Recommendation |
|--------|---------------|----------------|
| `Strict-Transport-Security` | Missing | Add `max-age=63072000; includeSubDomains; preload` |
| `X-Content-Type-Options` | Missing | Add `nosniff` |
| `X-Frame-Options` | Missing | Add `DENY` (or use CSP `frame-ancestors`) |
| `Content-Security-Policy` | Missing | Add restrictive CSP (see HIGH-04 fix) |
| `Referrer-Policy` | Missing | Add `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Missing | Add restrictive policy |
| `X-XSS-Protection` | Missing | Add `1; mode=block` (legacy browsers) |
| CORS | Not configured | Next.js default: same-origin. No wildcard `*`. OK. |
| NextAuth session cookie `httpOnly` | Default: `true` | Explicitly confirm via `cookies` config |
| NextAuth session cookie `secure` | Default: `true` in prod | Explicitly set via `cookies` config |
| NextAuth session cookie `sameSite` | Default: `lax` | Upgrade to `strict` for admin flows |

---

## Recommendations

### Priority 1 — Fix Immediately (Critical)
1. **Add `CRON_SECRET` authentication to `/api/cron/ingest`** (CRIT-01). One-line check at the top of both handlers.
2. **Add `requireAdmin()` to `/api/admin/ingest`** (CRIT-02). Copy-paste from any other admin route.
3. **Add IP rate limiting to `/api/auth/callback/credentials` (login)** via a NextAuth `signIn` callback hook or middleware (HIGH-01).
4. **Add IP rate limiting to `/api/auth/register`** (HIGH-02).

### Priority 2 — Fix This Sprint (High/Medium)
5. **Add HTTP security headers** to `next.config.ts` (HIGH-04) — this is a one-time configuration change.
6. **Restrict Redis and PostgreSQL ports** in `docker-compose.yml` to `127.0.0.1` only (MED-06, MED-07).
7. **Add Redis password** to docker-compose and `REDIS_URL` (MED-07).
8. **Add `/api/admin/*` to middleware matcher** as defense-in-depth (MED-08).
9. **Fix `X-Forwarded-For` spoofing** in `getClientIp()` (MED-01).
10. **Replace `($1 || ' days')::INTERVAL`** pattern with `($1 * INTERVAL '1 day')` (HIGH-03).

### Priority 3 — Fix Next Sprint (Medium/Low)
11. **Add coordinate bounds validation** to route check endpoint (MED-03).
12. **Add rate limiting to geocode endpoint** (MED-04).
13. **Set explicit JWT `maxAge`** and consider re-fetching admin role on each JWT refresh (MED-02).
14. **Remove email from `USER_REGISTER` usage event** metadata (LOW-02).
15. **Add `defaultRegion` length validation** in preferences endpoint (LOW-03).
16. **Add bbox coordinate bounds validation** beyond NaN checking (LOW-06).
17. **Enforce SSL in PostgreSQL connection** for production (LOW-01).

### Systemic Improvements
- **Implement automated log table pruning** in the ingestion scheduler (LOW-05) instead of relying on manual admin action.
- **Add `NEXTAUTH_SECRET` validation on startup** — fail fast if `AUTH_SECRET` is not set in production.
- **Consider a WAF** in front of the application to handle malformed request filtering, rate limiting, and bot detection at the edge.
- **Add integration tests for auth flows** — the fact that CRIT-02 went undetected suggests no test coverage for the admin ingest endpoint.
- **Add a `SECURITY.md`** file with responsible disclosure instructions before going public.
- **Run `npm audit fix`** and add `npm audit --audit-level=high` to the CI pipeline to catch future regressions.
