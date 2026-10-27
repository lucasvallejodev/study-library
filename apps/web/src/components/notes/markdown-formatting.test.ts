import { describe, expect, it } from 'vitest';

import {
  type EditorState,
  insertCodeBlock,
  insertLink,
  numberedPrefixLength,
  toggleInline,
  toggleLinePrefix,
} from './markdown-formatting';

const selecting = (text: string, selected: string): EditorState => {
  const selectionStart = text.indexOf(selected);

  return {
    selectionEnd: selectionStart + selected.length,
    selectionStart,
    text,
  };
};

const selectedOf = (state: EditorState) =>
  state.text.slice(state.selectionStart, state.selectionEnd);

describe('markdown formatting', () => {
  it('wraps and unwraps the selection in bold', () => {
    const bolded = toggleInline(selecting('a key idea here', 'key idea'), 'bold');

    expect(bolded.text).toBe('a **key idea** here');
    expect(selectedOf(bolded)).toBe('key idea');
    expect(toggleInline(bolded, 'bold').text).toBe('a key idea here');
  });

  it('inserts a placeholder when nothing is selected', () => {
    const italic = toggleInline(
      {
        selectionEnd: 0,
        selectionStart: 0,
        text: '',
      },
      'italic'
    );

    expect(italic.text).toBe('_italic text_');
    expect(selectedOf(italic)).toBe('italic text');
  });

  it('turns the selection into a link and selects the url', () => {
    const linked = insertLink(selecting('see the paper', 'the paper'));

    expect(linked.text).toBe('see [the paper](https://)');
    expect(selectedOf(linked)).toBe('https://');
  });

  it('fences a code block', () => {
    expect(insertCodeBlock(selecting('run x = 1', 'x = 1')).text).toBe('run ```\nx = 1\n```');
  });

  it('toggles line prefixes over every selected line', () => {
    const text = 'first\nsecond\nthird';

    const state = {
      selectionEnd: text.indexOf('second') + 2,
      selectionStart: 1,
      text,
    };

    const bulleted = toggleLinePrefix(state, 'bullet');

    expect(bulleted.text).toBe('- first\n- second\nthird');
    expect(toggleLinePrefix(bulleted, 'bullet').text).toBe(text);
  });

  it('numbers lines and removes the numbers again', () => {
    const state = {
      selectionEnd: 7,
      selectionStart: 0,
      text: 'one\ntwo',
    };

    const numbered = toggleLinePrefix(state, 'numbered');

    expect(numbered.text).toBe('1. one\n2. two');
    expect(toggleLinePrefix(numbered, 'numbered').text).toBe('one\ntwo');
  });

  it('measures numbered list prefixes', () => {
    expect(numberedPrefixLength('12. item')).toBe(4);
    expect(numberedPrefixLength('1.item')).toBe(0);
    expect(numberedPrefixLength('item')).toBe(0);
  });
});
