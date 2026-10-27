'use client';

import type { Annotation } from '@study/core';

import { annotationPath, studyPrompt } from '../annotations';
import { AnnotationCard } from './annotation-card';
import type { Notify } from './use-toast';

export type CardControls = {
  activeId?: string;
  chapterId: string;
  clearActive: () => void;
  docId: string;
  editingId?: string;
  notify: Notify;
  pulseAnnotation: (id: string) => void;
  remove: (id: string) => void;
  replace: (annotation: Annotation) => void;
  setActiveId: (id: string | undefined) => void;
  setEditingId: (id: string | undefined) => void;
};

type ReaderCardProps = {
  annotation: Annotation;
  compact?: boolean;
  controls: CardControls;
};

function sharedCardProps({ annotation, controls }: ReaderCardProps) {
  const { activeId, chapterId, docId, editingId } = controls;

  return {
    active: annotation.id === activeId,
    annotation,
    editing: annotation.id === editingId,
    link: annotationPath(docId, chapterId, annotation.id),
    notify: controls.notify,
    onChange: controls.replace,
    onDelete: () => controls.remove(annotation.id),
    studyPrompt: studyPrompt(docId, chapterId, annotation.id),
  };
}

export function PlacedAnnotationCard(props: ReaderCardProps) {
  const { annotation, compact, controls } = props;

  function onEdit(editing: boolean) {
    controls.setEditingId(editing ? annotation.id : undefined);
    if (!editing) controls.clearActive();
  }

  return (
    <AnnotationCard
      {...sharedCardProps(props)}
      compact={compact}
      onEdit={onEdit}
      onFocus={() => controls.pulseAnnotation(annotation.id)}
    />
  );
}

export function OrphanedAnnotationCard(props: ReaderCardProps) {
  const { annotation, controls } = props;

  return (
    <AnnotationCard
      {...sharedCardProps(props)}
      onEdit={editing => controls.setEditingId(editing ? annotation.id : undefined)}
      onFocus={() => controls.setActiveId(annotation.id)}
    />
  );
}
