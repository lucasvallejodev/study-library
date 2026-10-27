/**
 * DOM helpers for the reader. The "text" of a chapter is the concatenation of every
 * text node under the article root, in document order (same as root.textContent).
 */

/**
 *
 * @param root
 */
export const textOf = (root: Node): string => root.textContent ?? '';

/**
 * Map [start, end) character offsets in textOf(root) to a DOM Range.
 *
 * @param root
 * @param start
 * @param end
 */
export const rangeFromOffsets = (root: Node, start: number, end: number): Range | null => {
  const doc = root.ownerDocument ?? (root as Document);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  let pos = 0;
  let startSet = false;
  let node = walker.nextNode() as Text | null;

  while (node) {
    const len = node.data.length;

    if (!startSet && start < pos + len) {
      range.setStart(node, start - pos);
      startSet = true;
    }

    if (startSet && end <= pos + len) {
      range.setEnd(node, end - pos);

      return range;
    }

    pos += len;
    node = walker.nextNode() as Text | null;
  }

  return null;
};

/**
 * Map a DOM Range inside root back to character offsets.
 *
 * @param root
 * @param range
 */
export const offsetsFromRange = (
  root: Node,
  range: Range
): { end: number; start: number } | null => {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOfPoint(root, range.startContainer, range.startOffset);
  const end = offsetOfPoint(root, range.endContainer, range.endOffset);

  if (start === null || end === null || end <= start) return null;

  return { end, start };
};

const offsetOfPoint = (root: Node, container: Node, offset: number): number | null => {
  const doc = root.ownerDocument ?? (root as Document);
  const pre = doc.createRange();

  pre.selectNodeContents(root);

  try {
    pre.setEnd(container, offset);
  } catch {
    return null;
  }

  return pre.toString().length;
};
