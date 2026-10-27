import { z } from "zod";

/** Stable string ids: lowercase slug characters only, because they appear in URLs. */
export const IdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "ids are lowercase slugs");

export const DocumentKind = z.enum(["book", "article", "docs"]);
export type DocumentKind = z.infer<typeof DocumentKind>;

/** Where a chapter sits in the book. Front and back matter are hidden by default in the reader. */
export const ChapterMatter = z.enum(["front", "body", "back"]);
export type ChapterMatter = z.infer<typeof ChapterMatter>;

export const ChapterEntrySchema = z.object({
  id: IdSchema,
  order: z.number().int().positive(),
  title: z.string().min(1),
  file: z.string().regex(/^chapters\/[^/]+\.md$/),
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  wordCount: z.number().int().nonnegative(),
  matter: ChapterMatter.default("body"),
  /** TOC nesting level, 1 = top level. Used to indent the TOC. */
  depth: z.number().int().positive().default(1),
  /** Original source location for web pages (docs crawl, split articles). */
  sourceUrl: z.string().url().optional(),
});
export type ChapterEntry = z.infer<typeof ChapterEntrySchema>;

export const FileSourceSchema = z.object({
  type: z.enum(["epub", "mobi", "azw", "azw3"]),
  file: z.string(),
  importedAt: z.string().datetime(),
});
export const UrlSourceSchema = z.object({
  type: z.enum(["url", "docs"]),
  url: z.string().url(),
  importedAt: z.string().datetime(),
  publishedAt: z.string().optional(),
  /** Saved copy of the fetched HTML, relative to the document folder. */
  file: z.string().optional(),
});
export const SourceSchema = z.discriminatedUnion("type", [
  FileSourceSchema.extend({ type: z.literal("epub") }),
  FileSourceSchema.extend({ type: z.literal("mobi") }),
  FileSourceSchema.extend({ type: z.literal("azw") }),
  FileSourceSchema.extend({ type: z.literal("azw3") }),
  UrlSourceSchema.extend({ type: z.literal("url") }),
  UrlSourceSchema.extend({ type: z.literal("docs") }),
]);
export type Source = z.infer<typeof SourceSchema>;

/** The contract: library/<doc>/document.json */
export const DocumentSchema = z.object({
  id: IdSchema,
  title: z.string().min(1),
  authors: z.array(z.string()).default([]),
  kind: DocumentKind,
  language: z.string().optional(),
  description: z.string().optional(),
  source: SourceSchema,
  cover: z.string().optional(),
  chapters: z.array(ChapterEntrySchema).min(1),
});
export type LibraryDocument = z.infer<typeof DocumentSchema>;

/** YAML frontmatter at the top of every chapter file. */
export const ChapterFrontmatterSchema = z.object({
  id: IdSchema,
  title: z.string(),
  order: z.number().int().positive(),
  document: IdSchema,
});
export type ChapterFrontmatter = z.infer<typeof ChapterFrontmatterSchema>;

// ---- Annotations (W3C Web Annotation selectors) ----

export const TextQuoteSelectorSchema = z.object({
  type: z.literal("TextQuoteSelector"),
  exact: z.string().min(1),
  prefix: z.string().default(""),
  suffix: z.string().default(""),
});
export const TextPositionSelectorSchema = z.object({
  type: z.literal("TextPositionSelector"),
  start: z.number().int().nonnegative(),
  end: z.number().int().nonnegative(),
});
export const SelectorSchema = z.discriminatedUnion("type", [TextQuoteSelectorSchema, TextPositionSelectorSchema]);
export type TextQuoteSelector = z.infer<typeof TextQuoteSelectorSchema>;
export type TextPositionSelector = z.infer<typeof TextPositionSelectorSchema>;
export type Selector = z.infer<typeof SelectorSchema>;

export const AnnotationType = z.enum(["highlight", "note", "bookmark", "ai_question"]);
export type AnnotationType = z.infer<typeof AnnotationType>;
export const HighlightColor = z.enum(["yellow", "green", "blue", "pink"]);
export type HighlightColor = z.infer<typeof HighlightColor>;

export const AnnotationSchema = z.object({
  id: z.string().regex(/^a-[a-z0-9]+$/),
  documentId: IdSchema.nullable(),
  chapterId: IdSchema.nullable(),
  type: AnnotationType,
  color: HighlightColor.nullable(),
  /** Empty for chapter notes, bookmarks without a passage and free notes. */
  selectors: z.array(SelectorSchema),
  body: z.string().nullable(),
  tags: z.array(z.string()),
  orphaned: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

export const NewAnnotationSchema = z.object({
  documentId: IdSchema.nullable().optional(),
  chapterId: IdSchema.nullable().optional(),
  type: AnnotationType.default("highlight"),
  color: HighlightColor.nullable().optional(),
  selectors: z.array(SelectorSchema).default([]),
  /** Alternative to selectors for CLI/AI callers: the server builds selectors from this quote. */
  quote: z.string().optional(),
  body: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
});
export type NewAnnotation = z.infer<typeof NewAnnotationSchema>;

export const AnnotationPatchSchema = z.object({
  color: HighlightColor.nullable().optional(),
  body: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  type: AnnotationType.optional(),
  orphaned: z.boolean().optional(),
  selectors: z.array(SelectorSchema).optional(),
});

// ---- Study sessions ----

export const StudyQuestionSchema = z.object({
  question: z.string(),
  answer: z.string().optional(),
  feedback: z.string().optional(),
  correct: z.boolean().optional(),
  /** Annotation id or quote the question is about. */
  annotationId: z.string().optional(),
  quote: z.string().optional(),
});
export const StudySessionInputSchema = z.object({
  documentId: IdSchema,
  chapterId: IdSchema.nullable().optional(),
  kind: z.enum(["study", "review"]).default("study"),
  questions: z.array(StudyQuestionSchema).default([]),
  score: z.number().min(0).max(1).nullable().optional(),
  summary: z.string().optional(),
  followUps: z.array(z.string()).default([]),
});
export type StudySessionInput = z.infer<typeof StudySessionInputSchema>;

// ---- Import report ----

export const ImportReportSchema = z.object({
  documentId: IdSchema,
  createdAt: z.string(),
  importer: z.string(),
  chapterCount: z.number().int(),
  totalWords: z.number().int(),
  chapters: z.array(z.object({ id: z.string(), title: z.string(), wordCount: z.number().int(), matter: ChapterMatter })),
  warnings: z.array(
    z.object({
      code: z.enum([
        "missing-image",
        "broken-link",
        "short-chapter",
        "long-chapter",
        "unresolved-toc-entry",
        "no-toc",
        "empty-content",
        "fetch-fallback",
        "pandoc-raw-html",
        "other",
      ]),
      message: z.string(),
      chapterId: z.string().optional(),
    }),
  ),
});
export type ImportReport = z.infer<typeof ImportReportSchema>;
