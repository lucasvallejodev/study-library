import 'server-only';

import { desc, eq, sql, type SQL } from 'drizzle-orm';

import type { AnnotationRow } from './annotations';
import { getDb, t } from './db';

/** A chapter matching a search, with a highlighted snippet (`<mark>` around matches). */
export type ChapterHit = {
  chapterId: string;
  documentId: string;
  documentTitle: string;
  rank: number;
  snippet: string;
  title: string;
};

/** A document whose title matches a search. */
export type DocumentHit = {
  id: string;
  title: string;
};

/** Everything a search found: chapters, annotations and document titles. */
export type SearchResults = {
  chapters: ChapterHit[];
  documents: DocumentHit[];
  notes: AnnotationRow[];
};

const DEFAULT_SEARCH_LIMIT = 40;
const TITLE_MATCH_LIMIT = 10;

const HeadlineOptions = sql.raw(
  "'StartSel=<mark>, StopSel=</mark>, MaxWords=40, MinWords=15, MaxFragments=2, FragmentDelimiter= … '"
);

const containsPattern = (text: string): string => `%${text}%`;

const searchChapters = async (query: SQL, limit: number): Promise<ChapterHit[]> =>
  getDb()
    .select({
      chapterId: t.chapters.id,
      documentId: t.chapters.documentId,
      documentTitle: t.documents.title,
      rank: sql<number>`ts_rank(${t.chapters.search}, ${query})`,
      snippet: sql<string>`ts_headline('english', ${t.chapters.plainText}, ${query}, ${HeadlineOptions})`,
      title: t.chapters.title,
    })
    .from(t.chapters)
    .innerJoin(t.documents, eq(t.documents.id, t.chapters.documentId))
    .where(sql`${t.chapters.search} @@ ${query}`)
    .orderBy(desc(sql`ts_rank(${t.chapters.search}, ${query})`))
    .limit(limit);

const searchNotes = async (query: SQL, limit: number): Promise<AnnotationRow[]> =>
  getDb()
    .select()
    .from(t.annotations)
    .where(sql`${t.annotations.search} @@ ${query}`)
    .orderBy(desc(sql`ts_rank(${t.annotations.search}, ${query})`))
    .limit(limit);

const searchTitles = async (text: string): Promise<DocumentHit[]> =>
  getDb()
    .select({ id: t.documents.id, title: t.documents.title })
    .from(t.documents)
    .where(
      sql`${t.documents.title} % ${text} or ${t.documents.title} ilike ${containsPattern(text)}`
    )
    .limit(TITLE_MATCH_LIMIT);

/**
 * Searches chapter text, annotations and document titles.
 *
 * @remarks
 * Chapters and annotations use Postgres full-text search (`websearch_to_tsquery`, English) ranked
 * by `ts_rank`; titles use trigram similarity or a substring match, up to 10 documents.
 *
 * @param text - The search text as typed by the user.
 * @param limit - Maximum chapters and maximum annotations returned.
 * @returns The chapter hits, matching annotations and matching documents.
 */
export const search = async (
  text: string,
  limit = DEFAULT_SEARCH_LIMIT
): Promise<SearchResults> => {
  const query = sql`websearch_to_tsquery('english', ${text})`;
  const chapters = await searchChapters(query, limit);
  const notes = await searchNotes(query, limit);
  const documents = await searchTitles(text);

  return {
    chapters,
    documents,
    notes,
  };
};
