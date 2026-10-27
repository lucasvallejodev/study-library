'use client';

import { useCallback, useState } from 'react';

import type { Annotation } from '@study/core';

export type AnnotationList = {
  add: (annotation: Annotation) => void;
  annotations: Annotation[];
  remove: (id: string) => void;
  replace: (annotation: Annotation) => void;
};

export function useAnnotationList(initialAnnotations: Annotation[]): AnnotationList {
  const [annotations, setAnnotations] = useState(initialAnnotations);

  const add = useCallback((annotation: Annotation) => {
    setAnnotations(list => [...list, annotation]);
  }, []);

  const replace = useCallback((updated: Annotation) => {
    setAnnotations(list =>
      list.map(annotation => (annotation.id === updated.id ? updated : annotation))
    );
  }, []);

  const remove = useCallback((id: string) => {
    setAnnotations(list => list.filter(annotation => annotation.id !== id));
  }, []);

  return {
    add,
    annotations,
    remove,
    replace,
  };
}
