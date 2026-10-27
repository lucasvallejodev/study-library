import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@study/core", "@study/ingest", "@study/anchoring"],
  // Node-only libraries used by ingestion; keep them out of the bundle.
  serverExternalPackages: ["jsdom", "defuddle", "postgres", "jszip", "fast-xml-parser"],
  turbopack: { root: path.resolve(import.meta.dirname, "../..") },
};

export default config;
