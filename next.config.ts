import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  // worker/index.ts holds the push + notificationclick handlers; next-pwa
  // compiles it and importScripts it into the generated sw.js.
  customWorkerSrc: "worker",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  logging: {
    // Browser console warnings and errors land in the dev server's terminal
    // (and its log file), so an agent working without a browser still sees
    // hydration mismatches and client exceptions.
    browserToTerminal: "warn",
  },
};

// next-pwa is a webpack plugin and has no Turbopack equivalent. It is off in
// development anyway, so only wrap the production build with it — that build
// runs `next build --webpack`; `next dev` stays on Turbopack, webpack-free.
export default process.env.NODE_ENV === "development" ? nextConfig : withPWA(nextConfig);
