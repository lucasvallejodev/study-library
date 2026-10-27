import 'server-only';

const FLAG_ON = '1';

/**
 * Reads the query string of a request.
 *
 * @param request - The incoming request.
 * @returns Its URL search parameters.
 */
export const searchParamsOf = (request: Request): URLSearchParams =>
  new URL(request.url).searchParams;

/**
 * Reads an optional query parameter.
 *
 * @param params - The request's search parameters.
 * @param name - Parameter name.
 * @returns The value, or `undefined` when the parameter is absent.
 */
export const optionalParam = (params: URLSearchParams, name: string): string | undefined =>
  params.get(name) ?? undefined;

/**
 * Reads an optional numeric query parameter.
 *
 * @param params - The request's search parameters.
 * @param name - Parameter name.
 * @returns The value as a number, or `undefined` when the parameter is absent or empty.
 */
export const optionalNumberParam = (params: URLSearchParams, name: string): number | undefined => {
  const value = params.get(name);

  return value ? Number(value) : undefined;
};

/**
 * Tells whether a boolean query flag is switched on.
 *
 * @param params - The request's search parameters.
 * @param name - Parameter name.
 * @returns True only when the parameter equals `1`.
 */
export const isFlagSet = (params: URLSearchParams, name: string): boolean =>
  params.get(name) === FLAG_ON;

/**
 * Reads an optional JSON body, treating a missing or malformed body as an empty object.
 *
 * @param request - The incoming request.
 * @returns The parsed body, typed by the caller.
 */
export const readOptionalJson = async <Body extends object>(
  request: Request
): Promise<Partial<Body>> => (await request.json().catch(() => ({}))) as Partial<Body>;
