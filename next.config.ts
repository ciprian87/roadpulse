import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // Disable in dev to avoid service worker interfering with hot reload
  disable: process.env.NODE_ENV === "development",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  workboxOptions: {
    runtimeCaching: [
      {
        // CARTO map tiles — long-lived, cache-first
        urlPattern: /^https:\/\/.*\.basemaps\.cartocdn\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "map-tiles",
          expiration: {
            maxEntries: 1000,
            maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
          },
        },
      },
      {
        // Our own API routes — network-first with short cache fallback
        urlPattern: /^\/api\/(events|weather|parking)\/.*/i,
        handler: "NetworkFirst",
        options: {
          cacheName: "api-data",
          expiration: {
            maxEntries: 50,
            maxAgeSeconds: 300, // 5 minutes
          },
        },
      },
      {
        // Next.js static assets — cache-first
        urlPattern: /^\/_next\/static\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static",
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
          },
        },
      },
    ],
  },
});

const nextConfig: NextConfig = {
  // Empty turbopack config silences the "webpack config present but no turbopack config" warning.
  // next-pwa uses webpack internally; Turbopack is used for dev, webpack for prod builds.
  turbopack: {},
};

export default withPWA(nextConfig);
