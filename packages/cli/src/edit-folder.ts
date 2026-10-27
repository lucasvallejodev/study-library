import { existsSync } from 'node:fs';
import path from 'node:path';

const WORKSPACE_MARKER = 'pnpm-workspace.yaml';
const EDIT_FOLDER = '_temp/edit';

const findRepoRoot = (): string => {
  let dir = process.cwd();

  while (!existsSync(path.join(dir, WORKSPACE_MARKER))) {
    const parent = path.dirname(dir);

    if (parent === dir) return process.cwd();
    dir = parent;
  }

  return dir;
};

export const resolveEditFolder = (doc: string, dir: string | undefined): string =>
  path.resolve(dir ?? path.join(findRepoRoot(), EDIT_FOLDER, doc));
