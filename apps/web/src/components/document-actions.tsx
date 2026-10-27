'use client';

import { useState } from 'react';

export function DocumentActions({ docId }: { docId: string }) {
  const [message, setMessage] = useState<string>();

  async function reimport() {
    if (!confirm('Re-import from the saved source? Chapter ids are kept when titles match.')) {
      return;
    }

    const res = await fetch(`/api/documents/${docId}/reimport`, { method: 'POST' });

    setMessage(res.ok ? 'Re-import queued — see the Import page.' : (await res.json()).error);
  }

  async function copyStudy() {
    await navigator.clipboard.writeText(`/study ${docId}`);
    setMessage('Copied: paste it into Claude Code.');
  }

  return (
    <div className="mt-6 space-y-1 text-sm">
      <button onClick={copyStudy} className="block text-accent hover:underline">
        Copy /study prompt
      </button>
      <a href={`/notebook?doc=${docId}`} className="block text-accent hover:underline">
        Notes for this document
      </a>
      <a href={`/api/export?doc=${docId}&format=md`} className="block text-accent hover:underline">
        Export annotations (Markdown)
      </a>
      <button onClick={reimport} className="block text-muted hover:text-ink">
        Re-import
      </button>
      {message && <p className="pt-2 text-xs text-muted">{message}</p>}
    </div>
  );
}
