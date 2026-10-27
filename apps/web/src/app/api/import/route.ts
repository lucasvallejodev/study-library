import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { slugify, tempDir } from "@study/core";
import { isUrl } from "@study/ingest";
import { HttpError, route } from "@/lib/http";
import { enqueueJob } from "@/lib/jobs";

const ALLOWED = /\.(epub|mobi|azw|azw3|prc|html?|md|markdown)$/i;

/** POST /api/import — multipart `file` upload, or JSON/form `url`. Optional `id`, `tocDepth`. */
export const POST = route(async (req: Request) => {
  const type = req.headers.get("content-type") ?? "";
  let options: Record<string, unknown> = {};
  if (type.includes("multipart/form-data")) {
    const form = await req.formData();
    const id = form.get("id");
    const tocDepth = form.get("tocDepth");
    options = { ...(id ? { id: String(id) } : {}), ...(tocDepth ? { tocDepth: Number(tocDepth) } : {}) };
    const file = form.get("file");
    const url = form.get("url");
    if (file instanceof File && file.size > 0) {
      if (!ALLOWED.test(file.name)) throw new HttpError(400, "Upload an .epub, .mobi, .azw, .azw3, .html or .md file");
      const dir = path.join(tempDir(), "uploads");
      await mkdir(dir, { recursive: true });
      const ext = path.extname(file.name).toLowerCase();
      const target = path.join(dir, `${Date.now()}-${slugify(path.basename(file.name, ext))}${ext}`);
      await writeFile(target, Buffer.from(await file.arrayBuffer()));
      const job = await enqueueJob({ inputType: "file", input: target, originalName: file.name, options });
      return NextResponse.json(job, { status: 202 });
    }
    if (typeof url === "string" && url) return queueUrl(url, options);
    throw new HttpError(400, "Provide a file or a url");
  }
  const body = (await req.json()) as { url?: string; id?: string; tocDepth?: number };
  if (!body.url) throw new HttpError(400, "Provide a url");
  return queueUrl(body.url, { ...(body.id ? { id: body.id } : {}), ...(body.tocDepth ? { tocDepth: body.tocDepth } : {}) });
});

async function queueUrl(url: string, options: Record<string, unknown>) {
  if (!isUrl(url)) throw new HttpError(400, "URL must start with http:// or https://");
  const job = await enqueueJob({ inputType: "url", input: url, options });
  return NextResponse.json(job, { status: 202 });
}
