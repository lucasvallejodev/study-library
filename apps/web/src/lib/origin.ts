import 'server-only';

import { Patterns } from './patterns';

/**
 * Finds the origin to print in links handed to the CLI and AI tools.
 *
 * @param req - The incoming request, whose forwarded or plain host header is used.
 * @returns `PUBLIC_URL` without a trailing slash when set, else the origin the request came to.
 */
export const publicOrigin = (req: Request): string => {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(Patterns.trailingSlash, '');

  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';

  return host ? `${proto}://${host}` : new URL(req.url).origin;
};
