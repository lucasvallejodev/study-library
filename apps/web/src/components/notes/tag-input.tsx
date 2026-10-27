'use client';

import { useId, useState } from 'react';

import { useKnownTags } from './use-known-tags';

type TagInputProps = {
  onChange: (tags: string[]) => void;
  tags: string[];
};

type Suggestion = {
  isNew: boolean;
  tag: string;
};

type ConsumesKey = () => boolean;

const MAX_SUGGESTIONS = 8;

export function normalizeTag(raw: string): string {
  return raw.trim().replaceAll(',', '').replaceAll(' ', '-');
}

function suggestionsFor(query: string, known: string[], selected: string[]): Suggestion[] {
  const typed = normalizeTag(query);
  const needle = typed.toLowerCase();

  const matches = known
    .filter(tag => !selected.includes(tag) && tag.toLowerCase().includes(needle))
    .slice(0, MAX_SUGGESTIONS)
    .map(tag => ({ isNew: false, tag }));

  const isKnown = known.some(tag => tag.toLowerCase() === needle);
  const offerNew = typed && !isKnown && !selected.includes(typed);

  return offerNew ? [...matches, { isNew: true, tag: typed }] : matches;
}

function nextIndex(current: number, step: number, count: number): number {
  if (count === 0) return -1;

  return (current + step + count) % count;
}

type TagInputState = {
  add: (tag: string) => void;
  closeSuggestions: () => boolean;
  highlighted: number;
  onKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  openSuggestions: () => void;
  query: string;
  remove: (tag: string) => void;
  suggestions: Suggestion[];
  type: (text: string) => void;
};

function useTagInput({ onChange, tags }: TagInputProps): TagInputState {
  const known = useKnownTags();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const suggestions = open ? suggestionsFor(query, known, tags) : [];

  function add(tag: string) {
    const clean = normalizeTag(tag);

    if (clean && !tags.includes(clean)) onChange([...tags, clean]);
    setQuery('');
    setHighlighted(0);
  }

  function remove(tag: string) {
    onChange(tags.filter(existing => existing !== tag));
  }

  function addHighlightedOrTyped(): boolean {
    const chosen = suggestions[highlighted]?.tag ?? query;

    if (!chosen.trim()) return false;
    add(chosen);

    return true;
  }

  function moveHighlight(step: number): boolean {
    setOpen(true);
    setHighlighted(nextIndex(highlighted, step, suggestions.length));

    return true;
  }

  function removeLastTagWhenEmpty(): boolean {
    if (!query && tags.length) remove(tags.at(-1)!);

    return false;
  }

  function closeSuggestions(): boolean {
    if (!open) return false;
    setOpen(false);

    return true;
  }

  const KeyActions: Record<string, ConsumesKey> = {
    ',': addHighlightedOrTyped,
    ArrowDown: () => moveHighlight(1),
    ArrowUp: () => moveHighlight(-1),
    Backspace: removeLastTagWhenEmpty,
    Enter: addHighlightedOrTyped,
    Escape: closeSuggestions,
    Tab: addHighlightedOrTyped,
  };

  return {
    add,
    closeSuggestions,
    highlighted,
    onKeyDown: event => {
      if (KeyActions[event.key]?.()) event.preventDefault();
    },
    openSuggestions: () => setOpen(true),
    query,
    remove,
    suggestions,
    type: text => {
      setQuery(text);
      setOpen(true);
      setHighlighted(0);
    },
  };
}

export function TagInput(props: TagInputProps) {
  const input = useTagInput(props);
  const listId = useId();
  const { highlighted, suggestions } = input;

  return (
    <div className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-line bg-paper px-2 py-1.5 focus-within:border-accent">
        {props.tags.map(tag => (
          <TagChip key={tag} tag={tag} onRemove={() => input.remove(tag)} />
        ))}
        <input
          value={input.query}
          onChange={event => input.type(event.target.value)}
          onFocus={input.openSuggestions}
          onBlur={input.closeSuggestions}
          onKeyDown={input.onKeyDown}
          placeholder={props.tags.length ? 'Add tag…' : 'Add tags — Enter to add'}
          role="combobox"
          aria-label="Tags"
          aria-expanded={suggestions.length > 0}
          aria-controls={listId}
          aria-activedescendant={suggestions.length ? `${listId}-${highlighted}` : undefined}
          className="min-w-24 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      {suggestions.length > 0 && (
        <TagSuggestions
          highlighted={highlighted}
          listId={listId}
          onPick={input.add}
          suggestions={suggestions}
        />
      )}
    </div>
  );
}

function TagChip({ onRemove, tag }: { onRemove: () => void; tag: string }) {
  return (
    <span className="flex items-center gap-1 rounded-full bg-panel px-2 py-0.5 text-xs">
      #{tag}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove tag ${tag}`}
        className="text-muted hover:text-ink"
      >
        ×
      </button>
    </span>
  );
}

type TagSuggestionsProps = {
  highlighted: number;
  listId: string;
  onPick: (tag: string) => void;
  suggestions: Suggestion[];
};

function TagSuggestions({ highlighted, listId, onPick, suggestions }: TagSuggestionsProps) {
  return (
    <ul
      id={listId}
      role="listbox"
      className="absolute inset-x-0 top-full z-40 mt-1 max-h-56 overflow-y-auto rounded-lg border border-line bg-paper py-1 text-sm shadow-xl"
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.tag}
          id={`${listId}-${index}`}
          role="option"
          aria-selected={index === highlighted}
          onMouseDown={event => event.preventDefault()}
          onClick={() => onPick(suggestion.tag)}
          className={`cursor-pointer px-3 py-1.5 ${index === highlighted ? 'bg-panel text-ink' : 'text-muted'}`}
        >
          {suggestion.isNew ? `Create tag “${suggestion.tag}”` : `#${suggestion.tag}`}
        </li>
      ))}
    </ul>
  );
}
