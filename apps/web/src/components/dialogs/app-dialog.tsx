'use client';

import { useEffect, useRef, useState } from 'react';

import type { ConfirmOptions, DialogTone, PromptOptions } from './dialog-provider';

export type DialogRequest =
  | { kind: 'confirm'; options: ConfirmOptions; resolve: (answer: string | null) => void }
  | { kind: 'prompt'; options: PromptOptions; resolve: (answer: string | null) => void };

type AppDialogProps = {
  onSettle: (answer: string | null) => void;
  request: DialogRequest;
};

const CONFIRMED = 'confirmed';
const INITIAL_FOCUS_ATTRIBUTE = 'data-initial-focus';

const ConfirmButtonClassNames: Record<DialogTone, string> = {
  danger: 'bg-red-600 text-white hover:bg-red-700',
  default: 'bg-accent text-white hover:opacity-90',
};

const DefaultConfirmLabels: Record<DialogRequest['kind'], string> = {
  confirm: 'Confirm',
  prompt: 'Save',
};

function useOpenAsModal() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) return;
    dialog.showModal();
    dialog.querySelector<HTMLElement>(`[${INITIAL_FOCUS_ATTRIBUTE}]`)?.focus();
  }, []);

  return dialogRef;
}

export function AppDialog({ onSettle, request }: AppDialogProps) {
  const { options } = request;
  const tone = options.tone ?? 'default';
  const isPrompt = request.kind === 'prompt';
  const [value, setValue] = useState(isPrompt ? (request.options.defaultValue ?? '') : '');
  const dialogRef = useOpenAsModal();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSettle(isPrompt ? value : CONFIRMED);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="app-dialog-title"
      onCancel={event => {
        event.preventDefault();
        onSettle(null);
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-line bg-paper p-0 text-ink shadow-2xl backdrop:bg-black/50"
    >
      <form onSubmit={submit} className="space-y-4 p-5 font-sans">
        <h2 id="app-dialog-title" className="text-lg font-semibold">
          {options.title}
        </h2>
        {options.message && <p className="text-sm text-muted">{options.message}</p>}
        {isPrompt && <PromptField options={request.options} value={value} onChange={setValue} />}
        <DialogActions
          cancelLabel={options.cancelLabel ?? 'Cancel'}
          confirmLabel={options.confirmLabel ?? DefaultConfirmLabels[request.kind]}
          focusConfirm={tone !== 'danger' && !isPrompt}
          focusCancel={tone === 'danger'}
          onCancel={() => onSettle(null)}
          tone={tone}
        />
      </form>
    </dialog>
  );
}

type DialogActionsProps = {
  cancelLabel: string;
  confirmLabel: string;
  focusCancel: boolean;
  focusConfirm: boolean;
  onCancel: () => void;
  tone: DialogTone;
};

function initialFocus(wanted: boolean): Record<string, boolean> {
  return wanted ? { [INITIAL_FOCUS_ATTRIBUTE]: true } : {};
}

function DialogActions(props: DialogActionsProps) {
  return (
    <div className="flex justify-end gap-2 pt-1 text-sm">
      <button
        type="button"
        onClick={props.onCancel}
        {...initialFocus(props.focusCancel)}
        className="rounded-md px-3 py-1.5 text-muted hover:bg-panel hover:text-ink"
      >
        {props.cancelLabel}
      </button>
      <button
        type="submit"
        {...initialFocus(props.focusConfirm)}
        className={`rounded-md px-3 py-1.5 ${ConfirmButtonClassNames[props.tone]}`}
      >
        {props.confirmLabel}
      </button>
    </div>
  );
}

type PromptFieldProps = {
  onChange: (value: string) => void;
  options: PromptOptions;
  value: string;
};

function PromptField({ onChange, options, value }: PromptFieldProps) {
  return (
    <label className="block space-y-1.5 text-sm">
      <span className="text-muted">{options.inputLabel}</span>
      <input
        data-initial-focus
        type={options.inputType ?? 'text'}
        value={value}
        onChange={event => onChange(event.target.value)}
        onFocus={event => event.target.select()}
        placeholder={options.placeholder}
        className="w-full rounded-md border border-line bg-panel px-3 py-2 outline-none focus:border-accent"
      />
    </label>
  );
}
