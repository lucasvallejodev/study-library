import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { resolveInDocument } from "@study/core";
import { notFound, route } from "@/lib/http";

const TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
};

type Ctx = { params: Promise<{ doc: string; path: string[] }> };

/** Serves library/<doc>/assets/* (content-hashed names, so cache forever). */
export const GET = route(async (_req: Request, { params }: Ctx) => {
  const { doc, path: parts } = await params;
  if (parts[0] !== "assets") notFound("Asset");
  const file = resolveInDocument(doc, parts.join("/"));
  await stat(file);
  const ext = path.extname(file).toLowerCase();
  return new Response(new Uint8Array(await readFile(file)), {
    headers: {
      "content-type": TYPES[ext] ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
      // SVGs from imported books must never run scripts.
      ...(ext === ".svg" ? { "content-security-policy": "script-src 'none'" } : {}),
    },
  });
});
