import type { Command } from 'commander';

import type { HealthStatus, JsonValue } from '../api-types';
import { API_URL, request } from '../client';
import { print } from '../output';

type RemoveOptions = { force?: boolean };

const documentScope = (doc: string | undefined): { doc?: string } => (doc ? { doc } : {});

export const registerExport = (program: Command): void => {
  program
    .command('export [doc]')
    .description('Write annotations.json + annotations.md into each document folder (backup)')
    .action(async (doc: string | undefined) =>
      print(await request<JsonValue>('/api/export', { json: documentScope(doc), method: 'POST' }))
    );
};

export const registerReindex = (program: Command): void => {
  program
    .command('reindex [doc]')
    .description('Rebuild the database index from library/ (annotations are untouched)')
    .action(async (doc: string | undefined) =>
      print(await request<JsonValue>('/api/reindex', { json: documentScope(doc), method: 'POST' }))
    );
};

export const registerRemove = (program: Command): void => {
  program
    .command('remove <doc>')
    .description('Delete a document (refuses if it has annotations unless --force)')
    .option('--force')
    .action(async (doc: string, options: RemoveOptions) => {
      const forceQuery = options.force ? '?force=1' : '';

      print(await request<JsonValue>(`/api/documents/${doc}${forceQuery}`, { method: 'DELETE' }));
    });
};

export const registerHealth = (program: Command): void => {
  program
    .command('health')
    .description('Check the server and database')
    .action(async () =>
      print({ server: API_URL, ...(await request<HealthStatus>('/api/health')) })
    );
};
