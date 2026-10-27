import type { Command } from 'commander';

import type { DocumentBundle, JsonValue } from '../api-types';
import { request } from '../client';
import { print } from '../output';

type ListOptions = { chapters?: boolean };

type ChapterOptions = { withAnnotations?: boolean };

export const registerList = (program: Command): void => {
  program
    .command('list')
    .description('List documents as JSON')
    .option('--chapters', "include each document's chapters")
    .action(async (options: ListOptions) => {
      const query = options.chapters ? '?chapters=1' : '';

      print(await request<JsonValue>(`/api/documents${query}`));
    });
};

export const registerShow = (program: Command): void => {
  program
    .command('show <doc>')
    .description('Document metadata and chapters with progress and annotation counts')
    .action(async (doc: string) => print(await request<JsonValue>(`/api/documents/${doc}`)));
};

export const registerChapter = (program: Command): void => {
  program
    .command('chapter <doc> <chapter>')
    .description('Print a chapter as Markdown')
    .option(
      '-a, --with-annotations',
      'inline your highlights as ==text== [^id] with notes and deep links'
    )
    .action(async (doc: string, chapter: string, options: ChapterOptions) => {
      const annotationsQuery = options.withAnnotations ? '&annotations=1' : '';

      print(
        await request<string>(
          `/api/documents/${doc}/chapters/${chapter}?format=md${annotationsQuery}`
        )
      );
    });
};

export const registerReport = (program: Command): void => {
  program
    .command('report <doc>')
    .description("Print the document's import-report.json")
    .action(async (doc: string) => {
      const bundle = await request<Pick<DocumentBundle, 'report'>>(`/api/documents/${doc}/bundle`);

      print(bundle.report);
    });
};

export const registerSearch = (program: Command): void => {
  program
    .command('search <query...>')
    .description('Full-text search over chapters and annotations')
    .action(async (query: string[]) =>
      print(await request<JsonValue>(`/api/search?q=${encodeURIComponent(query.join(' '))}`))
    );
};
