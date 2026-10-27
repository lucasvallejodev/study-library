import { Patterns } from './patterns';

type RequestOptions = RequestInit & { json?: unknown };

const DEFAULT_API_URL = 'http://localhost:3000';
const UNREACHABLE_STATUS = 0;
const JsonContentType = { 'content-type': 'application/json' };

export const API_URL = (process.env.LIB_API_URL ?? DEFAULT_API_URL).replace(
  Patterns.trailingSlash,
  ''
);

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
  }
}

const toFetchInit = ({ json, ...init }: RequestOptions): RequestInit => {
  if (json === undefined) return init;

  return {
    ...init,
    body: JSON.stringify(json),
    headers: { ...JsonContentType, ...init.headers },
  };
};

const fetchFromServer = async (path: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(`${API_URL}${path}`, init);
  } catch (error) {
    throw new ApiError(
      UNREACHABLE_STATUS,
      `Cannot reach the Study Library server at ${API_URL} (${(error as Error).message}). Start it with \`pnpm dev\` or set LIB_API_URL.`
    );
  }
};

const readBody = async (response: Response): Promise<unknown> => {
  const contentType = response.headers.get('content-type') ?? '';

  if (contentType.includes('json')) return (await response.json()) as unknown;

  return response.text();
};

const errorMessage = (body: unknown): string => {
  if (typeof body === 'object' && body !== null && 'error' in body) return String(body.error);

  return String(body);
};

export const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await fetchFromServer(path, toFetchInit(options));
  const body = await readBody(response);

  if (!response.ok) throw new ApiError(response.status, errorMessage(body));

  return body as T;
};
