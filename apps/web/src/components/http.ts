type ErrorBody = { error?: string };

export async function errorMessageOf(response: Response): Promise<string | undefined> {
  const body = (await response.json()) as ErrorBody;

  return body.error;
}

export function postJson(path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}
