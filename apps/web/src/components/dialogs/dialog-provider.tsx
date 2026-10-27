'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { AppDialog, type DialogRequest } from './app-dialog';

export type DialogTone = 'danger' | 'default';

export type ConfirmOptions = {
  cancelLabel?: string;
  confirmLabel?: string;
  message?: string;
  title: string;
  tone?: DialogTone;
};

export type PromptOptions = ConfirmOptions & {
  defaultValue?: string;
  inputLabel: string;
  inputType?: 'text' | 'url';
  placeholder?: string;
};

export type Dialogs = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<Dialogs | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest>();

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>(resolve => {
        setRequest({
          kind: 'confirm',
          options,
          resolve: answer => resolve(answer !== null),
        });
      }),
    []
  );

  const prompt = useCallback(
    (options: PromptOptions) =>
      new Promise<string | null>(resolve => {
        setRequest({
          kind: 'prompt',
          options,
          resolve,
        });
      }),
    []
  );

  const dialogs = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  function settle(answer: string | null) {
    request?.resolve(answer);
    setRequest(undefined);
  }

  return (
    <DialogContext value={dialogs}>
      {children}
      {request && <AppDialog request={request} onSettle={settle} />}
    </DialogContext>
  );
}

export function useDialogs(): Dialogs {
  const dialogs = useContext(DialogContext);

  if (!dialogs) throw new Error('useDialogs must be used inside <DialogProvider>');

  return dialogs;
}
