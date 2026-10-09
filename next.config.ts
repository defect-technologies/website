import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its own WebAssembly and data files at runtime, so it stays out of the bundle.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
