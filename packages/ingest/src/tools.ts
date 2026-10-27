import { spawn } from 'node:child_process';

const DEFAULT_TIMEOUT_MS = 120_000;

const MISSING_COMMAND_CODE = 'ENOENT';

const PandocHtmlToGfmArguments = ['-f', 'html', '-t', 'gfm+footnotes', '--wrap=none'];

/** Thrown when an external command (Pandoc, Calibre's `ebook-convert`) is not installed. */
export class MissingToolError extends Error {}

/** Exit code and captured output of an external command. */
export type RunResult = {
  code: number;
  stderr: string;
  stdout: string;
};

/**
 * Runs an external command, feeding it `input` on stdin and capturing its output.
 *
 * @remarks
 * The process is killed with `SIGKILL` once the timeout elapses; the result then has code -1.
 *
 * @param command - Executable name, looked up on PATH.
 * @param args - Command-line arguments.
 * @param input - Text or bytes written to stdin (nothing when omitted).
 * @param timeoutMs - Milliseconds before the process is killed.
 * @returns The exit code with stdout and stderr decoded as UTF-8.
 * @throws {@link MissingToolError} when the command is not installed or not on PATH.
 */
export const run = (
  command: string,
  args: string[],
  input?: string | Buffer,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<RunResult> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => stdoutChunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      reject(
        error.code === MISSING_COMMAND_CODE
          ? new MissingToolError(`\`${command}\` is not installed or not on PATH`)
          : error
      );
    });
    child.on('close', code => {
      clearTimeout(timer);
      resolve({
        code: code ?? -1,
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
      });
    });
    child.stdin.end(input ?? '');
  });

/**
 * Converts an HTML fragment to GitHub-flavoured Markdown with Pandoc.
 *
 * @remarks
 * Footnotes are enabled, lines are not wrapped, and raw HTML is kept for tables Markdown
 * cannot express.
 *
 * @param html - HTML fragment to convert.
 * @returns The Markdown produced by Pandoc.
 * @throws {@link MissingToolError} when `pandoc` is not installed; an `Error` when Pandoc fails.
 */
export const pandocHtmlToMarkdown = async (html: string): Promise<string> => {
  const result = await run('pandoc', PandocHtmlToGfmArguments, html);

  if (result.code !== 0) throw new Error(`pandoc failed: ${result.stderr.trim()}`);

  return result.stdout;
};

/**
 * Runs async work over items with a fixed concurrency, keeping the results in input order.
 *
 * @param items - Items to process.
 * @param limit - Maximum number of tasks running at once.
 * @param task - Work for one item, given the item and its index.
 * @returns The results, one per item, in the order of `items`.
 */
export const mapLimit = async <Item, Result>(
  items: Item[],
  limit: number,
  task: (item: Item, index: number) => Promise<Result>
): Promise<Result[]> => {
  const results = new Array<Result>(items.length);
  let next = 0;

  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++;

      results[index] = await task(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));

  return results;
};
