---
name: pdf-to-library
description: Turn a PDF (or a DOCX, slide deck, long text or anything Claude can read but the importers cannot) into a Study Library document by converting it to chapter-structured Markdown and importing it. Use for "import this PDF", "add this paper/report/textbook to my library".
argument-hint: <path-to-file> [--id short-id]
---

# PDF (and other documents) to library

Native PDF import is planned for v0.3. Until then you do the conversion: read the file, write clean Markdown, import it with the Markdown importer (chapters split at `# ` headings).

## 1. Read and plan

- Read the PDF with the Read tool (use `pages` ranges for long files, ≤ 20 pages per call). Note the title, authors, and the real structure (chapters/sections from the TOC or headings).
- Decide the chapter level: a book → one `#` per chapter; a paper → one `#` per main section (Abstract, Introduction, …) or a single chapter if short.
- Tell the user the plan in one or two lines (title, number of chapters). For very long books (> 150 pages), confirm before converting everything.

## 2. Write Markdown to `_temp/pdf/<slug>/<slug>.md`

```markdown
---
title: "Exact Title"
authors: ["First Author", "Second Author"]
kind: book            # book | article
description: "One sentence."
source_url: "https://… (only if known)"
---

# Chapter One Title

Body text…

## A section inside the chapter

![Figure 1: caption](figures/fig-1.png)
```

Fidelity rules:
- Transcribe the text faithfully; fix only extraction artifacts: hyphenation across lines, running headers/footers, page numbers, broken paragraphs, ligatures.
- Keep footnotes as Markdown footnotes (`[^1]` … `[^1]: text`) within the chapter that uses them.
- Tables as GFM tables; formulas as `$…$` / `$$…$$`; code in fenced blocks.
- Figures: if you can extract images (e.g. `pdfimages -png file.pdf _temp/pdf/<slug>/figures/fig` when poppler is installed), reference them relatively; otherwise write `> [Figure N: description of what it shows]`.
- Only `#` starts a new chapter; use `##`/`###` inside chapters.

## 3. Import and check

```bash
pnpm -s lib import _temp/pdf/<slug>/<slug>.md [--id <short-id>]
pnpm -s lib show <id>
```

Then follow the review steps of the `import-source` skill (spot-check chapters, fix with `lib pull`/`lib push`). Report the link to the user and delete `_temp/pdf/<slug>` once they're happy (the original Markdown is kept in the library under `source/original.md`).
