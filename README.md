# RoadPulse

Real-time road closures, weather alerts, and hazards consolidated from all 50 US state 511 systems and the National Weather Service — designed for commercial truck drivers and dispatchers.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (for PostgreSQL/PostGIS + Redis)
- Node.js 20+
- npm 10+

## Setup

```bash
# 1. Start the database and Redis
docker-compose up -d

# 2. Copy environment variables
cp .env.example .env
# Edit .env and fill in any required API keys

# 3. Install dependencies
npm install

# 4. Run database migrations (creates tables + PostGIS extension)
npm run db:migrate

# 5. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you should see a health check page with green status indicators for PostgreSQL and Redis.

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on port 3000 |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Run TypeScript type checker |
| `npm run db:migrate` | Run SQL migrations against DATABASE_URL |
| `npm run db:generate` | Generate Drizzle migration files from schema changes |

## Architecture

```
app/              → Next.js App Router pages and API handlers (thin layer)
components/       → React UI components
lib/              → Core business logic
  db/             → Drizzle schema, migrations, and database client
  feeds/          → 511 feed adapters (one file per state)
  ingestion/      → Feed ingestion worker
  geo/            → Route and geometry utilities
  weather/        → NWS alert client
  cache/          → Redis cache helpers
stores/           → Zustand state stores
public/           → PWA manifest, icons
```

## API Endpoints

- `GET /api/health` — Database and Redis connection status, table row counts

## Stack

- **Framework**: Next.js 14+ (App Router), TypeScript strict mode
- **Styling**: Tailwind CSS (dark-first design)
- **Database**: PostgreSQL 16 + PostGIS 3.4 via Drizzle ORM
- **Cache**: Redis 7 via ioredis
- **Map**: Leaflet + react-leaflet (added in later phases)
- **Routing**: OpenRouteService API (`driving-hgv` profile)
