'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { Form, FormControl, FormField, FormItem } from '../../ui/form';
import { workRowSchema, type WorkRowFormValues } from './work-row.schema';
import type { WorkLogEntry, WorkLogInput } from '../../../lib/types';

// ─── Attendance source of truth (GAS WL_ATTENDANCE_STYLES) ──────────────
type AttGroup = 'working' | 'leave' | 'off' | 'ot';
interface AttStyle { abbr: string; bg: string; fg: string; group: AttGroup }
export const WL_ATTENDANCE_STYLES: Record<string, AttStyle> = {
  'Present':            { abbr: 'P',  bg: '#dcfce7', fg: '#15803d', group: 'working' },
  'Leave Full Day':     { abbr: 'LF', bg: '#fecdd3', fg: '#be123c', group: 'leave' },
  'Leave Half Day':     { abbr: 'LH', bg: '#fed7aa', fg: '#c2410c', group: 'leave' },
  'Alternate Week Off': { abbr: 'AW', bg: '#fde68a', fg: '#92400e', group: 'off' },
  'Week Off':           { abbr: 'W',  bg: '#fce7f3', fg: '#9d174d', group: 'off' },
  'Holiday':            { abbr: 'H',  bg: '#bfdbfe', fg: '#1d4ed8', group: 'off' },
  'Extra Full Day':     { abbr: 'EF', bg: '#14532d', fg: '#ffffff', group: 'ot' },
  'Extra Half Day':     { abbr: 'EH', bg: '#065f46', fg: '#ffffff', group: 'ot' },
};
export const ATTENDANCE_OPTIONS = Object.keys(WL_ATTENDANCE_STYLES);
const OFF_TYPES = ['Alternate Week Off', 'Week Off', 'Holiday'];
const ALWAYS_OT = ['Extra Full Day', 'Extra Half Day'];
const STATUS_OPTIONS = ['', 'Tentative', 'On Time', 'Late', 'Absent', 'Half Day'];

function statusBadgeClass(s?: string | null): string {
  switch (s) {
    case 'On Time': return 'wl-badge-ok';
    case 'Tentative': return 'wl-badge-tentative';
    case 'Late':
    case 'Absent': return 'wl-badge-danger';
    case 'Half Day': return 'wl-badge-warn';
    default: return 'wl-badge-none';
  }
}

// Reverse of the §4.3 hours table.
function calcFromHrs(hrs: number, base: string): { att: string; extra: number } {
  const isOff = OFF_TYPES.includes(base);
  if (isOff) {
    if (hrs < 4) return { att: base, extra: hrs };
    if (hrs < 9) return { att: 'Extra Half Day', extra: +(hrs - 4).toFixed(1) };
    return { att: 'Extra Full Day', extra: +(hrs - 9).toFixed(1) };
  }
  if (hrs < 4) return { att: 'Leave Full Day', extra: hrs };
  if (hrs < 9) return { att: 'Leave Half Day', extra: +(hrs - 4).toFixed(1) };
  return { att: 'Present', extra: +(hrs - 9).toFixed(1) };
}

type Chip = { type: 'task' | 'project' | 'custom' | 'meeting'; id: string; text: string };
const CHIP_ICON: Record<Chip['type'], string> = { task: 'task_alt', project: 'folder_open', custom: 'edit_note', meeting: 'video_call' };

function parseChips(saved?: string | null): Chip[] {
  if (!saved) return [];
  return saved.split('; ').map((t) => t.trim()).filter(Boolean).map((t) => ({ type: 'custom' as const, id: t, text: t.replace(/\\n/g, '\n') }));
}
function serializeChips(chips: Chip[]): string {
  return chips.map((c) => c.text.replace(/\n/g, '\\n')).join('; ');
}

export interface WorkRowProps {
  date: Date;
  entry?: WorkLogEntry;
  isIntern: boolean;
  isManager: boolean;
  locked: boolean; // future date, non-manager
  durationHms: string;
  pickerItems: { type: 'task' | 'project'; id: string; text: string }[];
  onSave: (input: WorkLogInput) => Promise<unknown>;
}

