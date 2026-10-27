import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

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

const ExternalLinks: Components = {
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
};

export function MarkdownView({ className = '', size = 'sm', source }: MarkdownViewProps) {
  return (
    <div
      className={`note-prose prose max-w-none dark:prose-invert ${SizeClassNames[size]} ${className}`}
    >
      <ReactMarkdown remarkPlugins={RemarkPlugins} components={ExternalLinks}>
        {source}
      </ReactMarkdown>
    </div>
  );
}
