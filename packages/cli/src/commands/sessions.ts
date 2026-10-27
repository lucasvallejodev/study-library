import type { Command } from 'commander';
import { readFile } from 'node:fs/promises';

import type { JsonValue, StudySessionFile } from '../api-types';
import { request } from '../client';
import { print, toSearchParams } from '../output';

type RecordSessionOptions = {
  file: string;
  kind: string;
};

type SessionsOptions = {
  chapter?: string;
  since?: string;
};

const STDIN_FILE = '-';

const readStdin = async (): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);

  return Buffer.concat(chunks).toString('utf8');
};

const readSessionFile = async (file: string): Promise<StudySessionFile> => {
  const raw = file === STDIN_FILE ? await readStdin() : await readFile(file, 'utf8');

  return JSON.parse(raw) as StudySessionFile;
};

export const registerRecordSession = (program: Command): void => {
  program
    .command('record-session <doc> [chapter]')
    .description(
      'Save a study session (JSON: {questions:[{question,answer,feedback,correct,quote}], score, summary, followUps})'
    )
    .requiredOption('-f, --file <path>', 'session JSON file, or - for stdin')
    .option('-k, --kind <kind>', 'study | review', 'study')
    .action(async (doc: string, chapter: string | undefined, options: RecordSessionOptions) => {
      const session = await readSessionFile(options.file);

      print(
        await request<JsonValue>('/api/sessions', {
          json: {
            kind: options.kind,
            ...session,
            chapterId: chapter ?? session.chapterId ?? null,
            documentId: doc,
          },
          method: 'POST',
        })
      );
    });
};

export const registerSessions = (program: Command): void => {
  program
    .command('sessions [doc]')
    .description('List past study sessions')
    .option('-c, --chapter <id>')
    .option('-s, --since <age>')
    .action(async (doc: string | undefined, options: SessionsOptions) => {
      const params = toSearchParams([
        ['doc', doc],
        ['chapter', options.chapter],
        ['since', options.since],
      ]);

      print(await request<JsonValue>(`/api/sessions?${params}`));
    });
};
