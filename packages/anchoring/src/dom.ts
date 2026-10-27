type CharacterRange = {
  end: number;
  start: number;
};

const ownerDocumentOf = (root: Node): Document => root.ownerDocument ?? (root as Document);

const nextTextNode = (walker: TreeWalker): Text | null => walker.nextNode() as Text | null;

/**
 * Returns the text of a chapter as the anchoring functions see it.
 *
 * @remarks
 * The "text" of a chapter is the concatenation of every text node under the article root,
 * in document order (the same as `root.textContent`). Offsets in selectors index into it.
 *
 * @param root - The article root element.
 * @returns The concatenated text, or an empty string.
 */
export const textOf = (root: Node): string => root.textContent ?? '';

/**
 * Maps `[start, end)` character offsets in {@link textOf}(root) to a DOM Range.
 *
 * @param root - The article root element.
 * @param start - Offset of the first character.
 * @param end - Offset just past the last character.
 * @returns The range, or null when the offsets fall outside the text.
 */
export const rangeFromOffsets = (root: Node, start: number, end: number): Range | null => {
  const doc = ownerDocumentOf(root);
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = doc.createRange();
  let nodeStart = 0;
  let startSet = false;
  let node = nextTextNode(walker);

  while (node) {
    const nodeEnd = nodeStart + node.data.length;

    if (!startSet && start < nodeEnd) {
      range.setStart(node, start - nodeStart);
      startSet = true;
    }

    if (startSet && end <= nodeEnd) {
      range.setEnd(node, end - nodeStart);

      return range;
    }

    nodeStart = nodeEnd;
    node = nextTextNode(walker);
  }

  return null;
};

const offsetOfPoint = (root: Node, container: Node, offset: number): number | null => {
  const textBefore = ownerDocumentOf(root).createRange();

  textBefore.selectNodeContents(root);

  try {
    textBefore.setEnd(container, offset);
  } catch {
    return null;
  }

  return textBefore.toString().length;
};

/**
 * Maps a DOM Range inside root back to character offsets in {@link textOf}(root).
 *
 * @param root - The article root element.
 * @param range - A range, typically the user's selection.
 * @returns The `[start, end)` offsets, or null when the range is outside root or empty.
 */
export const offsetsFromRange = (root: Node, range: Range): CharacterRange | null => {
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
  const start = offsetOfPoint(root, range.startContainer, range.startOffset);
  const end = offsetOfPoint(root, range.endContainer, range.endOffset);

  if (start === null || end === null || end <= start) return null;

  return { end, start };
};
