import type { Element, ElementContent } from 'hast';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { MermaidDiagram } from './mermaid-diagram';

export type MarkdownSize = 'base' | 'sm';

type MarkdownViewProps = {
  className?: string;
  size?: MarkdownSize;
  source: string;
};

const SizeClassNames: Record<MarkdownSize, string> = {
  base: 'prose-base',
  sm: 'prose-sm',
};

const RemarkPlugins = [remarkGfm];

const MERMAID_CLASS_NAME = 'language-mermaid';

const textOf = (nodes: ElementContent[]): string =>
  nodes.map(node => ('value' in node ? node.value : textOf(node.children))).join('');

const mermaidSourceOf = (pre: Element | undefined): string | undefined => {
  const code = pre?.children[0];

  if (code?.type !== 'element' || code.tagName !== 'code') return undefined;
  const classNames = code.properties.className;

  return Array.isArray(classNames) && classNames.includes(MERMAID_CLASS_NAME)
    ? textOf(code.children)
    : undefined;
};

const NoteComponents: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  pre: ({ children, node }) => {
    const mermaidSource = mermaidSourceOf(node);

    return mermaidSource === undefined ? (
      <pre>{children}</pre>
    ) : (
      <MermaidDiagram code={mermaidSource} />
    );
  },
};

export function MarkdownView({ className = '', size = 'sm', source }: MarkdownViewProps) {
  return (
    <div
      className={`note-prose prose max-w-none dark:prose-invert ${SizeClassNames[size]} ${className}`}
    >
      <ReactMarkdown remarkPlugins={RemarkPlugins} components={NoteComponents}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
