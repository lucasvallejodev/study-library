export type EditorState = {
  selectionEnd: number;
  selectionStart: number;
  text: string;
};

export type InlineStyle = 'bold' | 'code' | 'italic' | 'strikethrough';

export type LineStyle = 'bullet' | 'heading' | 'numbered' | 'quote' | 'task';

const InlineMarkers: Record<InlineStyle, string> = {
  bold: '**',
  code: '`',
  italic: '_',
  strikethrough: '~~',
};

const InlinePlaceholders: Record<InlineStyle, string> = {
  bold: 'bold text',
  code: 'code',
  italic: 'italic text',
  strikethrough: 'struck text',
};

const LinePrefixes: Record<Exclude<LineStyle, 'numbered'>, string> = {
  bullet: '- ',
  heading: '### ',
  quote: '> ',
  task: '- [ ] ',
};

const LINK_PLACEHOLDER = 'link text';
const LINK_URL_PLACEHOLDER = 'https://';
const CODE_FENCE = '```';
const NUMBERED_SEPARATOR = '. ';

function selectedText({ selectionEnd, selectionStart, text }: EditorState): string {
  return text.slice(selectionStart, selectionEnd);
}

function replaceSelection(state: EditorState, replacement: string): string {
  return (
    state.text.slice(0, state.selectionStart) + replacement + state.text.slice(state.selectionEnd)
  );
}

function isWrappedWith(state: EditorState, marker: string): boolean {
  const { selectionEnd, selectionStart, text } = state;

  return (
    text.slice(selectionStart - marker.length, selectionStart) === marker &&
    text.slice(selectionEnd, selectionEnd + marker.length) === marker
  );
}

function unwrap(state: EditorState, marker: string): EditorState {
  const { selectionEnd, selectionStart, text } = state;

  return {
    selectionEnd: selectionEnd - marker.length,
    selectionStart: selectionStart - marker.length,
    text:
      text.slice(0, selectionStart - marker.length) +
      text.slice(selectionStart, selectionEnd) +
      text.slice(selectionEnd + marker.length),
  };
}

export function toggleInline(state: EditorState, style: InlineStyle): EditorState {
  const marker = InlineMarkers[style];

  if (isWrappedWith(state, marker)) return unwrap(state, marker);
  const content = selectedText(state) || InlinePlaceholders[style];
  const contentStart = state.selectionStart + marker.length;

  return {
    selectionEnd: contentStart + content.length,
    selectionStart: contentStart,
    text: replaceSelection(state, marker + content + marker),
  };
}

export function insertLink(state: EditorState): EditorState {
  const label = selectedText(state) || LINK_PLACEHOLDER;
  const urlStart = state.selectionStart + `[${label}](`.length;

  return {
    selectionEnd: urlStart + LINK_URL_PLACEHOLDER.length,
    selectionStart: urlStart,
    text: replaceSelection(state, `[${label}](${LINK_URL_PLACEHOLDER})`),
  };
}

export function insertCodeBlock(state: EditorState): EditorState {
  const code = selectedText(state);
  const opening = `${CODE_FENCE}\n`;
  const codeStart = state.selectionStart + opening.length;

  return {
    selectionEnd: codeStart + code.length,
    selectionStart: codeStart,
    text: replaceSelection(state, `${opening}${code}\n${CODE_FENCE}`),
  };
}

type LineBlock = {
  end: number;
  lines: string[];
  start: number;
};

function selectedLines({ selectionEnd, selectionStart, text }: EditorState): LineBlock {
  const start = text.lastIndexOf('\n', selectionStart - 1) + 1;
  const nextBreak = text.indexOf('\n', selectionEnd);
  const end = nextBreak === -1 ? text.length : nextBreak;

  return {
    end,
    lines: text.slice(start, end).split('\n'),
    start,
  };
}

function isDigit(character: string): boolean {
  return character >= '0' && character <= '9';
}

export function numberedPrefixLength(line: string): number {
  let digits = 0;

  while (digits < line.length && isDigit(line[digits])) digits++;

  const hasSeparator =
    line.slice(digits, digits + NUMBERED_SEPARATOR.length) === NUMBERED_SEPARATOR;

  return digits > 0 && hasSeparator ? digits + NUMBERED_SEPARATOR.length : 0;
}

function prefixLengthOf(line: string, style: LineStyle): number {
  if (style === 'numbered') return numberedPrefixLength(line);
  const prefix = LinePrefixes[style];

  return line.startsWith(prefix) ? prefix.length : 0;
}

function prefixFor(style: LineStyle, index: number): string {
  return style === 'numbered' ? `${index + 1}${NUMBERED_SEPARATOR}` : LinePrefixes[style];
}

export function toggleLinePrefix(state: EditorState, style: LineStyle): EditorState {
  const block = selectedLines(state);
  const allPrefixed = block.lines.every(line => prefixLengthOf(line, style) > 0);

  const updated = block.lines
    .map((line, index) =>
      allPrefixed ? line.slice(prefixLengthOf(line, style)) : prefixFor(style, index) + line
    )
    .join('\n');

  return {
    selectionEnd: block.start + updated.length,
    selectionStart: block.start,
    text: state.text.slice(0, block.start) + updated + state.text.slice(block.end),
  };
}
