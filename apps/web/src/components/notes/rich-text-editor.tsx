'use client';

import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from '@tiptap/markdown';
import { TextSelection } from '@tiptap/pm/state';
import { type Editor, EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';

import { linkPrompt } from '../dialogs/confirmations';
import { useDialogs } from '../dialogs/dialog-provider';
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

type EditorTools = {
  editLink: (editor: Editor) => Promise<void>;
};

type EditorCallbacks = Pick<RichTextEditorProps, 'onCancel' | 'onChange' | 'onSubmit'>;

type RichToolbarAction = {
  className?: string;
  isActive?: (editor: Editor) => boolean;
  label: string;
  run: (editor: Editor, tools: EditorTools) => void;
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

const RichToolbarActions: RichToolbarAction[] = [
  // keep order
  {
    className: 'font-bold',
    isActive: editor => editor.isActive('bold'),
    label: 'B',
    run: editor => editor.chain().focus().toggleBold().run(),
    title: 'Bold (⌘B)',
  },
  {
    className: 'italic',
    isActive: editor => editor.isActive('italic'),
    label: 'I',
    run: editor => editor.chain().focus().toggleItalic().run(),
    title: 'Italic (⌘I)',
  },
  {
    className: 'line-through',
    isActive: editor => editor.isActive('strike'),
    label: 'S',
    run: editor => editor.chain().focus().toggleStrike().run(),
    title: 'Strikethrough (⌘⇧S)',
  },
  {
    className: 'font-mono',
    isActive: editor => editor.isActive('code'),
    label: '</>',
    run: editor => editor.chain().focus().toggleCode().run(),
    title: 'Inline code (⌘E)',
  },
  {
    isActive: editor => editor.isActive('link'),
    label: 'Link',
    run: (editor, tools) => void tools.editLink(editor),
    title: 'Link (⌘K)',
  },
  {
    className: 'font-semibold',
    isActive: editor => editor.isActive('heading'),
    label: 'H',
    run: editor => editor.chain().focus().toggleHeading(SectionHeading).run(),
    title: 'Heading',
  },
  {
    isActive: editor => editor.isActive('blockquote'),
    label: '❝',
    run: editor => editor.chain().focus().toggleBlockquote().run(),
    title: 'Quote',
  },
  {
    isActive: editor => editor.isActive('bulletList'),
    label: '•',
    run: editor => editor.chain().focus().toggleBulletList().run(),
    title: 'Bulleted list',
  },
  {
    isActive: editor => editor.isActive('orderedList'),
    label: '1.',
    run: editor => editor.chain().focus().toggleOrderedList().run(),
    title: 'Numbered list',
  },
  {
    isActive: editor => editor.isActive('taskList'),
    label: '☐',
    run: editor => editor.chain().focus().toggleTaskList().run(),
    title: 'Checklist',
  },
  {
    className: 'font-mono',
    isActive: editor => editor.isActive('codeBlock'),
    label: '{ }',
    run: editor => editor.chain().focus().toggleCodeBlock().run(),
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

function useLinkEditing(): EditorTools['editLink'] {
  const dialogs = useDialogs();

  return useCallback(
    async (editor: Editor) => {
      const current = editor.getAttributes('link').href as string | undefined;
      const href = await dialogs.prompt(linkPrompt(current));
      const chain = editor.chain().focus();

      if (href === null) {
        chain.run();

        return;
      }

      const link = chain.extendMarkRange('link');

      if (href.trim()) link.setLink({ href: href.trim() }).run();
      else link.unsetLink().run();
    },
    [dialogs]
  );
}

function useLinkShortcut(editor: Editor | null, editLink: EditorTools['editLink']) {
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isModifierKey(event) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      void editLink(editor);
    };

    dom.addEventListener('keydown', onKeyDown);

    return () => dom.removeEventListener('keydown', onKeyDown);
  }, [editor, editLink]);
}

export function RichTextEditor(props: RichTextEditorProps) {
  const editor = useNoteEditor(props);

  const editLink = useLinkEditing();

  useLinkShortcut(editor, editLink);

  return (
    <>
      {editor && <RichToolbar editor={editor} tools={{ editLink }} />}
      <EditorContent editor={editor} />
    </>
  );
}

function RichToolbar({ editor, tools }: { editor: Editor; tools: EditorTools }) {
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
          onClick={() => action.run(editor, tools)}
          className={`min-w-7 rounded px-1.5 py-0.5 hover:bg-paper hover:text-ink ${active[index] ? 'bg-paper text-ink' : 'text-muted'} ${action.className ?? ''}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
