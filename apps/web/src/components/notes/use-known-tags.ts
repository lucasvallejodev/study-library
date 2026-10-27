'use client';

import { useEffect, useState } from 'react';

type TagUsage = {
  count: number;
  tag: string;
};

let knownTagsRequest: Promise<string[]> | undefined;

async function fetchKnownTags(): Promise<string[]> {
  const response = await fetch('/api/tags');

  if (!response.ok) return [];
  const usage = (await response.json()) as TagUsage[];

  return usage.map(entry => entry.tag);
}

function loadKnownTags(): Promise<string[]> {
  knownTagsRequest ??= fetchKnownTags().catch(() => []);

  return knownTagsRequest;
}

export function forgetKnownTags(): void {
  knownTagsRequest = undefined;
}

export function useKnownTags(): string[] {
  const [tags, setTags] = useState<string[]>([]);

  useEffect(() => {
    let current = true;

    void loadKnownTags().then(loaded => {
      if (current) setTags(loaded);
    });

    return () => {
      current = false;
    };
  }, []);

  return tags;
}
