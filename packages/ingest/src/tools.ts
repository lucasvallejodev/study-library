import { spawn } from 'node:child_process';

export class MissingToolError extends Error {}

export type RunResult = {
  code: number;
  stderr: string;
  stdout: string;
};

/**
 *
 * @param cmd
 * @param args
 * @param input
 * @param timeoutMs
 */
export const run = (
  cmd: string,
  args: string[],
  input?: string | Buffer,
  timeoutMs = 120_000
): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);

    child.stdout.on('data', d => out.push(d));
    child.stderr.on('data', d => err.push(d));
    child.on('error', (e: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        e.code === 'ENOENT' ? new MissingToolError(`\`${cmd}\` is not installed or not on PATH`) : e
      );
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stderr: Buffer.concat(err).toString('utf8'),
        stdout: Buffer.concat(out).toString('utf8'),
      });
    });
    child.stdin.end(input ?? '');
  });

/**
 * HTML fragment -> GitHub-flavoured Markdown, footnotes enabled, raw HTML kept for complex tables.
 *
 * @param html
 */
export const pandocHtmlToMarkdown = async (html: string): Promise<string> => {
  const res = await run('pandoc', ['-f', 'html', '-t', 'gfm+footnotes', '--wrap=none'], html);

  if (res.code !== 0) throw new Error(`pandoc failed: ${res.stderr.trim()}`);

  return res.stdout;
};

/**
 * Run async work over items with a fixed concurrency, keeping order.
 *
 * @param items
 * @param limit
 * @param fn
 */
export const mapLimit = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;

  const worker = async () => {
    while (next < items.length) {
      const i = next++;

      results[i] = await fn(items[i], i);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
};
