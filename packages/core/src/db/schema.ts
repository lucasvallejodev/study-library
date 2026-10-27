import { sql } from 'drizzle-orm';
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

import type { Selector } from '../schemas';

const tsvector = customType<{ data: string }>({ dataType: () => 'tsvector' });

/** Index of library/<id>/document.json. Rebuildable from disk. */
export const documents = pgTable(
  'documents',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    authors: jsonb('authors').$type<string[]>().notNull().default([]),
    kind: text('kind').notNull(),
    path: text('path').notNull(),
    cover: text('cover'),
    sourceType: text('source_type').notNull(),
    sourceUrl: text('source_url'),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [index('documents_title_trgm').using('gin', sql`${t.title} gin_trgm_ops`)]
);

/** One row per chapter file. plain_text feeds the search vector. Rebuildable from disk. */
export const chapters = pgTable(
  'chapters',
  {
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    id: text('id').notNull(),
    order: integer('order').notNull(),
    title: text('title').notNull(),
    file: text('file').notNull(),
    matter: text('matter').notNull().default('body'),
    depth: integer('depth').notNull().default(1),
    contentHash: text('content_hash').notNull(),
    wordCount: integer('word_count').notNull(),
    plainText: text('plain_text').notNull(),
    search: tsvector('search').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(plain_text, '')), 'B')`
    ),
  },
  t => [
    primaryKey({ columns: [t.documentId, t.id] }),
    index('chapters_search_idx').using('gin', t.search),
  ]
);

/**
 * Your highlights and notes: NOT rebuildable from disk, back them up with `pnpm lib export`.
 * No FK to chapters on purpose: re-imports replace chapter rows, annotations must survive.
 */
export const annotations = pgTable(
  'annotations',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id'),
    chapterId: text('chapter_id'),
    type: text('type').notNull(),
    color: text('color'),
    selectors: jsonb('selectors').$type<Selector[]>().notNull().default([]),
    /** Denormalised TextQuoteSelector.exact, for search and listing. */
    quote: text('quote'),
    body: text('body'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    orphaned: boolean('orphaned').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    search: tsvector('search').generatedAlwaysAs(
      sql`setweight(to_tsvector('english', coalesce(quote, '')), 'A') || setweight(to_tsvector('english', coalesce(body, '')), 'B')`
    ),
  },
  t => [
    index('annotations_chapter_idx').on(t.documentId, t.chapterId),
    index('annotations_created_idx').on(t.createdAt),
    index('annotations_search_idx').using('gin', t.search),
  ]
);

export const readingProgress = pgTable(
  'reading_progress',
  {
    documentId: text('document_id').notNull(),
    chapterId: text('chapter_id').notNull(),
    /** 0..1 scroll position through the chapter. */
    position: real('position').notNull().default(0),
    percent: real('percent').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  t => [primaryKey({ columns: [t.documentId, t.chapterId] })]
);

export type StoredQuestion = {
  annotationId?: string;
  answer?: string;
  correct?: boolean;
  feedback?: string;
  question: string;
  quote?: string;
};

export const studySessions = pgTable('study_sessions', {
  id: serial('id').primaryKey(),
  documentId: text('document_id').notNull(),
  chapterId: text('chapter_id'),
  kind: text('kind').notNull().default('study'),
  questions: jsonb('questions').$type<StoredQuestion[]>().notNull().default([]),
  score: real('score'),
  summary: text('summary'),
  followUps: jsonb('follow_ups').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const importJobs = pgTable('import_jobs', {
  id: serial('id').primaryKey(),
  /** "file" (uploaded path) or "url" */
  inputType: text('input_type').notNull(),
  input: text('input').notNull(),
  originalName: text('original_name'),
  options: jsonb('options').$type<Record<string, unknown>>().notNull().default({}),
  status: text('status').notNull().default('queued'),
  log: text('log').notNull().default(''),
  error: text('error'),
  documentId: text('document_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
