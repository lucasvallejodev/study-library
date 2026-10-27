#!/usr/bin/env -S npx tsx
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Command } from "commander";
import { API_URL, ApiError, request } from "./client";

type Job = { id: number; status: string; log: string; error: string | null; documentId: string | null; report?: Report | null };
type Report = { chapterCount: number; totalWords: number; warnings: { code: string; message: string; chapterId?: string }[] };
type Annotation = {
  id: string;
  documentId: string | null;
  chapterId: string | null;
  type: string;
  color: string | null;
  selectors: { type: string; exact?: string }[];
  body: string | null;
  tags: string[];
  orphaned: boolean;
  createdAt: string;
};

const program = new Command("lib").description(`Study Library CLI (server: ${API_URL})`).showHelpAfterError();

const print = (value: unknown) => console.log(typeof value === "string" ? value : JSON.stringify(value, null, 2));

/** Repo root, so default folders land in <repo>/_temp regardless of cwd. */
function repoRoot(): string {
  let dir = process.cwd();
  while (!existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
  return dir;
}

async function waitForJob(id: number, quiet = false): Promise<Job> {
  let printed = 0;
  while (true) {
    const job = await request<Job>(`/api/import/jobs/${id}`);
    if (!quiet && job.log.length > printed) {
      process.stderr.write(job.log.slice(printed));
      printed = job.log.length;
    }
    if (job.status === "done" || job.status === "failed") return job;
    await new Promise((r) => setTimeout(r, 700));
  }
}

function summariseJob(job: Job) {
  if (job.status === "failed") throw new Error(job.error ?? "Import failed");
  const r = job.report;
  return {
    documentId: job.documentId,
    url: `${API_URL}/read/${job.documentId}`,
    chapters: r?.chapterCount,
    words: r?.totalWords,
    warnings: r?.warnings ?? [],
  };
}

program
  .command("list")
  .description("List documents as JSON")
  .option("--chapters", "include each document's chapters")
  .action(async (o) => print(await request(`/api/documents${o.chapters ? "?chapters=1" : ""}`)));

program
  .command("show <doc>")
  .description("Document metadata and chapters with progress and annotation counts")
  .action(async (doc) => print(await request(`/api/documents/${doc}`)));

program
  .command("chapter <doc> <chapter>")
  .description("Print a chapter as Markdown")
  .option("-a, --with-annotations", "inline your highlights as ==text== [^id] with notes and deep links")
  .action(async (doc, chapter, o) => {
    print(await request<string>(`/api/documents/${doc}/chapters/${chapter}?format=md${o.withAnnotations ? "&annotations=1" : ""}`));
  });

program
  .command("annotations [doc]")
  .description("List highlights and notes")
  .option("-c, --chapter <id>")
  .option("-s, --since <age>", "e.g. 7d, 12h, or an ISO date")
  .option("-t, --type <types>", "highlight,note,bookmark,ai_question")
  .option("--tag <tag>")
  .option("-q, --query <text>", "full-text search")
  .option("-f, --format <format>", "json or md", "json")
  .action(async (doc, o) => {
    const p = new URLSearchParams();
    if (doc) p.set("doc", doc);
    if (o.chapter) p.set("chapter", o.chapter);
    if (o.since) p.set("since", o.since);
    if (o.type) p.set("type", o.type);
    if (o.tag) p.set("tag", o.tag);
    if (o.query) p.set("q", o.query);
    const rows = await request<Annotation[]>(`/api/annotations?${p}`);
    if (o.format !== "md") return print(rows);
    const lines: string[] = [];
    let current = "";
    for (const a of [...rows].reverse()) {
      const key = `${a.documentId ?? "(free notes)"}${a.chapterId ? ` / ${a.chapterId}` : ""}`;
      if (key !== current) {
        lines.push("", `## ${key}`, "");
        current = key;
      }
      const quote = a.selectors.find((s) => s.type === "TextQuoteSelector")?.exact;
      const link = a.documentId && a.chapterId ? `${API_URL}/read/${a.documentId}/${a.chapterId}#${a.id}` : a.id;
      lines.push(`- **${a.type}**${a.color ? ` (${a.color})` : ""}${a.tags.length ? ` ${a.tags.map((t) => `#${t}`).join(" ")}` : ""} — ${link}${a.orphaned ? " — orphaned" : ""}`);
      if (quote) lines.push(`  > ${quote.replace(/\n+/g, " ")}`);
      if (a.body) lines.push(`  ${a.body.replace(/\n/g, "\n  ")}`);
    }
    print(lines.join("\n").trim() || "No annotations.");
  });

program
  .command("add-note <doc> [chapter]")
  .description("Add a note, highlight or AI question; --quote anchors it to a passage")
  .option("-q, --quote <text>", "exact passage from the chapter (small differences are tolerated)")
  .option("--on <annotation-id>", "attach to the same passage as an existing highlight (like a reply in the margin)")
  .option("-b, --body <markdown>", "note text")
  .option("-t, --type <type>", "highlight | note | ai_question | bookmark", "note")
  .option("--color <color>", "yellow | green | blue | pink")
  .option("--tags <tags>", "comma separated")
  .action(async (doc, chapter, o) => {
    const target = o.on ? await request<Annotation>(`/api/annotations/${o.on}`) : undefined;
    if (target) chapter = target.chapterId ?? chapter;
    const created = await request<Annotation>("/api/annotations", {
      method: "POST",
      json: {
        documentId: doc,
        chapterId: chapter ?? null,
        type: o.type,
        selectors: target?.selectors ?? [],
        quote: target ? undefined : o.quote,
        body: o.body ?? null,
        color: o.color ?? null,
        tags: o.tags ? String(o.tags).split(",").map((s: string) => s.trim()).filter(Boolean) : [],
      },
    });
    print({ ...created, link: chapter ? `${API_URL}/read/${doc}/${chapter}#${created.id}` : undefined });
  });

program
  .command("edit-note <id>")
  .description("Change an annotation's body, tags, color or type")
  .option("-b, --body <markdown>")
  .option("--tags <tags>")
  .option("--color <color>")
  .option("-t, --type <type>")
  .action(async (id, o) => {
    const patch: Record<string, unknown> = {};
    if (o.body !== undefined) patch.body = o.body;
    if (o.tags !== undefined) patch.tags = String(o.tags).split(",").map((s: string) => s.trim()).filter(Boolean);
    if (o.color !== undefined) patch.color = o.color;
    if (o.type !== undefined) patch.type = o.type;
    print(await request(`/api/annotations/${id}`, { method: "PATCH", json: patch }));
  });

program
  .command("delete-note <id>")
  .description("Delete an annotation")
  .action(async (id) => print(await request(`/api/annotations/${id}`, { method: "DELETE" })));

program
  .command("record-session <doc> [chapter]")
  .description("Save a study session (JSON: {questions:[{question,answer,feedback,correct,quote}], score, summary, followUps})")
  .requiredOption("-f, --file <path>", "session JSON file, or - for stdin")
  .option("-k, --kind <kind>", "study | review", "study")
  .action(async (doc, chapter, o) => {
    const raw = o.file === "-" ? await readStdin() : await readFile(o.file, "utf8");
    const data = JSON.parse(raw);
    print(await request("/api/sessions", { method: "POST", json: { kind: o.kind, ...data, documentId: doc, chapterId: chapter ?? data.chapterId ?? null } }));
  });

program
  .command("sessions [doc]")
  .description("List past study sessions")
  .option("-c, --chapter <id>")
  .option("-s, --since <age>")
  .action(async (doc, o) => {
    const p = new URLSearchParams();
    if (doc) p.set("doc", doc);
    if (o.chapter) p.set("chapter", o.chapter);
    if (o.since) p.set("since", o.since);
    print(await request(`/api/sessions?${p}`));
  });

program
  .command("import <source>")
  .description("Import an .epub/.mobi/.azw3/.html file or an http(s) URL")
  .option("--id <id>", "document id (default: slug of the title)")
  .option("--toc-depth <n>", "deepest TOC level used as chapter starts")
  .option("--crawl", "crawl a documentation site (planned for v0.2)")
  .option("--no-wait", "return the job instead of waiting")
  .action(async (source, o) => {
    if (o.crawl) throw new Error("Documentation-site crawling is planned for v0.2. Import pages one URL at a time for now.");
    let job: Job;
    if (/^https?:\/\//.test(source)) {
      job = await request<Job>("/api/import", { method: "POST", json: { url: source, id: o.id, tocDepth: o.tocDepth ? Number(o.tocDepth) : undefined } });
    } else {
      const data = await readFile(source);
      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(data)]), path.basename(source));
      if (o.id) form.append("id", o.id);
      if (o.tocDepth) form.append("tocDepth", String(o.tocDepth));
      job = await request<Job>("/api/import", { method: "POST", body: form });
    }
    if (!o.wait) return print(job);
    print(summariseJob(await waitForJob(job.id)));
  });

