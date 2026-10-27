'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  type EditorState,
  insertCodeBlock,
  insertLink,
  toggleInline,
  toggleLinePrefix,
} from './markdown-formatting';
import { type MarkdownSize, MarkdownView } from './markdown-view';

type MarkdownEditorProps = {
  autoFocus?: boolean;
  minRows?: number;
  onCancel?: () => void;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  size?: MarkdownSize;
  value: string;
};

type EditorMode = 'preview' | 'write';

type Formatter = (state: EditorState) => EditorState;

type ToolbarAction = {
  className?: string;
  format: Formatter;
  label: string;
  title: string;
};

const DEFAULT_MIN_ROWS = 4;
const FocusWithoutScrolling = { preventScroll: true };

const ToolbarActions: ToolbarAction[] = [
  // keep order
  {
    className: 'font-bold',
    format: state => toggleInline(state, 'bold'),
    label: 'B',
    title: 'Bold (⌘B)',
  },
  {
    className: 'italic',
    format: state => toggleInline(state, 'italic'),
    label: 'I',
    title: 'Italic (⌘I)',
  },
  {
    className: 'line-through',
    format: state => toggleInline(state, 'strikethrough'),
    label: 'S',
    title: 'Strikethrough',
  },
  {
    className: 'font-mono',
    format: state => toggleInline(state, 'code'),
    label: '</>',
    title: 'Inline code (⌘E)',
  },
  {
    format: insertLink,
    label: 'Link',
    title: 'Link (⌘K)',
  },
  {
    className: 'font-semibold',
    format: state => toggleLinePrefix(state, 'heading'),
    label: 'H',
    title: 'Heading',
  },
  {
    format: state => toggleLinePrefix(state, 'quote'),
    label: '❝',
    title: 'Quote',
  },
  {
    format: state => toggleLinePrefix(state, 'bullet'),
    label: '•',
    title: 'Bulleted list',
  },
  {
    format: state => toggleLinePrefix(state, 'numbered'),
    label: '1.',
    title: 'Numbered list',
  },
  {
    format: state => toggleLinePrefix(state, 'task'),
    label: '☐',
    title: 'Checklist',
  },
  {
    className: 'font-mono',
    format: insertCodeBlock,
    label: '{ }',
    title: 'Code block',
  },
];

const ShortcutFormatters: Record<string, Formatter> = {
  b: state => toggleInline(state, 'bold'),
  e: state => toggleInline(state, 'code'),
  i: state => toggleInline(state, 'italic'),
  k: insertLink,
};

const EditorTextClassNames: Record<MarkdownSize, string> = {
  base: 'text-base',
  sm: 'text-sm',
};

type EditorTextarea = {
  applyFormat: (format: Formatter) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
};

function useEditorTextarea(
  value: string,
  onChange: (value: string) => void,
  autoFocus: boolean
): EditorTextarea {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<[number, number]>(undefined);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus(FocusWithoutScrolling);
  }, [autoFocus]);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;

    const selection = pendingSelectionRef.current;

    if (!selection) return;
    pendingSelectionRef.current = undefined;
    textarea.focus(FocusWithoutScrolling);
    textarea.setSelectionRange(...selection);
  }, [value]);

  function applyFormat(format: Formatter) {
    const textarea = textareaRef.current;

    if (!textarea) return;

    const next = format({
      selectionEnd: textarea.selectionEnd,
      selectionStart: textarea.selectionStart,
      text: value,
    });

    pendingSelectionRef.current = [next.selectionStart, next.selectionEnd];
    onChange(next.text);
  }

  return { applyFormat, textareaRef };
}

export function MarkdownEditor(props: MarkdownEditorProps) {
  const { onCancel, onChange, onSubmit, size = 'sm', value } = props;
  const [mode, setMode] = useState<EditorMode>('write');

  const { applyFormat, textareaRef } = useEditorTextarea(value, onChange, props.autoFocus ?? false);

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const withModifier = event.metaKey || event.ctrlKey;
    const shortcut = withModifier ? ShortcutFormatters[event.key.toLowerCase()] : undefined;

    if (withModifier && event.key === 'Enter') onSubmit?.();
    else if (event.key === 'Escape') onCancel?.();
    else if (shortcut) {
      event.preventDefault();
      applyFormat(shortcut);
    }
  }

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper focus-within:border-accent">
      <EditorToolbar mode={mode} onApply={applyFormat} onModeChange={setMode} />
      {mode === 'write' ? (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={event => onChange(event.target.value)}
          onKeyDown={onKeyDown}
          rows={props.minRows ?? DEFAULT_MIN_ROWS}
          placeholder={props.placeholder ?? 'Write a note… Markdown works. ⌘↵ to save'}
          className={`block max-h-[60vh] w-full resize-none bg-transparent p-3 leading-relaxed outline-none ${EditorTextClassNames[size]}`}
        />
      ) : (
        <EditorPreview size={size} value={value} />
      )}
    </div>
  );
}

type EditorToolbarProps = {
  mode: EditorMode;
  onApply: (format: Formatter) => void;
  onModeChange: (mode: EditorMode) => void;
};

function EditorToolbar({ mode, onApply, onModeChange }: EditorToolbarProps) {
  const writing = mode === 'write';

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-panel px-1.5 py-1 text-sm">
      {writing &&
        ToolbarActions.map(action => (
          <button
            key={action.title}
            type="button"
            title={action.title}
            aria-label={action.title}
            onMouseDown={event => event.preventDefault()}
            onClick={() => onApply(action.format)}
            className={`min-w-7 rounded px-1.5 py-0.5 text-muted hover:bg-paper hover:text-ink ${action.className ?? ''}`}
          >
            {action.label}
          </button>
        ))}
      <ModeTabs mode={mode} onModeChange={onModeChange} />
    </div>
  );
}

function ModeTabs({ mode, onModeChange }: Omit<EditorToolbarProps, 'onApply'>) {
  const tabClass = (tab: EditorMode) =>
    `rounded px-2 py-0.5 text-xs ${mode === tab ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'}`;

  return (
    <div className="ml-auto flex gap-0.5" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'write'}
        onClick={() => onModeChange('write')}
        className={tabClass('write')}
      >
        Write
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === 'preview'}
        onClick={() => onModeChange('preview')}
        className={tabClass('preview')}
      >
        Preview
      </button>
    </div>
  );
}

function EditorPreview({ size, value }: { size: MarkdownSize; value: string }) {
  if (!value.trim()) return <p className="p-3 text-sm text-muted">Nothing to preview yet.</p>;

  return <MarkdownView source={value} size={size} className="max-h-[60vh] overflow-y-auto p-3" />;
}
