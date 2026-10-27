import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

import { Patterns } from './patterns';

/** HTTP status codes the API answers with. */
export const HttpStatus = {
  accepted: 202,
  badRequest: 400,
  conflict: 409,
  created: 201,
  internalError: 500,
  notFound: 404,
  unprocessableContent: 422,
};

/** An error that {@link route} turns into a JSON response with the given status. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

/**
 * Throws a 404 {@link HttpError} for a missing resource.
 *
 * @param what - Name of the missing resource, e.g. `Document alice`.
 * @throws {@link HttpError} 404 with the message `<what> not found`.
 */
export const notFound: (what: string) => never = what => {
  throw new HttpError(HttpStatus.notFound, `${what} not found`);
};

/**
 * Throws a 400 {@link HttpError} for an invalid request.
 *
 * @param message - Explanation shown to the caller.
 * @throws {@link HttpError} 400 with the given message.
 */
export const badRequest: (message: string) => never = message => {
  throw new HttpError(HttpStatus.badRequest, message);
};

const isMissingFileError = (error: unknown): boolean =>
  (error as NodeJS.ErrnoException).code === 'ENOENT';

const errorResponse = (error: unknown): Response => {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Invalid request', issues: error.issues },
      { status: HttpStatus.badRequest }
    );
  }

  if (isMissingFileError(error)) {
    return NextResponse.json({ error: 'Not found' }, { status: HttpStatus.notFound });
  }

  console.error(error);

  return NextResponse.json(
    { error: (error as Error).message ?? 'Internal error' },
    { status: HttpStatus.internalError }
  );
};

/**
 * Wraps a route handler so every failure becomes a JSON error useful to the CLI and the UI.
 *
 * @remarks
 * {@link HttpError} keeps its status, a `ZodError` becomes 400 with its issues, a missing file
 * (`ENOENT`) becomes 404 and anything else is logged and answered with 500.
 *
 * @param handler - The route handler to wrap.
 * @returns A handler with the same arguments that never rejects.
 */
export const route =
  <A extends unknown[]>(
    handler: (...args: A) => Promise<Response>
  ): ((...args: A) => Promise<Response>) =>
  async (...args: A): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };

const MillisecondsPerUnit = {
  d: 86_400_000,
  h: 3_600_000,
  m: 60_000,
};

type DurationUnit = keyof typeof MillisecondsPerUnit;

const parseRelativeDuration = (value: string): Date | undefined => {
  const match = Patterns.relativeDuration.exec(value);

  if (!match) return undefined;

  const unitMilliseconds = MillisecondsPerUnit[match[2] as DurationUnit];

  return new Date(Date.now() - Number(match[1]) * unitMilliseconds);
};

/**
 * Parses a `since` filter into a date.
 *
 * @param value - A relative duration (`7d`, `12h`, `30m`) or an ISO date; empty means no filter.
 * @returns The point in time, or `undefined` when no value was given.
 * @throws {@link HttpError} 400 when the value is neither a duration nor a valid date.
 */
export const parseSince = (value: string | null): Date | undefined => {
  if (!value) return undefined;

  const relative = parseRelativeDuration(value);

  if (relative) return relative;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) badRequest(`Invalid since: ${value}`);

  return date;
};
