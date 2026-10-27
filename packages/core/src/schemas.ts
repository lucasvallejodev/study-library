import { z } from 'zod';

import { Patterns } from './patterns';

/** Stable string ids: lowercase slug characters only, because they appear in URLs. */
export const IdSchema = z.string().regex(Patterns.slugId, 'ids are lowercase slugs');

/** What a document is: a book, a single article or a crawled documentation site. */
export const DocumentKind = z.enum(['book', 'article', 'docs']);
export type DocumentKind = z.infer<typeof DocumentKind>;

/** Where a chapter sits in the book. Front and back matter are hidden by default in the reader. */
export const ChapterMatter = z.enum(['front', 'body', 'back']);
export type ChapterMatter = z.infer<typeof ChapterMatter>;

/**
 * One chapter in `document.json`.
 *
 * @remarks
 * `depth` is the TOC nesting level (1 = top level), used to indent the TOC. `sourceUrl` is
 * the original location for web pages (docs crawl, split articles).
 */
export const ChapterEntrySchema = z.object({
  contentHash: z.string().regex(Patterns.contentHash),
  depth: z.number().int().positive().default(1),
  file: z.string().regex(Patterns.chapterFilePath),
  id: IdSchema,
  matter: ChapterMatter.default('body'),
  order: z.number().int().positive(),
  sourceUrl: z.string().url().optional(),
  title: z.string().min(1),
  wordCount: z.number().int().nonnegative(),
});
export type ChapterEntry = z.infer<typeof ChapterEntrySchema>;

/** Source of a document imported from an e-book file. */
export const FileSourceSchema = z.object({
  file: z.string(),
  importedAt: z.string().datetime(),
  type: z.enum(['epub', 'mobi', 'azw', 'azw3']),
});
/**
 * Source of a document imported from a web page or a docs site.
 *
 * @remarks
 * `file` is the saved copy of the fetched HTML, relative to the document folder.
 */
export const UrlSourceSchema = z.object({
  file: z.string().optional(),
  importedAt: z.string().datetime(),
  publishedAt: z.string().optional(),
  type: z.enum(['url', 'docs']),
  url: z.string().url(),
});
/**
 * Source of a document imported from a Markdown file.
 *
 * @remarks
 * `url` is where the content originally came from (a PDF's URL, a website...), if known.
 */
export const MarkdownSourceSchema = z.object({
  file: z.string(),
  importedAt: z.string().datetime(),
  type: z.literal('markdown'),
  url: z.string().url().optional(),
});
/** Where a document came from, discriminated by `type`. */
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

/** The contract: `library/<doc>/document.json`. */
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

/** W3C Web Annotation selector that anchors a passage by its text and surrounding context. */
export const TextQuoteSelectorSchema = z.object({
  exact: z.string().min(1),
  prefix: z.string().default(''),
  suffix: z.string().default(''),
  type: z.literal('TextQuoteSelector'),
});
/** W3C Web Annotation selector that anchors a passage by `[start, end)` character offsets. */
export const TextPositionSelectorSchema = z.object({
  end: z.number().int().nonnegative(),
  start: z.number().int().nonnegative(),
  type: z.literal('TextPositionSelector'),
});
/** Any supported W3C Web Annotation selector, discriminated by `type`. */
export const SelectorSchema = z.discriminatedUnion('type', [
  TextQuoteSelectorSchema,
  TextPositionSelectorSchema,
]);
export type TextQuoteSelector = z.infer<typeof TextQuoteSelectorSchema>;
export type TextPositionSelector = z.infer<typeof TextPositionSelectorSchema>;
export type Selector = z.infer<typeof SelectorSchema>;

/** Kinds of annotation the reader and the CLI create. */
export const AnnotationType = z.enum(['highlight', 'note', 'bookmark', 'ai_question']);
export type AnnotationType = z.infer<typeof AnnotationType>;
/** Colours a highlight can have. */
export const HighlightColor = z.enum(['yellow', 'green', 'blue', 'pink']);
export type HighlightColor = z.infer<typeof HighlightColor>;

/**
 * A stored highlight, note, bookmark or AI question.
 *
 * @remarks
 * `selectors` is empty for chapter notes, bookmarks without a passage and free notes.
 */
export const AnnotationSchema = z.object({
  body: z.string().nullable(),
  chapterId: IdSchema.nullable(),
  color: HighlightColor.nullable(),
  createdAt: z.string(),
  documentId: IdSchema.nullable(),
  id: z.string().regex(Patterns.annotationId),
  orphaned: z.boolean(),
  selectors: z.array(SelectorSchema),
  tags: z.array(z.string()),
  type: AnnotationType,
  updatedAt: z.string(),
});
export type Annotation = z.infer<typeof AnnotationSchema>;

/**
 * Input for creating an annotation.
 *
 * @remarks
 * `quote` is an alternative to `selectors` for CLI/AI callers: the server builds the
 * selectors from that quote.
 */
export const NewAnnotationSchema = z.object({
  body: z.string().nullable().optional(),
  chapterId: IdSchema.nullable().optional(),
  color: HighlightColor.nullable().optional(),
  documentId: IdSchema.nullable().optional(),
  quote: z.string().optional(),
  selectors: z.array(SelectorSchema).default([]),
  tags: z.array(z.string()).default([]),
  type: AnnotationType.default('highlight'),
});
export type NewAnnotation = z.infer<typeof NewAnnotationSchema>;

/** Partial update of an annotation. */
export const AnnotationPatchSchema = z.object({
  body: z.string().nullable().optional(),
  color: HighlightColor.nullable().optional(),
  orphaned: z.boolean().optional(),
  selectors: z.array(SelectorSchema).optional(),
  tags: z.array(z.string()).optional(),
  type: AnnotationType.optional(),
});

/**
 * One question asked in a study session.
 *
 * @remarks
 * `annotationId` or `quote` says what the question is about.
 */
export const StudyQuestionSchema = z.object({
  annotationId: z.string().optional(),
  answer: z.string().optional(),
  correct: z.boolean().optional(),
  feedback: z.string().optional(),
  question: z.string(),
  quote: z.string().optional(),
});
/** A finished study or review session, as saved by the study skills. */
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

/** The contract: `library/<doc>/import-report.json`, written by every importer. */
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
