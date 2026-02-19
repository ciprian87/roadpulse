import {
  pgTable,
  uuid,
  varchar,
  char,
  text,
  boolean,
  integer,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// PostGIS geometry columns are not natively supported by Drizzle.
// They are defined as raw SQL in the migration file and typed as `unknown` here
// so Drizzle generates the correct table structure while PostGIS handles spatial ops.

export const roadEvents = pgTable(
  "road_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    source_event_id: varchar("source_event_id", { length: 255 }).notNull(),
    state: char("state", { length: 2 }).notNull(),
    // Enum-like: CLOSURE | RESTRICTION | CONSTRUCTION | INCIDENT | WEATHER_CLOSURE | CHAIN_LAW | SPECIAL_EVENT
    type: varchar("type", { length: 50 }).notNull(),
    // Enum-like: CRITICAL | WARNING | ADVISORY | INFO
    severity: varchar("severity", { length: 20 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    direction: varchar("direction", { length: 20 }),
    route_name: varchar("route_name", { length: 100 }),
    // geometry column is defined via raw SQL in migration (PostGIS Geometry, SRID 4326)
    location_description: text("location_description"),
    started_at: timestamp("started_at", { withTimezone: true }),
    expected_end_at: timestamp("expected_end_at", { withTimezone: true }),
    last_updated_at: timestamp("last_updated_at", { withTimezone: true }),
    lane_impact: jsonb("lane_impact"),
    vehicle_restrictions: jsonb("vehicle_restrictions").default(sql`'[]'::jsonb`),
    detour_description: text("detour_description"),
    source_feed_url: text("source_feed_url"),
    is_active: boolean("is_active").default(true).notNull(),
    raw: jsonb("raw"),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("road_events_source_source_event_id_idx").on(
      table.source,
      table.source_event_id
    ),
    index("road_events_state_idx").on(table.state),
    index("road_events_is_active_idx").on(table.is_active),
    index("road_events_type_idx").on(table.type),
    index("road_events_severity_idx").on(table.severity),
    // GIST index on geometry is defined in the manual migration SQL
  ]
);

export const weatherAlerts = pgTable(
  "weather_alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nws_id: varchar("nws_id", { length: 255 }).notNull().unique(),
    event: varchar("event", { length: 100 }).notNull(),
    severity: varchar("severity", { length: 20 }).notNull(),
    urgency: varchar("urgency", { length: 20 }),
    certainty: varchar("certainty", { length: 20 }),
    headline: text("headline"),
    description: text("description"),
    instruction: text("instruction"),
    area_description: text("area_description"),
    affected_zones: text("affected_zones").array(),
    // geometry column is defined via raw SQL in migration (PostGIS Geometry, SRID 4326)
    onset: timestamp("onset", { withTimezone: true }),
    expires: timestamp("expires", { withTimezone: true }),
    last_updated_at: timestamp("last_updated_at", { withTimezone: true }),
    sender_name: varchar("sender_name", { length: 255 }),
    wind_speed: varchar("wind_speed", { length: 50 }),
    snow_amount: varchar("snow_amount", { length: 50 }),
    is_active: boolean("is_active").default(true).notNull(),
    raw: jsonb("raw"),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("weather_alerts_is_active_idx").on(table.is_active),
    index("weather_alerts_event_idx").on(table.event),
    // GIST index on geometry is defined in the manual migration SQL
  ]
);

export const parkingFacilities = pgTable(
  "parking_facilities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: varchar("source", { length: 50 }).notNull(),
    source_facility_id: varchar("source_facility_id", {
      length: 255,
    }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    state: char("state", { length: 2 }).notNull(),
    highway: varchar("highway", { length: 100 }),
    direction: varchar("direction", { length: 20 }),
    // location column (PostGIS Point, SRID 4326) is defined via raw SQL in migration
    total_spaces: integer("total_spaces"),
    available_spaces: integer("available_spaces"),
    // Enum-like: FILLING | CLEARING | STABLE
    trend: varchar("trend", { length: 20 }),
    amenities: jsonb("amenities").default(sql`'[]'::jsonb`),
    last_updated_at: timestamp("last_updated_at", { withTimezone: true }),
    is_active: boolean("is_active").default(true).notNull(),
  },
  (table) => [
    uniqueIndex("parking_facilities_source_facility_idx").on(
      table.source,
      table.source_facility_id
    ),
    // GIST index on location is defined in the manual migration SQL
  ]
);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  password_hash: varchar("password_hash", { length: 255 }),
  name: varchar("name", { length: 255 }),
  // Enum-like: driver | dispatcher | admin
  role: varchar("role", { length: 20 }).default("driver").notNull(),
  preferences: jsonb("preferences").default(sql`'{}'::jsonb`),
  created_at: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const savedRoutes = pgTable(
  "saved_routes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    origin_address: text("origin_address").notNull(),
    origin_lat: text("origin_lat").notNull(), // stored as text to avoid float precision issues
    origin_lng: text("origin_lng").notNull(),
    destination_address: text("destination_address").notNull(),
    destination_lat: text("destination_lat").notNull(),
    destination_lng: text("destination_lng").notNull(),
    // route_geometry (PostGIS LineString) and corridor_buffer (PostGIS Polygon) via raw SQL
    is_favorite: boolean("is_favorite").default(false).notNull(),
    last_checked_at: timestamp("last_checked_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("saved_routes_user_id_idx").on(table.user_id),
    // Spatial index on corridor_buffer is in manual migration SQL
  ]
);

export const communityReports = pgTable(
  "community_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    // Enum-like: ROAD_HAZARD | CLOSURE_UPDATE | WEATHER_CONDITION | WAIT_TIME | PARKING_FULL | OTHER
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    // location (PostGIS Point, SRID 4326) via raw SQL in migration
    location_description: varchar("location_description", { length: 255 }),
    route_name: varchar("route_name", { length: 100 }),
    state: char("state", { length: 2 }),
    severity: varchar("severity", { length: 20 }).default("INFO").notNull(),
    photo_url: text("photo_url"),
    upvotes: integer("upvotes").default(0).notNull(),
    downvotes: integer("downvotes").default(0).notNull(),
    is_active: boolean("is_active").default(true).notNull(),
    expires_at: timestamp("expires_at", { withTimezone: true }),
    created_at: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("community_reports_is_active_idx").on(table.is_active),
    // Spatial index on location is in manual migration SQL
  ]
);