program
  .command("reimport <doc>")
  .description("Re-run the import from the saved source (keeps ids; annotations re-anchor)")
  .action(async (doc) => {
    const job = await request<Job>(`/api/documents/${doc}/reimport`, { method: "POST" });
    print(summariseJob(await waitForJob(job.id)));
  });

program
  .command("jobs")
  .description("Recent import jobs")
  .action(async () => print(await request("/api/import/jobs")));

program
  .command("report <doc>")
  .description("Print the document's import-report.json")
  .action(async (doc) => print((await request<{ report: unknown }>(`/api/documents/${doc}/bundle`)).report));

program
  .command("pull <doc> [dir]")
  .description("Download document.json + chapter files for editing (default: _temp/edit/<doc>)")
  .action(async (doc, dir) => {
    const target = path.resolve(dir ?? path.join(repoRoot(), "_temp/edit", doc));
    const bundle = await request<{ document: unknown; files: Record<string, string>; report: unknown; assets: string[] }>(`/api/documents/${doc}/bundle`);
    await mkdir(path.join(target, "chapters"), { recursive: true });
    for (const f of await readdir(path.join(target, "chapters"))) await import("node:fs/promises").then((fs) => fs.rm(path.join(target, "chapters", f)));
    await writeFile(path.join(target, "document.json"), JSON.stringify(bundle.document, null, 2) + "\n");
    await writeFile(path.join(target, "import-report.json"), JSON.stringify(bundle.report, null, 2) + "\n");
    await writeFile(path.join(target, "assets.txt"), bundle.assets.join("\n") + "\n");
    for (const [file, content] of Object.entries(bundle.files)) await writeFile(path.join(target, file), content);
    print({ dir: target, chapters: Object.keys(bundle.files).length });
  });

