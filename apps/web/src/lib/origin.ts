import 'server-only';

/**
 * Origin to print in links: PUBLIC_URL if set, else the request's host header.
 *
 * @param req
 */
export const publicOrigin = (req: Request): string => {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const proto = req.headers.get('x-forwarded-proto') ?? 'http';

  return host ? `${proto}://${host}` : new URL(req.url).origin;
};
