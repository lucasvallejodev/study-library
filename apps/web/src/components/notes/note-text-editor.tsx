'use client';

import { useStoredPreference } from '../use-stored-preference';
import { MarkdownEditor } from './markdown-editor';
import type { MarkdownSize } from './markdown-view';
import { RichTextEditor } from './rich-text-editor';

type EditorMode = 'markdown' | 'rich';

type NoteTextEditorProps = {
  autoFocus?: boolean;
  minRows?: number;
  onCancel?: () => void;
  onChange: (markdown: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  size?: MarkdownSize;
  value: string;
};

const EDITOR_MODE_KEY = 'noteEditorMode';

const EditorModeLabels: Record<EditorMode, string> = {
  markdown: 'Markdown',
  rich: 'Rich text',
};

function useEditorMode(): [EditorMode, (mode: EditorMode) => void] {
  const [stored, save] = useStoredPreference(EDITOR_MODE_KEY);
  const mode: EditorMode = stored === 'markdown' ? 'markdown' : 'rich';

  return [mode, save];
}

export function NoteTextEditor(props: NoteTextEditorProps) {
  const [mode, setMode] = useEditorMode();

  return (
    <div>
      <EditorModeSwitch mode={mode} onModeChange={setMode} />
      {mode === 'rich' ? (
        <div className="overflow-hidden rounded-lg border border-line bg-paper focus-within:border-accent">
          <RichTextEditor {...props} />
        </div>
      ) : (
        <MarkdownEditor {...props} />
      )}
    </div>
  );
}

type EditorModeSwitchProps = {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
};

function EditorModeSwitch({ mode, onModeChange }: EditorModeSwitchProps) {
  const modes = Object.keys(EditorModeLabels) as EditorMode[];

  return (
    <div
      className="mb-1 flex justify-end gap-0.5 font-sans text-xs"
      role="radiogroup"
      aria-label="Editor"
    >
      {modes.map(option => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={mode === option}
          onClick={() => onModeChange(option)}
          className={`rounded px-2 py-0.5 ${mode === option ? 'bg-panel text-ink' : 'text-muted hover:text-ink'}`}
        >
          {EditorModeLabels[option]}
        </button>
      ))}
    </div>
  );
}
