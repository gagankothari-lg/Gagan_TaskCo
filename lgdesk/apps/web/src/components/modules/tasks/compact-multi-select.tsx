'use client';

// Compact multi-select chip widget sized to fit inside a narrow table-row
// cell — mirrors reference/lgdesk-gas-source.html's `.ts-ims-*` rule family
// (the inline multi-assignee picker used by the task-sheet's batch
// "Add Tasks" row). Same closed-display-box + click-to-open-dropdown
// pattern as meetings/attendee-picker.tsx's internal `MultiSelectDropdown`
// (chips + search + checkable option list + document-mousedown outside-click
// close), just scaled down to `.ts-ims-*`'s smaller dimensions/type sizes.
// Kept fully generic (no "employee"/"assignee" wording) so it can be reused
// for any multi-select-of-people-or-things use case later.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../ui/icon';

export interface CompactMultiSelectOption {
  id: string;
  label: string;
}

interface CompactMultiSelectProps {
  options: CompactMultiSelectOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
}

export function CompactMultiSelect({ options, selectedIds, onChange, placeholder = 'Select…' }: CompactMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const wrapRef = useRef<HTMLDivElement>(null);

  // Outside-click closes the dropdown — same document-mousedown + ref.contains
  // pattern already used by attendee-picker.tsx's MultiSelectDropdown (and
  // layout-client.tsx elsewhere in the app) rather than a new invention.
  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const toggleId = (id: string) => {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  };

  const removeId = (id: string) => {
    onChange(selectedIds.filter((x) => x !== id));
  };

  const selectedOptions = useMemo(
    () => selectedIds.map((id) => options.find((o) => o.id === id)).filter((o): o is CompactMultiSelectOption => !!o),
    [selectedIds, options],
  );

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={wrapRef} className="relative">
      {/* .ts-ims-wrap / .ts-ims-display */}
      <div
        onClick={() => setOpen((v) => !v)}
        className={`flex min-h-[24px] cursor-pointer select-none flex-wrap items-center gap-[2px] rounded-[4px] border bg-surface px-[5px] py-[2px] hover:border-p2 hover:shadow-[0_0_0_2px_rgba(57,73,171,0.09)] ${
          open ? 'border-p2 shadow-[0_0_0_2px_rgba(57,73,171,0.09)]' : 'border-border'
        }`}
      >
        {selectedOptions.length === 0 ? (
          // .ts-ims-ph
          <span className="text-[11px] text-muted2">{placeholder}</span>
        ) : (
          selectedOptions.map((o) => (
            // .ts-ims-chip
            <span
              key={o.id}
              title={o.label}
              className="inline-flex max-w-[90px] items-center gap-[1px] overflow-hidden whitespace-nowrap rounded-[3px] bg-p3 px-[4px] py-[1px] text-[10.5px] font-semibold text-ellipsis text-p"
            >
              {o.label}
              {/* .ts-ims-chip-x */}
              <button
                type="button"
                aria-label={`Remove ${o.label}`}
                onClick={(e) => {
                  e.stopPropagation();
                  removeId(o.id);
                }}
                className="ml-[2px] flex flex-shrink-0 items-center border-0 bg-transparent p-0 leading-none text-p opacity-55 hover:text-danger hover:opacity-100"
              >
                <Icon name="close" size={10} />
              </button>
            </span>
          ))
        )}
        {/* .ts-ims-arr */}
        <Icon name="expand_more" size={9} className="ml-auto flex-shrink-0 pl-[3px] text-muted opacity-65" />
      </div>

      {open && (
        // .ts-ims-drop
        <div className="absolute left-0 top-[calc(100%+3px)] z-[650] flex max-h-[210px] min-w-[185px] flex-col overflow-hidden rounded-[6px] border border-border bg-surface shadow-[0_6px_22px_rgba(0,0,0,0.15)]">
          {/* .ts-ims-srch */}
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search…"
            autoFocus
            className="w-full border-0 border-b border-border bg-surface px-[9px] py-[5px] font-sans text-[11.5px] outline-none"
          />
          {/* .ts-ims-list */}
          <div className="flex-1 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-[10px] py-[8px] text-[11.5px] text-muted">No matches</div>
            ) : (
              filteredOptions.map((o) => {
                const isSelected = selectedIds.includes(o.id);
                return (
                  // .ts-ims-opt (+ .ts-ims-sel when checked)
                  <div
                    key={o.id}
                    onClick={() => toggleId(o.id)}
                    className="flex cursor-pointer select-none items-center gap-[7px] px-[10px] py-[5px] text-[12px] transition-colors duration-75 hover:bg-p3"
                  >
                    {/* .ts-ims-opt-dot */}
                    <span
                      className={`flex h-[13px] w-[13px] flex-shrink-0 items-center justify-center rounded-[2px] border-[1.5px] transition-all duration-100 ${
                        isSelected ? 'border-p2 bg-p2 text-white' : 'border-[#c5c5c5] text-transparent'
                      }`}
                    >
                      <Icon name="check" size={9} />
                    </span>
                    <span className="truncate">{o.label}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CompactMultiSelect;