export const feedStatus = pgTable("feed_status", {
  id: uuid("id").primaryKey().defaultRandom(),
  feed_name: varchar("feed_name", { length: 100 }).notNull().unique(),
  state: char("state", { length: 2 }),
  feed_url: text("feed_url"),
  last_success_at: timestamp("last_success_at", { withTimezone: true }),
  last_error_at: timestamp("last_error_at", { withTimezone: true }),
  last_error_message: text("last_error_message"),
  record_count: integer("record_count").default(0),
  avg_fetch_ms: integer("avg_fetch_ms"),
  // Enum-like: healthy | degraded | down | unknown
  status: varchar("status", { length: 20 }).default("unknown").notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Re-export table types for use in service/repository layers
export type RoadEvent = typeof roadEvents.$inferSelect;
export type NewRoadEvent = typeof roadEvents.$inferInsert;
export type WeatherAlert = typeof weatherAlerts.$inferSelect;
export type NewWeatherAlert = typeof weatherAlerts.$inferInsert;
export type ParkingFacility = typeof parkingFacilities.$inferSelect;
export type NewParkingFacility = typeof parkingFacilities.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type SavedRoute = typeof savedRoutes.$inferSelect;
export type NewSavedRoute = typeof savedRoutes.$inferInsert;
export type CommunityReport = typeof communityReports.$inferSelect;
export type NewCommunityReport = typeof communityReports.$inferInsert;
export type FeedStatus = typeof feedStatus.$inferSelect;
export type NewFeedStatus = typeof feedStatus.$inferInsert;
