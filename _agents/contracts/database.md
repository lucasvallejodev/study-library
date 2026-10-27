# Database (PostgreSQL 18, Drizzle)

Schema: `packages/core/src/db/schema.ts`. Migrations: `packages/core/drizzle/` (generate with `pnpm db:generate --name <change>`; they run on server start and with `pnpm db:migrate`). `0000_init` also enables `pg_trgm`.

| Table              | Rebuildable from disk? | Key columns                                                                                                                                              |
| ------------------ | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `documents`        | yes                    | `id` (slug), title, authors (jsonb), kind, path, cover, source_type, source_url; trigram index on title                                                  |
| `chapters`         | yes                    | PK (`document_id`, `id`), order, title, file, matter, depth, content_hash, word_count, `plain_text`, generated `search` tsvector (title A, text B) + GIN |
| `annotations`      | **no**                 | `id` (`a-…`), document_id, chapter_id (no FK on purpose: survive re-imports), type (`highlight                                                           | note                                                                                                                      | bookmark                                    | ai_question`), color, `selectors`jsonb,`quote`(denormalised exact), body (Markdown), tags jsonb, orphaned, timestamps, generated`search` tsvector |
| `reading_progress` | **no**                 | PK (document_id, chapter_id), position 0..1 (last scroll), percent 0..1 (max reached)                                                                    |
| `study_sessions`   | **no**                 | document_id, chapter_id, kind (`study                                                                                                                    | review`), questions jsonb `[{question, answer, feedback, correct, annotationId, quote}]`, score 0..1, summary, follow_ups |
| `import_jobs`      | n/a                    | input_type (`file                                                                                                                                        | url                                                                                                                       | reimport`), input, options, status (`queued | running                                                                                                                                           | done | failed`), log, error, document_id |

Annotation shapes:

- Highlight: `type=highlight`, `selectors=[TextQuote, TextPosition]`, `color`, optional `body` (= highlight with a note).
- Chapter note: `type=note`, `chapter_id` set, `selectors=[]`.
- Free note: `type=note`, `document_id=null`.
- Bookmark: `type=bookmark`, chapter-level.
- Claude question: `type=ai_question`, usually anchored with selectors, `body` = the question (and optional hint).
