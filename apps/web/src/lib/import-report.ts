import 'server-only';

import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

import { type ImportReport, resolveInDocument } from '@study/core';

const IMPORT_REPORT_FILE = 'import-report.json';

/**
 * Reads the `import-report.json` an importer left in a document folder.
 *
 * @remarks
 * The file is returned as written, without validation.
 *
 * @param docId - Document slug.
 * @returns The report, or `null` when the document has none.
 */
export const readImportReport = async (docId: string): Promise<ImportReport | null> => {
  const reportPath = resolveInDocument(docId, IMPORT_REPORT_FILE);

  if (!existsSync(reportPath)) return null;

  return JSON.parse(await readFile(reportPath, 'utf8')) as ImportReport;
};
