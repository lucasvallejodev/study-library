import type { Command } from 'commander';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { chapterImages } from '../chapter-images';
import { download, request } from '../client';
import { resolveAssetsFolder } from '../edit-folder';
import { print } from '../output';

type SavedImage = {
  alt: string;
  file: string;
  line: number;
};

export const registerAssets = (program: Command): void => {
  program
    .command('assets <doc> <chapter> [dir]')
    .description(
      "Download a chapter's images so an agent can look at them (default: _temp/assets/<doc>/<chapter>)"
    )
    .action(async (doc: string, chapter: string, dir: string | undefined) => {
      const target = resolveAssetsFolder(doc, chapter, dir);
      const markdown = await request<string>(`/api/documents/${doc}/chapters/${chapter}?format=md`);
      const saved: SavedImage[] = [];

      await mkdir(target, { recursive: true });

      for (const image of chapterImages(markdown)) {
        const file = path.join(target, path.basename(image.asset));

        await writeFile(file, await download(`/api/assets/${doc}/${image.asset}`));
        saved.push({
          alt: image.alt,
          file,
          line: image.line,
        });
      }

      print({ dir: target, images: saved });
    });
};
