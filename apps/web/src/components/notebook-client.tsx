'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { copyText } from '@/components/annotations';
import { postJson } from '@/components/http';

import { DeleteAnnotationConfirmation } from './dialogs/confirmations';
import { useDialogs } from './dialogs/dialog-provider';
import { NoteTextEditor } from './notes/note-text-editor';

type ExportedDocument = {
  count: number;
  id: string;
};

const COPIED_RESET_MS = 1500;
const FREE_NOTE_ROWS = 3;

export function FreeNoteForm() {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [open, setOpen] = useState(false);

  async function save() {
    if (!body.trim()) return;
    await postJson('/api/annotations', { body: body.trim(), type: 'note' });
    setBody('');
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <div className="mt-4 flex gap-4 text-sm">
        <button onClick={() => setOpen(true)} className="text-accent hover:underline">
          + New free-floating note
        </button>
        <ExportAll />
      </div>
    );
  }

  return (
    <div className="mt-4">
      <NoteTextEditor
        autoFocus
        value={body}
        onChange={setBody}
        onSubmit={() => void save()}
        onCancel={() => setOpen(false)}
        minRows={FREE_NOTE_ROWS}
        placeholder="A thought that isn't tied to a passage… Markdown works. ⌘↵ to save"
      />
      <div className="mt-2 flex gap-2 text-sm">
        <button onClick={save} className="rounded bg-accent px-3 py-1 text-white">
          Save
        </button>
        <button onClick={() => setOpen(false)} className="rounded px-3 py-1 text-muted">
          Cancel
        </button>
      </div>
    </div>
  );
}

function totalExported(documents: ExportedDocument[]): number {
  return documents.reduce((total, exported) => total + exported.count, 0);
}

function ExportAll() {
  const [message, setMessage] = useState<string>();

  async function run() {
    const response = await postJson('/api/export', {});
    const exported = (await response.json()) as ExportedDocument[];

    setMessage(
      response.ok
        ? `Exported ${totalExported(exported)} annotations to each document folder`
        : 'Export failed'
    );
  }

  return (
    <>
      <button onClick={run} className="text-muted hover:text-ink">
        Back up all annotations
      </button>
      {message && <span className="text-muted">{message}</span>}
    </>
  );
}

export function NotebookItemActions({ href, id }: { href?: string; id: string }) {
  const router = useRouter();
  const dialogs = useDialogs();
  const [copied, setCopied] = useState(false);

  async function copyLink(path: string) {
    await copyText(`${location.origin}${path}`);
    setCopied(true);
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  async function remove() {
    if (!(await dialogs.confirm(DeleteAnnotationConfirmation))) return;
    await fetch(`/api/annotations/${id}`, { method: 'DELETE' });
    router.refresh();
  }

  return (
    <span className="ml-auto flex gap-3 text-muted">
      {href && (
        <button onClick={() => copyLink(href)} className="hover:text-ink">
          {copied ? 'Copied' : 'Copy link'}
        </button>
      )}
      <button onClick={remove} className="hover:text-red-600">
        Delete
      </button>
    </span>
  );
}
