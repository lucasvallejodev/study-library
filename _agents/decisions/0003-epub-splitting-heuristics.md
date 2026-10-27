# ADR 0003 — EPUB splitting heuristics beyond "top-level TOC entries"

Status: accepted (2026-10-27)

The plan said "take top-level TOC entries as chapter starts". Real books broke that:

- Alice and Frankenstein nest every chapter under a part/half-title entry, so top-level-only would produce one giant chapter. Default is now **all TOC levels** (`--toc-depth` still limits it).
- Sherlock Holmes lists story parts I/II/III as anchors inside the story's file; all-levels would create chapters titled "I". Rule: **child entries anchored inside their parent's file stay in the parent**.
- Part pages that only hold a title fold into the next chapter.
- `matter` (front/body/back) is recorded per chapter so the reader can hide title pages, imprints, colophons and licenses without dropping them.
