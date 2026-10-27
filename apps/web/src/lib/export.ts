import "server-only";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { chapterRoute, documentDir, documentExists, readDocument } from "@study/core";
import { listAnnotations, listSessions, toAnnotation } from "./data";

/** Back up annotations and study history for one document into its library folder. */
export async function exportDocumentAnnotations(docId: string) {
  const doc = await readDocument(docId);
  const annotations = (await listAnnotations({ documentId: docId, limit: 100_000 })).reverse();
  const sessions = await listSessions({ documentId: docId, limit: 10_000 });
  const json = {
    documentId: docId,
    exportedAt: new Date().toISOString(),
    annotations: annotations.map(toAnnotation),
    studySessions: sessions.map((s) => ({ ...s, createdAt: s.createdAt.toISOString() })),
  };
  const dir = documentDir(docId);
  await writeFile(path.join(dir, "annotations.json"), JSON.stringify(json, null, 2) + "\n");

  const md: string[] = [`# ${doc.title} — annotations`, "", `Exported ${json.exportedAt}`, ""];
  for (const ch of doc.chapters) {
    const items = annotations.filter((a) => a.chapterId === ch.id);
    if (!items.length) continue;
    md.push(`## ${ch.title}`, "");
    for (const a of items) {
      const link = chapterRoute(docId, ch.id, a.id);
      md.push(`- **${a.type}**${a.color ? ` · ${a.color}` : ""}${a.tags.length ? ` · ${a.tags.map((t) => `#${t}`).join(" ")}` : ""} · [link](${link})${a.orphaned ? " · orphaned" : ""}`);
      if (a.quote) md.push("", `  > ${a.quote.replace(/\n+/g, " ")}`);
      if (a.body) md.push("", `  ${a.body.replace(/\n/g, "\n  ")}`);
      md.push("");
    }
  }
  const docNotes = annotations.filter((a) => !a.chapterId);
  if (docNotes.length) {
    md.push("## Document notes", "");
    for (const a of docNotes) md.push(`- ${a.body ?? ""}`, "");
  }
  if (sessions.length) {
    md.push("## Study sessions", "");
    for (const s of sessions) {
      md.push(`### ${s.createdAt.toISOString().slice(0, 10)} · ${s.kind}${s.chapterId ? ` · ${s.chapterId}` : ""}${s.score != null ? ` · score ${Math.round(s.score * 100)}%` : ""}`, "");
      if (s.summary) md.push(s.summary, "");
      for (const q of s.questions) md.push(`- ${q.correct === false ? "✗" : q.correct ? "✓" : "•"} ${q.question}${q.answer ? `\n  - Answer: ${q.answer}` : ""}${q.feedback ? `\n  - Feedback: ${q.feedback}` : ""}`);
      md.push("");
    }
  }
  await writeFile(path.join(dir, "annotations.md"), md.join("\n") + "\n");
  return { json: path.join(dir, "annotations.json"), markdown: path.join(dir, "annotations.md"), count: annotations.length };
}

export async function exportFreeNotes() {
  const notes = await listAnnotations({ free: true, limit: 100_000 });
  return notes.map(toAnnotation);
}

export { documentExists };
