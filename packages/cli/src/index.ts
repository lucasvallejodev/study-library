#!/usr/bin/env -S npx tsx
import { Command } from 'commander';

import { API_URL, ApiError } from './client';
import { registerExport, registerHealth, registerReindex, registerRemove } from './commands/admin';
import {
  registerAddNote,
  registerAnnotations,
  registerDeleteNote,
  registerEditNote,
} from './commands/annotations';
import { registerAssets } from './commands/assets';
import {
  registerImport,
  registerJobs,
  registerPull,
  registerPush,
  registerReimport,
} from './commands/imports';
import {
  registerChapter,
  registerList,
  registerReport,
  registerSearch,
  registerShow,
} from './commands/library';
import { registerRecordSession, registerSessions } from './commands/sessions';

const CommandsInHelpOrder = [
  registerList,
  registerShow,
  registerChapter,
  registerAssets,
  registerAnnotations,
  registerAddNote,
  registerEditNote,
  registerDeleteNote,
  registerRecordSession,
  registerSessions,
  registerImport,
  registerReimport,
  registerJobs,
  registerReport,
  registerPull,
  registerPush,
  registerSearch,
  registerExport,
  registerReindex,
  registerRemove,
  registerHealth,
];

const program = new Command('lib')
  .description(`Study Library CLI (server: ${API_URL})`)
  .showHelpAfterError();

for (const register of CommandsInHelpOrder) register(program);

const statusPrefix = (error: Error): string =>
  error instanceof ApiError && error.status ? `(${error.status}) ` : '';

program.parseAsync().catch((error: Error) => {
  console.error(`error: ${statusPrefix(error)}${error.message}`);
  process.exit(1);
});
