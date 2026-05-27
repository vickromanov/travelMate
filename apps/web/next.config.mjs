/**
 * Next.js config. `transpilePackages` lets the app consume the workspace
 * packages as raw TS (the 2026 monorepo pattern — projectStructure.md §10).
 */
/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@travelmate/contracts",
    "@travelmate/database",
    "@travelmate/trip-mode",
    "@travelmate/ui",
  ],
};

export default nextConfig;
