import type { ConfirmOptions, PromptOptions } from './dialog-provider';

export const DeleteAnnotationConfirmation: ConfirmOptions = {
  confirmLabel: 'Delete',
  message: 'The highlight and its note are removed for good. This can’t be undone.',
  title: 'Delete this annotation?',
  tone: 'danger',
};

export const ReimportConfirmation: ConfirmOptions = {
  confirmLabel: 'Re-import',
  message:
    'The chapters are rebuilt from the saved source file. Chapter ids are kept when titles match, so your highlights stay attached.',
  title: 'Re-import this document?',
};

export function linkPrompt(currentHref: string | undefined): PromptOptions {
  return {
    confirmLabel: currentHref ? 'Update link' : 'Add link',
    defaultValue: currentHref ?? 'https://',
    inputLabel: 'Link address',
    inputType: 'url',
    message: currentHref ? 'Leave the address empty to remove the link.' : undefined,
    placeholder: 'https://example.com',
    title: currentHref ? 'Edit link' : 'Add a link',
  };
}
