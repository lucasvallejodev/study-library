---
name: further-reading
description: Find good resources on the internet — videos, articles, blog posts, papers, official docs, courses — to go deeper on the topic of a chapter or one highlight, check every link, and save a curated list as a note in the Study Library. Use for "/further-reading <doc> <chapter|a-id>", "find resources on this", "videos about this topic", "where can I learn more about…".
argument-hint: <doc> <chapter> | <a-id> | <deep link>  [--level beginner|intermediate|advanced] [--formats videos,articles,docs,papers,courses]
---

# Further reading

Follow `_agents/conventions/skills.md`. This skill needs web search and the ability to open pages; without them, say so and stop.

## Ask (one message, skip what is known)

1. Your level with this topic [from the book's level: beginner/intermediate/advanced]
2. Formats you prefer [videos + articles + official docs]
3. Time you want to spend [about 2 hours] — and anything to avoid (paywalls, a language)

## Find the topic

Read the chapter (and the highlight, if one is given) and its figures (`pnpm -s lib assets`). Write down in one line each: the core topic, 2–4 sub-topics or terms, and what the book leaves unexplained or the user's notes ask about. Search for those, not for the book's title.

## Search and check

- Run several searches per sub-topic, mixing formats: conference talks and lectures, explanatory videos, well-known blog posts, official documentation, papers or book chapters, interactive tutorials.
- **Open every candidate** before listing it. Confirm it exists, matches the topic and level, and read its real title, author, date and length (video duration, reading time, page count). Drop dead links, thin SEO pages, paywalled pages (unless the user allowed them) and anything clearly outdated for technical topics.
- Prefer primary and authoritative sources: the author of the technique, official docs, university courses, respected practitioners. Keep at most one resource per idea unless they differ in format or depth.

## Write

6–12 resources, grouped by what they are for, best first in each group:

```markdown
**Start here**

- [Title](url) — Author · video · 18 min · 2023
  Why: one line on what it adds beyond the chapter.

**Go deeper**

- …

**Reference**

- …

_Checked on <date>. Suggested order: 1 → 3 → 2._
```

Say which resource answers which open question from the user's notes, if any.

## Save

Chapter target: chapter note. Highlight target: note on the highlight. Tags `claude,further-reading`. Update an earlier further-reading note instead of adding a second one (keep links the user may have opened; mark removed ones).