program
  .command("push <doc> [dir]")
  .description("Upload an edited document folder (from `lib pull`); validates, re-indexes")
  .action(async (doc, dir) => {
    const source = path.resolve(dir ?? path.join(repoRoot(), "_temp/edit", doc));
    const document = JSON.parse(await readFile(path.join(source, "document.json"), "utf8"));
    const files: Record<string, string> = {};
    for (const ch of document.chapters as { file: string }[]) files[ch.file] = await readFile(path.join(source, ch.file), "utf8");
    print(await request(`/api/documents/${doc}/bundle`, { method: "PUT", json: { document, files } }));
  });

program
  .command("search <query...>")
  .description("Full-text search over chapters and annotations")
  .action(async (query: string[]) => print(await request(`/api/search?q=${encodeURIComponent(query.join(" "))}`)));

program
  .command("export [doc]")
  .description("Write annotations.json + annotations.md into each document folder (backup)")
  .action(async (doc) => print(await request("/api/export", { method: "POST", json: doc ? { doc } : {} })));

program
  .command("reindex [doc]")
  .description("Rebuild the database index from library/ (annotations are untouched)")
  .action(async (doc) => print(await request("/api/reindex", { method: "POST", json: doc ? { doc } : {} })));

program
  .command("remove <doc>")
  .description("Delete a document (refuses if it has annotations unless --force)")
  .option("--force")
  .action(async (doc, o) => print(await request(`/api/documents/${doc}${o.force ? "?force=1" : ""}`, { method: "DELETE" })));

program
  .command("health")
  .description("Check the server and database")
  .action(async () => print({ server: API_URL, ...(await request<object>("/api/health")) }));

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of process.stdin) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

program.parseAsync().catch((e: Error) => {
  console.error(`error: ${e instanceof ApiError && e.status ? `(${e.status}) ` : ""}${e.message}`);
  process.exit(1);
});
