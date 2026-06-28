'use client';

import { useState, type KeyboardEvent } from 'react';
import { Icon } from '../../ui/icon';

// Stores chips as a newline-delimited string. Enter adds a chip, × removes one.
export function WorkChipInput({ value, onChange, placeholder }: { value: string; onChange: (next: string) => void; placeholder?: string }) {
  const [draft, setDraft] = useState('');
  const chips = value ? value.split('\n').filter(Boolean) : [];

  const setChips = (next: string[]) => onChange(next.join('\n'));

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && draft.trim()) {
      e.preventDefault();
      setChips([...chips, draft.trim()]);
      setDraft('');
    } else if (e.key === 'Backspace' && !draft && chips.length) {
      setChips(chips.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5">
      {chips.map((c, i) => (
        <span key={`${c}-${i}`} className="inline-flex items-center gap-1 rounded-[8px] bg-[var(--p3)] px-1.5 py-0.5 text-xs text-[var(--text)]">
          {c}
          <button type="button" onClick={() => setChips(chips.filter((_, j) => j !== i))} aria-label={`Remove ${c}`} className="text-[var(--muted)] hover:text-[var(--danger)]">
            <Icon name="close" size={11} />
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={chips.length === 0 ? (placeholder ?? 'Add item + Enter') : ''}
        className="min-w-[80px] flex-1 bg-transparent text-xs text-[var(--text)] placeholder:text-[var(--muted)] focus:outline-none"
      />
    </div>
  );
}

export default WorkChipInput;
