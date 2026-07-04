'use client';

// Custom-meeting attendee picker — mirrors reference/lgdesk-gas-source.html's
// #mtg-asgn-teams / #mtg-asgn-people "ms-wrap" dropdown+chip multiselect widgets
// (same pattern the GAS source uses for task assignment): a closed display row
// showing selected chips that expands into a checkable dropdown list, plus a
// team/role filter pair that narrows the People list only.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
}

function MultiSelectDropdown({
  placeholder,
  options,
  selected,
  onChange,
}: {
  placeholder: string;
  options: Option[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [open]);

  const toggleValue = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);

  const selectedOptions = options.filter((o) => selected.includes(o.value));

  return (
    <div ref={ref} className="relative">
      <div
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-[38px] cursor-pointer flex-wrap items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3 py-2"
      >
        {selectedOptions.length === 0 ? (
          <span className="text-sm text-muted2">{placeholder}</span>
        ) : (
          selectedOptions.map((o) => (
            <span key={o.value} className="inline-flex items-center gap-1 rounded-[9999px] bg-p3 px-2 py-0.5 text-xs text-p">
              {o.label}
              <button
                type="button"
                aria-label={`Remove ${o.label}`}
                onClick={(e) => { e.stopPropagation(); toggleValue(o.value); }}
                className="hover:text-danger"
              >
                <Icon name="close" size={10} />
              </button>
            </span>
          ))
        )}
        <Icon name="expand_more" size={16} className="ml-auto shrink-0 text-muted" />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded-[8px] border border-border bg-surface p-1 shadow-[var(--sh)]">
          {options.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">No options</p>
          ) : (
            options.map((o) => (
              <label key={o.value} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-sm text-text hover:bg-p3">
                <input type="checkbox" checked={selected.includes(o.value)} onChange={() => toggleValue(o.value)} className="accent-p" />
                <span className="truncate">{o.label}</span>
                {o.sublabel && <span className="ml-auto truncate text-xs text-muted">{o.sublabel}</span>}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function CustomAttendeePicker({
  selectedTeams,
  onTeamsChange,
  selectedPeople,
  onPeopleChange,
}: {
  selectedTeams: string[];
  onTeamsChange: (teams: string[]) => void;
  selectedPeople: string[];
  onPeopleChange: (ids: string[]) => void;
}) {
  const { employees } = useAuth();
  const [filterTeam, setFilterTeam] = useState('');
  const [filterRole, setFilterRole] = useState('');

  const allTeams = useMemo(() => Array.from(new Set(employees.map((e) => e.team).filter(Boolean))) as string[], [employees]);
  const allRoles = useMemo(() => Array.from(new Set(employees.map((e) => e.role).filter(Boolean))), [employees]);

  const teamOptions: Option[] = allTeams.map((t) => ({ value: t, label: t }));

  const peopleOptions: Option[] = useMemo(
    () =>
      employees
        .filter((e) => (filterTeam ? e.team === filterTeam : true))
        .filter((e) => (filterRole ? e.role === filterRole : true))
        .map((e) => ({ value: e.empId, label: `${e.firstName} ${e.lastName}`, sublabel: e.team })),
    [employees, filterTeam, filterRole],
  );

  return (
    <div style={{ gridColumn: '1/-1' }}>
      <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-muted">Invite Attendees</label>

      <div className="mb-2">
        <div className="mb-1 text-xs font-medium text-text">Assign to Teams</div>
        <MultiSelectDropdown placeholder="Select teams to invite…" options={teamOptions} selected={selectedTeams} onChange={onTeamsChange} />
        <div className="my-2 text-center text-[11px] text-muted">— or select specific people below —</div>
      </div>

      <div className="mb-1.5 flex gap-2">
        <select className="fc" style={{ flex: 1, fontSize: 12 }} value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)}>
          <option value="">All Teams</option>
          {allTeams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className="fc" style={{ flex: 1, fontSize: 12 }} value={filterRole} onChange={(e) => setFilterRole(e.target.value)}>
          <option value="">All Roles</option>
          {allRoles.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="mb-1 text-xs font-medium text-text">Individuals</div>
      <MultiSelectDropdown placeholder="Select people to invite…" options={peopleOptions} selected={selectedPeople} onChange={onPeopleChange} />
    </div>
  );
}

export default CustomAttendeePicker;