const iso = (d: Date) => {
  const x = new Date(d);
  x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
  return x.toISOString().slice(0, 10);
};

export function WorkRow({ date, entry, isIntern, isManager, locked, durationHms, pickerItems, onSave }: WorkRowProps) {
  const dateIso = iso(date);
  const today = iso(new Date());
  const isToday = dateIso === today;
  const isFuture = dateIso > today;

  const form = useForm<WorkRowFormValues>({
    resolver: zodResolver(workRowSchema),
    defaultValues: {
      attendance: entry?.attendance ?? '',
      internText: entry?.attendance ?? '',
      extraHours: entry?.extraHours ?? 0,
      remark: entry?.remark ?? '',
      status: entry?.status ?? '',
      comments: entry?.comments ?? '',
    },
  });
  const { attendance, internText, extraHours, remark, status, comments } = form.watch();

  // Chip lists, the off-day "Worked" checkbox, and the quick-entry hours box are UI
  // mechanics with no validation rule of their own — kept as plain state (not lifted
  // into the zod-validated form) so the debounced auto-save contract below stays simple.
  const [h1, setH1] = useState<Chip[]>(() => parseChips(entry?.work1stHalf));
  const [h2, setH2] = useState<Chip[]>(() => parseChips(entry?.work2ndHalf));
  const [offDayWorked, setOffDayWorked] = useState(false);
  const [hrsInput, setHrsInput] = useState('');
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const hydrating = useRef(true);
  const saving = useRef(false);
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const attMeta = WL_ATTENDANCE_STYLES[attendance ?? ''];
  const isOff = OFF_TYPES.includes(attendance ?? '');
  const showsOt = ALWAYS_OT.includes(attendance ?? '') || offDayWorked || (extraHours ?? 0) > 0;

  const signature = useMemo(
    () => JSON.stringify({ a: isIntern ? internText : attendance, w1: serializeChips(h1), w2: serializeChips(h2), e: extraHours, r: remark, s: status, c: comments }),
    [attendance, internText, isIntern, h1, h2, extraHours, remark, status, comments],
  );

  // Debounced auto-save. The hydrating guard prevents a false save on initial mount.
  useEffect(() => {
    if (hydrating.current) { hydrating.current = false; return; }
    if (locked) return;
    dirty.current = true;
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void doSave(); }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  async function doSave() {
    if (saving.current) return; // re-entry guard
    if (!dirty.current) return;
    const valid = await form.trigger();
    if (!valid) { dirty.current = false; setSaveState('error'); return; }
    const values = form.getValues();
    const att = isIntern ? values.internText : values.attendance;
    const w1 = serializeChips(h1);
    const w2 = serializeChips(h2);
    // Empty-row short-circuit.
    if (!att && !w1 && !w2 && !values.remark && !values.extraHours) { dirty.current = false; setSaveState('idle'); return; }
    saving.current = true;
    dirty.current = false; // clear before async so mid-flight edits re-mark
    const input: WorkLogInput = {
      date: dateIso, attendance: att, work1stHalf: w1, work2ndHalf: w2,
      extraHours: values.extraHours, remark: values.remark,
      ...(isManager ? { status: values.status, comments: values.comments } : {}),
    };
    try {
      await onSave(input);
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2500);
    } catch {
      setSaveState('error');
    } finally {
      saving.current = false;
      if (dirty.current) { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => void doSave(), 300); }
    }
  }

  function applyHrs() {
    const n = parseFloat(hrsInput);
    if (isNaN(n)) return;
    const snapped = Math.round(n * 2) / 2;
    const { att, extra } = calcFromHrs(snapped, isOff ? (attendance ?? '') : (attendance || 'Present'));
    form.setValue('attendance', att, { shouldDirty: true });
    form.setValue('extraHours', extra, { shouldDirty: true });
    setHrsInput('');
  }

  const addChip = (half: 1 | 2, chip: Chip) => {
    const set = half === 1 ? setH1 : setH2;
    set((prev) => (prev.some((c) => c.id === chip.id) ? prev : [...prev, chip]));
  };
  const removeChip = (half: 1 | 2, id: string) => (half === 1 ? setH1 : setH2)((prev) => prev.filter((c) => c.id !== id));

  const rowCls = [
    'wl-row',
    isToday && 'wl-row-today',
    [0, 6].includes(date.getDay()) && 'wl-row-wknd',
    attMeta?.group === 'leave' && 'wl-row-leave',
    isFuture && !isManager && 'wl-row-future',
  ].filter(Boolean).join(' ');

  return (
    <Form {...form}>
      <tr className={rowCls}>
        {/* Day */}
        <td
          className="wl-day-cell"
          style={{
            width: 72,
            verticalAlign: 'top',
            fontSize: 13,
            fontWeight: 600,
            color: '#424242',
            background: isToday ? '#e8eaf6' : '#f8f9fa',
            borderLeft: isToday ? '3px solid #1a237e' : undefined,
          }}
        >
          <div className="wl-day-name">{date.toLocaleDateString(undefined, { weekday: 'short' })} {date.getDate()}</div>
          {isToday && <div style={{ marginTop: 2, display: 'inline-block', background: '#1a237e', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 3 }}>Today</div>}
          {locked && <div style={{ fontSize: 10, color: 'var(--muted2)' }}>Upcoming</div>}
          {showsOt && <span className="wl-ot-badge" style={{ marginTop: 4, display: 'inline-block' }}>+OT</span>}
        </td>

        {/* Attendance */}
        <td className="wl-att-cell" style={{ minWidth: 150 }}>
          {isIntern ? (
            <FormField
              control={form.control}
              name="internText"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <input className="wl-inp" disabled={locked} placeholder="e.g. 9, 8.5, Holiday, Leave" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : (
            <>
              <FormField
                control={form.control}
                name="attendance"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <select
                        className="wl-inp" disabled={locked}
                        style={attMeta ? { background: attMeta.bg, color: attMeta.fg, fontWeight: 600 } : undefined}
                        {...field}
                      >
                        <option value="">—</option>
                        {ATTENDANCE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </FormControl>
                  </FormItem>
                )}
              />
              {!locked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                  <input
                    type="number" min={0} max={16} step={0.5} placeholder="Hrs"
                    className="wl-inp" style={{ width: 60 }}
                    value={hrsInput}
                    onChange={(e) => setHrsInput(e.target.value)}
                    onBlur={applyHrs}
                    onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); applyHrs(); } }}
                  />
                  {isOff && (
                    <label style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input type="checkbox" checked={offDayWorked} onChange={(e) => setOffDayWorked(e.target.checked)} /> Worked
                    </label>
                  )}
                </div>
              )}
            </>
          )}
        </td>

        {/* Work 1st / 2nd half */}
        <HalfCell half={1} chips={h1} placeholder="Custom note — 1st half…" disabled={locked} pickerItems={pickerItems} onAdd={addChip} onRemove={removeChip} />
        <HalfCell half={2} chips={h2} placeholder="Custom note — 2nd half…" disabled={locked} pickerItems={pickerItems} onAdd={addChip} onRemove={removeChip} />

        {/* Extra Hrs */}
        <td className="wl-extra-cell">
          <FormField
            control={form.control}
            name="extraHours"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input
                    type="number" min={0} max={12} step={0.5} className="wl-inp" style={{ width: 60 }} disabled={locked}
                    {...field}
                    onChange={(e) => field.onChange(Math.max(0, parseFloat(e.target.value) || 0))}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </td>

        {/* Remark */}
        <td className="wl-remark-cell">
          <FormField
            control={form.control}
            name="remark"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input className="wl-inp" placeholder="Remark…" disabled={locked} {...field} />
                </FormControl>
              </FormItem>
            )}
          />
        </td>

        {/* Status */}
        <td className="wl-status-cell">
          {isManager ? (
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <select className="wl-inp" {...field}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
                    </select>
                  </FormControl>
                </FormItem>
              )}
            />
          ) : (
            <span className={`wl-status-badge ${statusBadgeClass(status)}`}>{status || '—'}</span>
          )}
        </td>

        {/* Comments + duration */}
        <td className="wl-comments-cell">
          {isManager ? (
            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <input className="wl-inp" placeholder="Comment…" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : (
            comments && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{comments}</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
            <Icon name="schedule" size={13} /> {durationHms || '—'}
          </div>
        </td>

        {/* Save state */}
        <td className="wl-save-cell" style={{ textAlign: 'center' }}>
          <Icon
            name={saveState === 'saving' ? 'sync' : saveState === 'saved' ? 'check' : saveState === 'error' ? 'error' : 'save'}
            size={18}
            style={{ color: saveState === 'saved' ? 'var(--ok)' : saveState === 'error' ? 'var(--danger)' : 'var(--muted)', animation: saveState === 'saving' ? 'spin 0.8s linear infinite' : undefined }}
          />
        </td>
      </tr>
    </Form>
  );
}

// ─── Work-update half cell: chips + custom textarea + task/project picker ──
function HalfCell({
  half, chips, placeholder, disabled, pickerItems, onAdd, onRemove,
}: {
  half: 1 | 2; chips: Chip[]; placeholder: string; disabled: boolean;
  pickerItems: { type: 'task' | 'project'; id: string; text: string }[];
  onAdd: (half: 1 | 2, chip: Chip) => void;
  onRemove: (half: 1 | 2, id: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(half, { type: 'custom', id: `c:${t}`, text: t });
    setDraft('');
  };

  const filtered = pickerItems.filter((p) => p.text.toLowerCase().includes(search.toLowerCase()));
  const addedIds = new Set(chips.map((c) => c.id));

  return (
    <td className={`wl-h${half}-cell`} style={{ minWidth: 200 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!disabled && (
          <div style={{ position: 'relative' }}>
            <button type="button" className="wl-add-item-btn" onClick={() => setPickerOpen((v) => !v)}>
              <Icon name="add" size={13} /> Task / Project
            </button>
            {pickerOpen && (
              <div style={{ position: 'absolute', zIndex: 30, top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, boxShadow: 'var(--sh)', maxHeight: 220, overflowY: 'auto', marginTop: 2 }}>
                <input className="fc" autoFocus placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ position: 'sticky', top: 0 }} />
                {filtered.length === 0 && <div style={{ padding: 8, fontSize: 12, color: 'var(--muted)' }}>No items</div>}
                {filtered.map((p) => {
                  const added = addedIds.has(`${p.type}:${p.id}`);
                  return (
                    <div
                      key={`${p.type}:${p.id}`}
                      onClick={() => { if (!added) { onAdd(half, { type: p.type, id: `${p.type}:${p.id}`, text: p.text }); setPickerOpen(false); } }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', fontSize: 12, cursor: added ? 'default' : 'pointer', opacity: added ? 0.5 : 1 }}
                    >
                      <Icon name={p.type === 'project' ? 'folder_open' : 'task_alt'} size={14} />
                      <span style={{ flex: 1 }}>{p.text}</span>
                      {added && <Icon name="check" size={14} style={{ color: 'var(--ok)' }} />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
        {!disabled && (
          <textarea
            className="wl-cust-inp" rows={2} placeholder={placeholder} value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } }}
          />
        )}
        <div className="wl-upd-chips">
          {chips.map((c) => (
            <span
              key={c.id}
              style={{ background: '#fff3e0', border: '1px solid #ffe0b2', color: '#e65100', borderRadius: 4, padding: '3px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, margin: '0 4px 3px 0' }}
            >
              <Icon name={CHIP_ICON[c.type]} size={12} />
              <span>{c.text}</span>
              {!disabled && <span style={{ color: '#e65100', cursor: 'pointer' }} onClick={() => onRemove(half, c.id)}>×</span>}
            </span>
          ))}
        </div>
      </div>
    </td>
  );
}

export default WorkRow;
