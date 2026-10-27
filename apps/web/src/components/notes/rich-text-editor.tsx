'use client';

import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { TextSelection } from '@tiptap/pm/state';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useEffect, useLayoutEffect, useRef } from 'react';

import type { MarkdownSize } from './markdown-view';

type RichTextEditorProps = {
  autoFocus?: boolean;
  onCancel?: () => void;
  onChange: (markdown: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  size?: MarkdownSize;
  value: string;
};

type Chain = ReturnType<Editor['chain']>;

type EditorCallbacks = Pick<RichTextEditorProps, 'onCancel' | 'onChange' | 'onSubmit'>;

type RichToolbarAction = {
  className?: string;
  isActive?: (editor: Editor) => boolean;
  label: string;
  run: (chain: Chain, editor: Editor) => Chain;
  title: string;
};

const DEFAULT_PLACEHOLDER = 'Write a note… ⌘↵ to save';
const LARGEST_NOTE_HEADING = 2;
const SECTION_NOTE_HEADING = 3;
const SMALLEST_NOTE_HEADING = 4;

const NoteHeadingLevels = [
  LARGEST_NOTE_HEADING,
  SECTION_NOTE_HEADING,
  SMALLEST_NOTE_HEADING,
] as const;

const SectionHeading = { level: SECTION_NOTE_HEADING } as const;
const FocusWithoutScrolling = { preventScroll: true };

const EditorSizeClassNames: Record<MarkdownSize, string> = {
  base: 'prose-base',
  sm: 'prose-sm',
};

function askForLink(chain: Chain, editor: Editor): Chain {
  const current = editor.getAttributes('link').href as string | undefined;
  const href = window.prompt('Link address', current ?? 'https://');

  if (href === null) return chain;
  if (!href.trim()) return chain.extendMarkRange('link').unsetLink();

  return chain.extendMarkRange('link').setLink({ href: href.trim() });
}

const RichToolbarActions: RichToolbarAction[] = [
  // keep order
  {
    className: 'font-bold',
    isActive: editor => editor.isActive('bold'),
    label: 'B',
    run: chain => chain.toggleBold(),
    title: 'Bold (⌘B)',
  },
  {
    className: 'italic',
    isActive: editor => editor.isActive('italic'),
    label: 'I',
    run: chain => chain.toggleItalic(),
    title: 'Italic (⌘I)',
  },
  {
    className: 'line-through',
    isActive: editor => editor.isActive('strike'),
    label: 'S',
    run: chain => chain.toggleStrike(),
    title: 'Strikethrough (⌘⇧S)',
  },
  {
    className: 'font-mono',
    isActive: editor => editor.isActive('code'),
    label: '</>',
    run: chain => chain.toggleCode(),
    title: 'Inline code (⌘E)',
  },
  {
    isActive: editor => editor.isActive('link'),
    label: 'Link',
    run: askForLink,
    title: 'Link (⌘K)',
  },
  {
    className: 'font-semibold',
    isActive: editor => editor.isActive('heading'),
    label: 'H',
    run: chain => chain.toggleHeading(SectionHeading),
    title: 'Heading',
  },
  {
    isActive: editor => editor.isActive('blockquote'),
    label: '❝',
    run: chain => chain.toggleBlockquote(),
    title: 'Quote',
  },
  {
    isActive: editor => editor.isActive('bulletList'),
    label: '•',
    run: chain => chain.toggleBulletList(),
    title: 'Bulleted list',
  },
  {
    isActive: editor => editor.isActive('orderedList'),
    label: '1.',
    run: chain => chain.toggleOrderedList(),
    title: 'Numbered list',
  },
  {
    isActive: editor => editor.isActive('taskList'),
    label: '☐',
    run: chain => chain.toggleTaskList(),
    title: 'Checklist',
  },
  {
    className: 'font-mono',
    isActive: editor => editor.isActive('codeBlock'),
    label: '{ }',
    run: chain => chain.toggleCodeBlock(),
    title: 'Code block',
  },
];

function focusAtEnd(editor: Editor) {
  const { state, view } = editor;

  view.dom.focus(FocusWithoutScrolling);
  view.dispatch(state.tr.setSelection(TextSelection.atEnd(state.doc)));
}

function isModifierKey(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey;
}

function useLatestCallbacks(props: RichTextEditorProps): React.RefObject<EditorCallbacks> {
  const callbacksRef = useRef<EditorCallbacks>(props);

  useLayoutEffect(() => {
    callbacksRef.current = props;
  });

  return callbacksRef;
}

function useNoteEditor(props: RichTextEditorProps): Editor | null {
  const { size = 'sm', value } = props;
  const callbacksRef = useLatestCallbacks(props);

  return useEditor({
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: {
        class: `note-prose prose dark:prose-invert max-w-none ${EditorSizeClassNames[size]} min-h-32 max-h-[60vh] overflow-y-auto p-3 outline-none`,
      },
      handleKeyDown: (view, event) => {
        if (isModifierKey(event) && event.key === 'Enter') {
          callbacksRef.current.onSubmit?.();

          return true;
        }

        if (event.key === 'Escape') {
          callbacksRef.current.onCancel?.();

          return true;
        }

        return false;
      },
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [...NoteHeadingLevels] },
        link: { autolink: true, openOnClick: false },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: props.placeholder ?? DEFAULT_PLACEHOLDER }),
      Markdown,
    ],
    immediatelyRender: false,
    onCreate: ({ editor }) => {
      if (props.autoFocus) setTimeout(() => focusAtEnd(editor));
    },
    onUpdate: ({ editor }) => callbacksRef.current.onChange(editor.getMarkdown()),
  });
}

function useLinkShortcut(editor: Editor | null) {
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModifierKey(event) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      askForLink(editor.chain().focus(), editor).run();
    };

    dom.addEventListener('keydown', onKeyDown);

    return () => dom.removeEventListener('keydown', onKeyDown);
  }, [editor]);
}

export function RichTextEditor(props: RichTextEditorProps) {
  const editor = useNoteEditor(props);

  useLinkShortcut(editor);

  return (
    <>
      {editor && <RichToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </>
  );
}

function RichToolbar({ editor }: { editor: Editor }) {
  const active = useEditorState({
    editor,
    selector: ({ editor: current }) =>
      RichToolbarActions.map(action => action.isActive?.(current) ?? false),
  });

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-line bg-panel px-1.5 py-1 text-sm">
      {RichToolbarActions.map((action, index) => (
        <button
          key={action.title}
          type="button"
          title={action.title}
          aria-label={action.title}
          aria-pressed={active[index]}
          onMouseDown={event => event.preventDefault()}
          onClick={() => action.run(editor.chain().focus(), editor).run()}
          className={`min-w-7 rounded px-1.5 py-0.5 hover:bg-paper hover:text-ink ${active[index] ? 'bg-paper text-ink' : 'text-muted'} ${action.className ?? ''}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
