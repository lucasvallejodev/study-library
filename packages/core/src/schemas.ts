import { z } from 'zod';

/** Stable string ids: lowercase slug characters only, because they appear in URLs. */
export const IdSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, 'ids are lowercase slugs');

export const DocumentKind = z.enum(['book', 'article', 'docs']);
export type DocumentKind = z.infer<typeof DocumentKind>;

/** Where a chapter sits in the book. Front and back matter are hidden by default in the reader. */
export const ChapterMatter = z.enum(['front', 'body', 'back']);
export type ChapterMatter = z.infer<typeof ChapterMatter>;

export const ChapterEntrySchema = z.object({
  contentHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  /** TOC nesting level, 1 = top level. Used to indent the TOC. */
  depth: z.number().int().positive().default(1),
  file: z.string().regex(/^chapters\/[^/]+\.md$/),
  id: IdSchema,
  matter: ChapterMatter.default('body'),
  order: z.number().int().positive(),
  /** Original source location for web pages (docs crawl, split articles). */
  sourceUrl: z.string().url().optional(),
  title: z.string().min(1),
  wordCount: z.number().int().nonnegative(),
});
export type ChapterEntry = z.infer<typeof ChapterEntrySchema>;

export const FileSourceSchema = z.object({
  file: z.string(),
  importedAt: z.string().datetime(),
  type: z.enum(['epub', 'mobi', 'azw', 'azw3']),
});
export const UrlSourceSchema = z.object({
  /** Saved copy of the fetched HTML, relative to the document folder. */
  file: z.string().optional(),
  importedAt: z.string().datetime(),
  publishedAt: z.string().optional(),
  type: z.enum(['url', 'docs']),
  url: z.string().url(),
});
export const MarkdownSourceSchema = z.object({
  file: z.string(),
  importedAt: z.string().datetime(),
  type: z.literal('markdown'),
  /** Where the content originally came from (a PDF's URL, a website...), if known. */
  url: z.string().url().optional(),
});
export const SourceSchema = z.discriminatedUnion('type', [
  MarkdownSourceSchema,
  FileSourceSchema.extend({ type: z.literal('epub') }),
  FileSourceSchema.extend({ type: z.literal('mobi') }),
  FileSourceSchema.extend({ type: z.literal('azw') }),
  FileSourceSchema.extend({ type: z.literal('azw3') }),
  UrlSourceSchema.extend({ type: z.literal('url') }),
  UrlSourceSchema.extend({ type: z.literal('docs') }),
]);
export type Source = z.infer<typeof SourceSchema>;

/** The contract: library/<doc>/document.json */
export const DocumentSchema = z.object({
  authors: z.array(z.string()).default([]),
  chapters: z.array(ChapterEntrySchema).min(1),
  cover: z.string().optional(),
  description: z.string().optional(),
  id: IdSchema,
  kind: DocumentKind,
  language: z.string().optional(),
  source: SourceSchema,
  title: z.string().min(1),
});
export type LibraryDocument = z.infer<typeof DocumentSchema>;

/** YAML frontmatter at the top of every chapter file. */
export const ChapterFrontmatterSchema = z.object({
  document: IdSchema,
  id: IdSchema,
  order: z.number().int().positive(),
  title: z.string(),
});
export type ChapterFrontmatter = z.infer<typeof ChapterFrontmatterSchema>;

// ---- Annotations (W3C Web Annotation selectors) ----

export const TextQuoteSelectorSchema = z.object({
  exact: z.string().min(1),
  prefix: z.string().default(''),
  suffix: z.string().default(''),
  type: z.literal('TextQuoteSelector'),
});
export const TextPositionSelectorSchema = z.object({
  end: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  type: z.literal('TextPositionSelector'),
});
export const SelectorSchema = z.discriminatedUnion('type', [
  TextQuoteSelectorSchema,
  TextPositionSelectorSchema,
]);
export type TextQuoteSelector = z.infer<typeof TextQuoteSelectorSchema>;
export type TextPositionSelector = z.infer<typeof TextPositionSelectorSchema>;
export type Selector = z.infer<typeof SelectorSchema>;

export const AnnotationType = z.enum(['highlight', 'note', 'bookmark', 'ai_question']);
export type AnnotationType = z.infer<typeof AnnotationType>;
export const HighlightColor = z.enum(['yellow', 'green', 'blue', 'pink']);
export type HighlightColor = z.infer<typeof HighlightColor>;

export const AnnotationSchema = z.object({
  body: z.string().nullable(),
  chapterId: IdSchema.nullable(),
  color: HighlightColor.nullable(),
  createdAt: z.string(),
  documentId: IdSchema.nullable(),
  id: z.string().regex(/^a-[a-z0-9]+$/),
  orphaned: z.boolean(),
  /** Empty for chapter notes, bookmarks without a passage and free notes. */
  selectors: z.array(SelectorSchema),
  tags: z.array(z.string()),
  type: AnnotationType,
  updatedAt: z.string(),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

export const NewAnnotationSchema = z.object({
  body: z.string().nullable().optional(),
  chapterId: IdSchema.nullable().optional(),
  color: HighlightColor.nullable().optional(),
  documentId: IdSchema.nullable().optional(),
  /** Alternative to selectors for CLI/AI callers: the server builds selectors from this quote. */
  quote: z.string().optional(),
  selectors: z.array(SelectorSchema).default([]),
  tags: z.array(z.string()).default([]),
  type: AnnotationType.default('highlight'),
});
export type NewAnnotation = z.infer<typeof NewAnnotationSchema>;

export const AnnotationPatchSchema = z.object({
  body: z.string().nullable().optional(),
  color: HighlightColor.nullable().optional(),
  orphaned: z.boolean().optional(),
  selectors: z.array(SelectorSchema).optional(),
  tags: z.array(z.string()).optional(),
  type: AnnotationType.optional(),
});

// ---- Study sessions ----

export const StudyQuestionSchema = z.object({
  /** Annotation id or quote the question is about. */
  annotationId: z.string().optional(),
  answer: z.string().optional(),
  correct: z.boolean().optional(),
  feedback: z.string().optional(),
  question: z.string(),
  quote: z.string().optional(),
});
export const StudySessionInputSchema = z.object({
  chapterId: IdSchema.nullable().optional(),
  documentId: IdSchema,
  followUps: z.array(z.string()).default([]),
  kind: z.enum(['study', 'review']).default('study'),
  questions: z.array(StudyQuestionSchema).default([]),
  score: z.number().min(0).max(1).nullable().optional(),
  summary: z.string().optional(),
});
export type StudySessionInput = z.infer<typeof StudySessionInputSchema>;

// ---- Import report ----

export const ImportReportSchema = z.object({
  chapterCount: z.number().int(),
  chapters: z.array(
    z.object({
      id: z.string(),
      matter: ChapterMatter,
      title: z.string(),
      wordCount: z.number().int(),
    })
  ),
  createdAt: z.string(),
  documentId: IdSchema,
  importer: z.string(),
  totalWords: z.number().int(),
  warnings: z.array(
    z.object({
      chapterId: z.string().optional(),
      code: z.enum([
        'missing-image',
        'broken-link',
        'short-chapter',
        'long-chapter',
        'unresolved-toc-entry',
        'no-toc',
        'empty-content',
        'fetch-fallback',
        'pandoc-raw-html',
        'other',
      ]),
      message: z.string(),
    })
  ),
});
export type ImportReport = z.infer<typeof ImportReportSchema>;
