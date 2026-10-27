# HTTP API (apps/web/src/app/api)

All JSON. Errors: `{ "error": "message" }` with 4xx/5xx (400 validation, 404 unknown id, 409 conflict, 422 quote not found). No auth (LAN only).

| Method & path | Purpose |
| --- | --- |
| `GET /api/health` | DB reachable |
| `GET /api/documents[?chapters=1]` | Library list with percent read, last read, annotation count |
| `GET /api/documents/:doc` | `document.json` + per-chapter `percent` and `annotationCount` |
| `DELETE /api/documents/:doc[?force=1]` | Remove folder + rows; 409 if annotations exist and not forced |
| `GET /api/documents/:doc/chapters/:ch` | JSON: chapter entry, prev/next, markdown, annotations |
| `GET /api/documents/:doc/chapters/:ch?format=md[&annotations=1]` | Markdown; with annotations inlined as `==text==[^a-id]` + footnotes holding type, deep link, tags, note; leftovers listed at the end |
| `GET /api/documents/:doc/bundle` | `{document, files: {path: content}, report, assets}` for editing |
| `PUT /api/documents/:doc/bundle` | `{document, files}` → validates, rewrites frontmatter, recomputes hashes/word counts, deletes unlisted chapter files, reindexes |
| `POST /api/documents/:doc/reimport` | Queue a re-import job (202) |
| `POST /api/import` | multipart `file` (+ `id`, `tocDepth`) or JSON `{url, id?, tocDepth?}` → job (202) |
| `GET /api/import/jobs`, `GET /api/import/jobs/:id` | Job list / job with `report` when done |
| `GET /api/annotations?doc&chapter&type=a,b&color&tag&since=7d&q&free=1&limit` | Filtered list (newest first) |
| `POST /api/annotations` | `{documentId, chapterId, type, color, selectors}` or `{…, quote}` (server anchors the quote; 422 if not found) |
| `GET/PATCH/DELETE /api/annotations/:id` | PATCH: `color, body, tags, type, orphaned, selectors` |
| `POST /api/progress` | `{documentId, chapterId, position}` |
| `GET /api/sessions?doc&chapter&since`, `POST /api/sessions` | Study sessions (`StudySessionInputSchema`) |
| `GET /api/search?q=` | `{chapters:[{documentId, chapterId, title, documentTitle, rank, snippet(<mark>)}], notes:[Annotation], documents:[{id,title}]}` (websearch syntax: quotes, `-exclude`, `or`) |
| `POST /api/export {doc?}` | Write `annotations.json` + `annotations.md` per document (+ `notebook-notes.json` when no doc) |
| `GET /api/export?doc&format=md|json` | Download a document's annotations |
| `POST /api/reindex {doc?}` | Rebuild index rows from disk |
| `GET /api/assets/:doc/assets/:file` | Images (immutable cache) |

Links printed by the API use `PUBLIC_URL` when set, else the request host.
