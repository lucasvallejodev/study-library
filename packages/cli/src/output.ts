import { writeFile } from 'node:fs/promises';

const JSON_INDENT = 2;

export const toPrettyJson = (value: unknown): string => JSON.stringify(value, null, JSON_INDENT);

export const print = (value: unknown): void =>
  console.log(typeof value === 'string' ? value : toPrettyJson(value));

export const writeJsonFile = (file: string, value: unknown): Promise<void> =>
  writeFile(file, `${toPrettyJson(value)}\n`);

export const parseTagList = (tags: string): string[] =>
  tags
    .split(',')
    .map(tag => tag.trim())
    .filter(Boolean);

export const toSearchParams = (
  entries: [name: string, value: string | undefined][]
): URLSearchParams => {
  const params = new URLSearchParams();

  for (const [name, value] of entries) {
    if (value) params.set(name, value);
  }

  return params;
};
