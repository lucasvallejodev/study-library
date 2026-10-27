import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  // Node-only libraries used by ingestion; keep them out of the bundle.
  serverExternalPackages: ['jsdom', 'defuddle', 'postgres', 'jszip', 'fast-xml-parser'],
  transpilePackages: ['@study/core', '@study/ingest', '@study/anchoring'],
  turbopack: { root: path.resolve(import.meta.dirname, '../..') },
};

export default config;
