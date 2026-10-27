import type { Annotation, NewAnnotation } from '@study/core';

type ErrorBody = { error?: string };

async function readJsonOrEmpty(response: Response): Promise<unknown> {
  return response.json().catch(() => ({}));
}

async function call<Result>(path: string, method: string, body?: unknown): Promise<Result> {
  const response = await fetch(path, {
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    method,
  });

  const data = await readJsonOrEmpty(response);

  if (!response.ok) {
    throw new Error((data as ErrorBody).error ?? `Request failed (${response.status})`);
  }

  return data as Result;
}

export const AnnotationApi = {
  create: (input: Partial<NewAnnotation>) => call<Annotation>('/api/annotations', 'POST', input),
  remove: (id: string) => call<{ deleted: string }>(`/api/annotations/${id}`, 'DELETE'),
  update: (id: string, patch: Partial<Annotation>) =>
    call<Annotation>(`/api/annotations/${id}`, 'PATCH', patch),
};
