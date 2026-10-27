import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 *
 * @param what
 */
export const notFound = (what: string): never => {
  throw new HttpError(404, `${what} not found`);
};

/**
 * Wrap a route handler: JSON errors with useful messages for the CLI and the UI.
 *
 * @param handler
 */
export const route =
  <A extends unknown[]>(handler: (...args: A) => Promise<Response>) =>
  async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }

      if (e instanceof ZodError) {
        return NextResponse.json({ error: 'Invalid request', issues: e.issues }, { status: 400 });
      }

      if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }

      console.error(e);

      return NextResponse.json(
        { error: (e as Error).message ?? 'Internal error' },
        { status: 500 }
      );
    }
  };

/**
 * Parse "7d", "12h", "30m" or an ISO date into a Date.
 *
 * @param value
 */
export const parseSince = (value: string | null): Date | undefined => {
  if (!value) return undefined;
  const m = /^(\d+)([dhm])$/.exec(value);

  if (m) {
    const ms = {
      d: 86_400_000,
      h: 3_600_000,
      m: 60_000,
    }[m[2] as 'd' | 'h' | 'm'];

    return new Date(Date.now() - Number(m[1]) * ms);
  }

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) throw new HttpError(400, `Invalid since: ${value}`);

  return d;
};
