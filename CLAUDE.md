# CLAUDE.md

## Project Context

RoadPulse is a mobile-first PWA that consolidates real-time road closures, weather alerts, and hazards from all 50 US state 511 systems and the National Weather Service into one interface for commercial truck drivers. Dispatchers use the desktop layout. The core flow: driver enters origin + destination → sees every hazard along that route, ordered by driving distance.

---

## C — Clear and Concise Instructions

### Design Principles

Follow **SOLID** principles in all object-oriented code. Specifically:

- **Single Responsibility**: Files, classes, and functions do one thing. API route handlers validate and delegate — business logic lives in `/lib/`.
- **Open/Closed**: New functionality is added by creating new files, not modifying existing abstractions. The feed adapter system is the canonical example — new states get new adapter files, never changes to the base class or ingestion worker.
- **Liskov Substitution**: All feed adapters are interchangeable. The ingestion worker calls `adapter.ingest()` without knowing which state or format it handles.
- **Interface Segregation**: Separate read types from write types. API response shapes ≠ database insert shapes. Components receive only the data they render.
- **Dependency Inversion**: High-level modules depend on abstractions. External APIs (NWS, OpenRouteService, 511 feeds) are wrapped in client modules with typed interfaces.

### Code Style

- TypeScript strict mode, always. No `any` — use `unknown` and validate.
- Named exports only (except Next.js pages which require default exports).
- Explicit types on all function parameters and return values.
- `async/await` only — no `.then()` chains.
- No `console.log` in committed code.
- Comments explain **why**, not what. Especially: PostGIS query patterns, feed-specific quirks, and business logic decisions.

---

## O — Operational Processes

### Development Workflow

```bash
docker-compose up -d          # Start Postgres/PostGIS + Redis
npm run dev                   # Next.js dev server (port 3000)
npm run db:migrate            # Run database migrations
npm run db:generate           # Generate Drizzle migration files
```

### Git Conventions

- Branch per feature: `feature/phase-N-description` or `fix/description`
- Commit messages: imperative mood, concise (`Add NWS weather alert ingestion pipeline`)
- NEVER commit `.env`, `node_modules`, or Docker volumes

### Adding a New State Feed

1. Create `/lib/feeds/adapters/{state}-adapter.ts` extending `BaseFeedAdapter`
2. Implement `fetch()` (HTTP + auth) and `normalize()` (raw → `RoadEvent[]`)
3. Register in `/lib/feeds/feed-registry.ts`
4. Done. The ingestion worker picks it up automatically.

If you find yourself modifying `base-adapter.ts` or `worker.ts`, stop and reconsider.

### Error Handling Process

- Every `catch` block must log, re-throw, or return a meaningful error. Never swallow silently.
- Feed ingestion failures update the `feed_status` table — silent feed death is the worst failure mode.
- API error responses use a consistent shape: `{ error: string, code: string, details?: unknown }`

---

## N — Naming and Standards

### File Naming

- Components: `PascalCase.tsx` (`HazardCard.tsx`)
- Utilities, services, stores: `kebab-case.ts` (`route-store.ts`, `nws.ts`)
- One component per file

### Severity System (sacred, consistent everywhere)

| Level | Color | Hex | Use |
|-------|-------|-----|-----|
| CRITICAL | Red | `#ff4d4f` | Full closures, blizzard warnings, no-travel advisories |
| WARNING | Orange | `#ff8c00` | Partial closures, winter storm warnings, chain laws |
| ADVISORY | Yellow | `#ffd000` | Lane restrictions, fog advisories, speed reductions |
| INFO | Blue | `#4096ff` | Construction, planned events, informational |
| CLEAR | Green | `#36cfc9` | No issues on a route segment |

### Database Conventions

- All timestamps: `TIMESTAMPTZ`, stored in UTC, displayed in user's local timezone
- All geometry: SRID 4326 (WGS 84)
- Deduplication key: `(source, source_event_id)` — upsert with `ON CONFLICT DO UPDATE`, never delete and re-insert
- Always parameterized queries. No string interpolation in SQL.

### API Shape

- List endpoints: `limit` (default 100, max 500), `offset`, relevant filters
- Geospatial filter: `bbox=west,south,east,north`
- Geometry in responses: always GeoJSON via `ST_AsGeoJSON`
- Auth failures: `401 { error: "Authentication required" }`
- Rate limit: `429 { error: "Rate limit exceeded", retryAfter: N }`

---

## T — Testing and Quality Gates

### Before Committing

1. `npm run typecheck` passes with zero errors
2. `npm run lint` passes
3. Manual smoke test: the app loads, map renders, data displays
4. New feed adapters: verify ingestion produces correct `road_events` rows with valid geometry

