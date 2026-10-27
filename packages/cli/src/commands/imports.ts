import type { Command } from 'commander';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import type { BundleUpdateResult, DocumentBundle, EditableDocument, ImportJob } from '../api-types';
import { request } from '../client';
import { resolveEditFolder } from '../edit-folder';
import { summariseJob, waitForJob } from '../import-jobs';
import { print, writeJsonFile } from '../output';
import { isHttpUrl } from '../patterns';

type ImportOptions = {
  crawl?: boolean;
  id?: string;
  tocDepth?: string;
  wait: boolean;
};

const CHAPTERS_FOLDER = 'chapters';

const startUrlImport = (url: string, options: ImportOptions): Promise<ImportJob> =>
  request<ImportJob>('/api/import', {
    json: {
      id: options.id,
      tocDepth: options.tocDepth ? Number(options.tocDepth) : undefined,
      url,
    },
    method: 'POST',
  });

const startFileImport = async (file: string, options: ImportOptions): Promise<ImportJob> => {
  const data = await readFile(file);
  const form = new FormData();

  form.append('file', new Blob([new Uint8Array(data)]), path.basename(file));
  if (options.id) form.append('id', options.id);
  if (options.tocDepth) form.append('tocDepth', String(options.tocDepth));

  return request<ImportJob>('/api/import', { body: form, method: 'POST' });
};

const importSource = async (source: string, options: ImportOptions): Promise<void> => {
  if (options.crawl) {
    throw new Error(
      'Documentation-site crawling is planned for v0.2. Import pages one URL at a time for now.'
    );
  }

  const job = isHttpUrl(source)
    ? await startUrlImport(source, options)
    : await startFileImport(source, options);

  if (!options.wait) return print(job);
  print(summariseJob(await waitForJob(job.id)));
};

export const registerImport = (program: Command): void => {
  program
    .command('import <source>')
    .description('Import an .epub/.mobi/.azw3/.html file or an http(s) URL')
    .option('--id <id>', 'document id (default: slug of the title)')
    .option('--toc-depth <n>', 'deepest TOC level used as chapter starts')
    .option('--crawl', 'crawl a documentation site (planned for v0.2)')
    .option('--no-wait', 'return the job instead of waiting')
    .action(importSource);
};

export const registerReimport = (program: Command): void => {
  program
    .command('reimport <doc>')
    .description('Re-run the import from the saved source (keeps ids; annotations re-anchor)')
    .action(async (doc: string) => {
      const job = await request<ImportJob>(`/api/documents/${doc}/reimport`, { method: 'POST' });

      print(summariseJob(await waitForJob(job.id)));
    });
};

export const registerJobs = (program: Command): void => {
  program
    .command('jobs')
    .description('Recent import jobs')
    .action(async () => print(await request<ImportJob[]>('/api/import/jobs')));
};

const emptyChapterFolder = async (target: string): Promise<void> => {
  const chaptersFolder = path.join(target, CHAPTERS_FOLDER);

  await mkdir(chaptersFolder, { recursive: true });

  for (const file of await readdir(chaptersFolder)) {
    await rm(path.join(chaptersFolder, file));
  }
};

const writeBundle = async (target: string, bundle: DocumentBundle): Promise<void> => {
  await writeJsonFile(path.join(target, 'document.json'), bundle.document);
  await writeJsonFile(path.join(target, 'import-report.json'), bundle.report);
  await writeFile(path.join(target, 'assets.txt'), `${bundle.assets.join('\n')}\n`);

  for (const [file, content] of Object.entries(bundle.files)) {
    await writeFile(path.join(target, file), content);
  }
};

export const registerPull = (program: Command): void => {
  program
    .command('pull <doc> [dir]')
    .description('Download document.json + chapter files for editing (default: _temp/edit/<doc>)')
    .action(async (doc: string, dir: string | undefined) => {
      const target = resolveEditFolder(doc, dir);
      const bundle = await request<DocumentBundle>(`/api/documents/${doc}/bundle`);

      await emptyChapterFolder(target);
      await writeBundle(target, bundle);
      print({ chapters: Object.keys(bundle.files).length, dir: target });
    });
};

const readChapterFiles = async (
  source: string,
  document: EditableDocument
): Promise<Record<string, string>> => {
  const files: Record<string, string> = {};

  for (const chapter of document.chapters) {
    files[chapter.file] = await readFile(path.join(source, chapter.file), 'utf8');
  }

  return files;
};

export const registerPush = (program: Command): void => {
  program
    .command('push <doc> [dir]')
    .description('Upload an edited document folder (from `lib pull`); validates, re-indexes')
    .action(async (doc: string, dir: string | undefined) => {
      const source = resolveEditFolder(doc, dir);
      const documentJson = await readFile(path.join(source, 'document.json'), 'utf8');
      const document = JSON.parse(documentJson) as EditableDocument;
      const files = await readChapterFiles(source, document);

      print(
        await request<BundleUpdateResult>(`/api/documents/${doc}/bundle`, {
          json: { document, files },
          method: 'PUT',
        })
      );
    });
};
