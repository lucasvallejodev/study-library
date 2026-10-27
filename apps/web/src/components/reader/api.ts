import type { Annotation, NewAnnotation } from "@study/core";

async function call<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed (${res.status})`);
  return data as T;
}

export const api = {
  create: (input: Partial<NewAnnotation>) => call<Annotation>("/api/annotations", "POST", input),
  update: (id: string, patch: Partial<Annotation>) => call<Annotation>(`/api/annotations/${id}`, "PATCH", patch),
  remove: (id: string) => call<{ deleted: string }>(`/api/annotations/${id}`, "DELETE"),
};