### Quality Standards

- Mobile-first: design for 375px width, then scale up
- All touch targets: minimum 44px × 44px
- Dark theme is default; light theme must also function correctly
- Leaflet map must be usable with one thumb on mobile
- API responses under 500ms for cached data, under 3s for uncached route checks

---

## E — Examples and References

### PostGIS Patterns

```sql
-- Route corridor buffer (10 miles = 16093 meters, cast to geography for accuracy)
ST_Buffer(route_geometry::geography, 16093)::geometry

-- Find hazards intersecting a corridor
SELECT * FROM road_events
WHERE is_active = true AND ST_Intersects(geometry, corridor_polygon);

-- Order hazards by position along route (0.0 = origin, 1.0 = destination)
ST_LineLocatePoint(route_geometry, ST_Centroid(hazard.geometry))

-- Simplify large polygons for API responses
ST_SimplifyPreserveTopology(geometry, 0.001)
```

### Discriminated Union Pattern for Hazards

```typescript
interface BaseHazard {
  id: string;
  title: string;
  severity: Severity;
  geometry: GeoJSON.Geometry;
  positionAlongRoute?: number;  // 0-1 fraction
}

interface RoadEventHazard extends BaseHazard {
  kind: 'road_event';
  type: RoadEventType;
  routeName: string;
  source: string;
}

interface WeatherAlertHazard extends BaseHazard {
  kind: 'weather_alert';
  event: string;
  instruction: string | null;
}

interface CommunityReportHazard extends BaseHazard {
  kind: 'community_report';
  reportType: ReportType;
  votes: number;
}

type Hazard = RoadEventHazard | WeatherAlertHazard | CommunityReportHazard;
```

---

## X — Xpectations and Boundaries

### Do

- Prefer boring, proven patterns over clever abstractions. Reliability beats elegance.
- Cache aggressively: NWS responses (2 min), route check results (5 min), map tiles (7 days).
- Wrap all external API calls in try/catch with typed errors.
- Use `next/dynamic` with `{ ssr: false }` for all Leaflet components.

### Do NOT

- Do not use Google Maps or Mapbox. The map is Leaflet + OpenStreetMap only.
- Do not store local times in the database. UTC only.
- Do not mix up coordinate order: GeoJSON = `[longitude, latitude]`, Leaflet = `[latitude, longitude]`.
- Do not call the database directly from API route handlers. Go through service/repository functions in `/lib/`.
- Do not modify `base-adapter.ts` to accommodate a single state's quirks. Override in the child adapter.

### Rate Limit Awareness

- NWS API: max ~1 request/second, cache in Redis
- OpenRouteService: 2000 requests/day on free tier, cache route results aggressively
- State 511 APIs: varies, respect `Retry-After` headers, 10-60 second polling floors

---

## T — Tools and Dependencies

### Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | Next.js 14+ (App Router) | TypeScript strict mode |
| Styling | Tailwind CSS | Custom dark theme, design tokens in `tailwind.config.ts` |
| Map | Leaflet + react-leaflet | CartoDB Dark Matter (dark) / Voyager (light) tiles |
| State | Zustand | One store per domain (map, route, filters) |
| Database | PostgreSQL 16 + PostGIS 3.4 | Drizzle ORM; raw SQL for PostGIS columns |
| Cache | Redis 7 via ioredis | Feed caching, route result caching, rate limiting |
| Jobs | BullMQ | Feed ingestion scheduling |
| Auth | NextAuth.js v5 | Credentials provider, JWT strategy |
| Routing | OpenRouteService API | `driving-hgv` profile for trucks |
| PWA | next-pwa | Offline map tile caching, network-first API caching |
| Fonts | JetBrains Mono (data), DM Sans (body) | |

### Project Structure

```
app/              → Pages and API route handlers (thin — delegates to /lib/)
components/       → React UI components (map/, route/, alerts/, community/, shared/)
lib/              → Core business logic (feeds/, ingestion/, geo/, weather/, db/, cache/)
stores/           → Zustand stores (map, route, filters)
public/           → PWA manifest, icons, service worker
```

### Key Environment Variables

```
DATABASE_URL, REDIS_URL, NEXTAUTH_SECRET, NEXTAUTH_URL,
OPENROUTESERVICE_API_KEY, NWS_USER_AGENT
```

See `.env.example` for full list. State-specific API keys are prefixed with the state abbreviation (e.g., `CALTRANS_511_API_KEY`).

---

## Reference

Full implementation plan: `/docs/roadpulse-phased-build-guide.md`

When a decision isn't covered here, choose the option that is simplest, most testable, and most consistent with SOLID principles.
