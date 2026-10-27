import type { Command } from 'commander';

import { annotationsToMarkdown } from '../annotation-markdown';
import type { Annotation, JsonValue } from '../api-types';
import { API_URL, request } from '../client';
import { parseTagList, print, toSearchParams } from '../output';

type AnnotationsOptions = {
  chapter?: string;
  format: string;
  query?: string;
  since?: string;
  tag?: string;
  type?: string;
};

type AddNoteOptions = {
  body?: string;
  color?: string;
  on?: string;
  quote?: string;
  tags?: string;
  type: string;
};

type EditNoteOptions = {
  body?: string;
  color?: string;
  tags?: string;
  type?: string;
};

type AnnotationPatch = Partial<Pick<Annotation, 'body' | 'color' | 'tags' | 'type'>>;

const listAnnotations = (
  doc: string | undefined,
  options: AnnotationsOptions
): Promise<Annotation[]> => {
  const params = toSearchParams([
    ['doc', doc],
    ['chapter', options.chapter],
    ['since', options.since],
    ['type', options.type],
    ['tag', options.tag],
    ['q', options.query],
  ]);

  return request<Annotation[]>(`/api/annotations?${params}`);
};

export const registerAnnotations = (program: Command): void => {
  program
    .command('annotations [doc]')
    .description('List highlights and notes')
    .option('-c, --chapter <id>')
    .option('-s, --since <age>', 'e.g. 7d, 12h, or an ISO date')
    .option('-t, --type <types>', 'highlight,note,bookmark,ai_question')
    .option('--tag <tag>')
    .option('-q, --query <text>', 'full-text search')
    .option('-f, --format <format>', 'json or md', 'json')
    .action(async (doc: string | undefined, options: AnnotationsOptions) => {
      const annotations = await listAnnotations(doc, options);

      if (options.format !== 'md') return print(annotations);
      print(annotationsToMarkdown(annotations) || 'No annotations.');
    });
};

type NewAnnotationPayload = Pick<
  Annotation,
  'body' | 'chapterId' | 'color' | 'documentId' | 'selectors' | 'tags' | 'type'
> & { quote: string | undefined };

type NewAnnotation = {
  chapter: string | undefined;
  doc: string;
  options: AddNoteOptions;
  target: Annotation | undefined;
};

const newAnnotationPayload = ({
  chapter,
  doc,
  options,
  target,
}: NewAnnotation): NewAnnotationPayload => ({
  body: options.body ?? null,
  chapterId: chapter ?? null,
  color: options.color ?? null,
  documentId: doc,
  quote: target ? undefined : options.quote,
  selectors: target?.selectors ?? [],
  tags: options.tags ? parseTagList(options.tags) : [],
  type: options.type,
});

const readerLink = (doc: string, chapter: string | undefined, id: string): string | undefined =>
  chapter ? `${API_URL}/read/${doc}/${chapter}#${id}` : undefined;

const createAnnotation = async (
  doc: string,
  chapterArgument: string | undefined,
  options: AddNoteOptions
): Promise<void> => {
  const target = options.on
    ? await request<Annotation>(`/api/annotations/${options.on}`)
    : undefined;

  const chapter = target?.chapterId ?? chapterArgument;

  const created = await request<Annotation>('/api/annotations', {
    json: newAnnotationPayload({
      chapter,
      doc,
      options,
      target,
    }),
    method: 'POST',
  });

  print({ ...created, link: readerLink(doc, chapter, created.id) });
};

export const registerAddNote = (program: Command): void => {
  program
    .command('add-note <doc> [chapter]')
    .description('Add a note, highlight or AI question; --quote anchors it to a passage')
    .option(
      '-q, --quote <text>',
      'exact passage from the chapter (small differences are tolerated)'
    )
    .option(
      '--on <annotation-id>',
      'attach to the same passage as an existing highlight (like a reply in the margin)'
    )
    .option('-b, --body <markdown>', 'note text')
    .option('-t, --type <type>', 'highlight | note | ai_question | bookmark', 'note')
    .option('--color <color>', 'yellow | green | blue | pink')
    .option('--tags <tags>', 'comma separated')
    .action(createAnnotation);
};

const toAnnotationPatch = (options: EditNoteOptions): AnnotationPatch => {
  const patch: AnnotationPatch = {};

  if (options.body !== undefined) patch.body = options.body;
  if (options.tags !== undefined) patch.tags = parseTagList(options.tags);
  if (options.color !== undefined) patch.color = options.color;
  if (options.type !== undefined) patch.type = options.type;

  return patch;
};

export const registerNote = (program: Command): void => {
  program
    .command('note <id>')
    .description('One annotation: passage, note, tags, document and chapter')
    .action(async (id: string) => print(await request<Annotation>(`/api/annotations/${id}`)));
};

export const registerEditNote = (program: Command): void => {
  program
    .command('edit-note <id>')
    .description("Change an annotation's body, tags, color or type")
    .option('-b, --body <markdown>')
    .option('--tags <tags>')
    .option('--color <color>')
    .option('-t, --type <type>')
    .action(async (id: string, options: EditNoteOptions) =>
      print(
        await request<Annotation>(`/api/annotations/${id}`, {
          json: toAnnotationPatch(options),
          method: 'PATCH',
        })
      )
    );
};

export const registerDeleteNote = (program: Command): void => {
  program
    .command('delete-note <id>')
    .description('Delete an annotation')
    .action(async (id: string) =>
      print(await request<JsonValue>(`/api/annotations/${id}`, { method: 'DELETE' }))
    );
};
