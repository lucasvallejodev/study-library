'use client';

import { useState } from 'react';

import { ReimportConfirmation } from '@/components/dialogs/confirmations';
import { useDialogs } from '@/components/dialogs/dialog-provider';
import { errorMessageOf } from '@/components/http';

const LINK_CLASS = 'block text-accent hover:underline';

export function DocumentActions({ docId }: { docId: string }) {
  const [message, setMessage] = useState<string>();
  const dialogs = useDialogs();

  async function reimport() {
    if (!(await dialogs.confirm(ReimportConfirmation))) return;

    const response = await fetch(`/api/documents/${docId}/reimport`, { method: 'POST' });

    setMessage(
      response.ok ? 'Re-import queued — see the Import page.' : await errorMessageOf(response)
    );
  }

  async function copyStudy() {
    await navigator.clipboard.writeText(`/study ${docId}`);
    setMessage('Copied: paste it into your AI agent.');
  }

  return (
    <div className="mt-6 space-y-1 text-sm">
      <button onClick={copyStudy} className={LINK_CLASS}>
        Copy /study prompt
      </button>
      <a href={`/notebook?doc=${docId}`} className={LINK_CLASS}>
        Notes for this document
      </a>
      <a href={`/api/export?doc=${docId}&format=md`} className={LINK_CLASS}>
        Export annotations (Markdown)
      </a>
      <button onClick={reimport} className="block text-muted hover:text-ink">
        Re-import
      </button>
      {message && <p className="pt-2 text-xs text-muted">{message}</p>}
    </div>
  );
}
