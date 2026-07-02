'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { Form, FormControl, FormField, FormItem } from '../../ui/form';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { workRowSchema, type WorkRowFormValues } from './work-row.schema';
import { defaultAttendanceFor, isInternOff, isoDate, LEAVE_REQUESTED_OPTIONS, LEAVE_TYPE_OPTIONS } from '../../../lib/attendance';
import { useSetWorkLogComment, useSetWorkLogStatus } from '../../../lib/api/workLog';
import { ApiError, apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
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
const LEAVE_TYPES = ['Leave Full Day', 'Leave Half Day'];
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

// Effective hours implied by a saved attendance + extra hours (used to pre-fill the Hrs
// quick-entry box for saved rows — Part 37 "Hrs input pre-fills from saved _attEffHours").
function effHoursFor(att: string, extra: number): number {
  const base = att === 'Present' || att === 'Extra Full Day' ? 9 : att === 'Extra Half Day' || att === 'Leave Half Day' ? 4 : 0;
  return base + (extra || 0);
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

// Live preview text for the Hrs quick-entry box (Part 16 "Hours Calculator").
function hrsPreview(raw: string, isOff: boolean, attendance: string): string {
  if (!raw.trim()) return '';
  const n = parseFloat(raw);
  if (isNaN(n) || n < 0 || n > 19) return '→ invalid';
  const snapped = Math.round(n * 2) / 2;
  if (snapped !== n) return `→ round to ${snapped}h`;
  const base = isOff ? (attendance || 'Week Off') : (attendance || 'Present');
  const { att, extra } = calcFromHrs(snapped, base);
  return extra > 0 ? `→ ${att} +${extra}h` : `→ ${att}`;
}

type Chip = { type: 'task' | 'project' | 'custom' | 'meeting'; id: string; text: string };
const CHIP_ICON: Record<Chip['type'], string> = { task: 'task_alt', project: 'folder_open', custom: 'edit_note', meeting: 'video_call' };

function parseChips(saved?: string | null): Chip[] {
  if (!saved) return [];
  return saved.split('; ').map((t) => t.trim()).filter(Boolean).map((t) => ({ type: 'custom' as const, id: `c:${t}`, text: t.replace(/\\n/g, '\n') }));
}
function serializeChips(chips: Chip[]): string {
  return chips.map((c) => c.text.replace(/\n/g, '\\n')).join('; ');
}

export interface WorkRowHandle {
  /** Commit any pending textarea drafts as chips and flush a save if the row is dirty. */
  flush: () => void;
}

export interface WorkRowProps {
  date: Date;
  entry?: WorkLogEntry;
  /** Whose row this is — self for the personal grid, the viewed member in the team modal. */
  empId: string;
  isIntern: boolean;
  isManager: boolean;
  locked: boolean; // future date, non-manager
  /** True when `date` is in the org holiday list (Part 29 default pre-fill rule). */
  isHoliday?: boolean;
  durationHms: string;
  pickerItems: { type: 'task' | 'project'; id: string; text: string }[];
  onSave: (input: WorkLogInput) => Promise<unknown>;
}

export const WorkRow = forwardRef<WorkRowHandle, WorkRowProps>(function WorkRow(
  { date, entry, empId, isIntern, isManager, locked, isHoliday, durationHms, pickerItems, onSave },
  ref,
) {
  const dateIso = isoDate(date);
  const today = isoDate(new Date());
  const isToday = dateIso === today;
  const isFuture = dateIso > today;

  // Part 29: default pre-fill for a day with no saved log yet (Sunday/alt-Saturday/holiday).
  const defaultAtt = !entry ? defaultAttendanceFor(date, !!isHoliday) : '';

  const form = useForm<WorkRowFormValues>({
    resolver: zodResolver(workRowSchema),
    defaultValues: {
      attendance: entry?.attendance ?? defaultAtt,
      internText: entry?.attendance ?? '',
      purpose: entry?.purpose ?? '',
      leaveRequested: entry?.leaveRequested ?? '',
      extraHours: entry?.extraHours ?? 0,
      remark: entry?.remark ?? '',
      status: entry?.status ?? '',
      comments: entry?.comments ?? '',
    },
  });
  const { attendance, internText, purpose, leaveRequested, extraHours, remark, status, comments } = form.watch();

  // Chip lists, the off-day "Worked" checkbox, and the quick-entry hours box are UI
  // mechanics with no validation rule of their own — kept as plain state (not lifted
  // into the zod-validated form) so the debounced auto-save contract below stays simple.
  const [h1, setH1] = useState<Chip[]>(() => parseChips(entry?.work1stHalf));
  const [h2, setH2] = useState<Chip[]>(() => parseChips(entry?.work2ndHalf));
  const initialOff = entry ? OFF_TYPES.includes(entry.attendance) : OFF_TYPES.includes(defaultAtt);
  const initialInternOff = isIntern && isInternOff(entry?.attendance ?? '');
  const [offDayWorked, setOffDayWorked] = useState(
    () => (initialOff || initialInternOff) && !!((entry?.extraHours ?? 0) > 0 || entry?.work1stHalf || entry?.work2ndHalf),
  );
  // Pre-fill from the saved effective hours (blank for an unsaved row — meeting-derived
  // pre-fill is a Meetings-module integration and out of this phase's scope). The preview
  // text stays hidden until the user actually edits it, so a freshly loaded saved row
  // doesn't show a redundant "→ Present" caption under every day.
  const [hrsInput, setHrsInput] = useState(() => (entry ? String(effHoursFor(entry.attendance, entry.extraHours ?? 0)) : ''));
  const [hrsTouched, setHrsTouched] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const hydrating = useRef(true);
  const saving = useRef(false);
  const dirty = useRef(false);
  const retried = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const h1Ref = useRef<HalfCellHandle>(null);
  const h2Ref = useRef<HalfCellHandle>(null);

  const setStatus = useSetWorkLogStatus();
  const setComment = useSetWorkLogComment();

  const attMeta = WL_ATTENDANCE_STYLES[attendance ?? ''];
  const isOff = isIntern ? isInternOff(internText ?? '') : OFF_TYPES.includes(attendance ?? '');
  const isLeaveType = !isIntern && LEAVE_TYPES.includes(attendance ?? '');
  const showsOt = ALWAYS_OT.includes(attendance ?? '') || (isOff && offDayWorked) || (extraHours ?? 0) > 0;
  // Off-day / off-pattern fields stay disabled until "Worked today" is checked.
  const fieldsDisabled = locked || (isOff && !offDayWorked);

  // Reset the "worked today" override whenever the day stops being an off day/pattern.
  useEffect(() => {
    if (!isOff) setOffDayWorked(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOff]);

  const signature = useMemo(
    () =>
      JSON.stringify({
        a: isIntern ? internText : attendance,
        p: purpose, lr: leaveRequested,
        w1: serializeChips(h1), w2: serializeChips(h2),
        e: extraHours, r: remark, s: status, c: comments,
      }),
    [attendance, internText, purpose, leaveRequested, isIntern, h1, h2, extraHours, remark, status, comments],
  );

  // Debounced auto-save. The hydrating guard prevents a false save on initial mount.
  useEffect(() => {
    if (hydrating.current) { hydrating.current = false; return; }
    if (locked) return;
    dirty.current = true;
    retried.current = false; // a fresh edit earns a fresh single auto-retry-on-failure
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
    // Leave Full Day has no work content, on either half — force-clear on the wire
    // even if stale chips are still sitting in local state (Part 37 member-modal rule).
    const forceEmptyWork = att === 'Leave Full Day';
    const w1 = forceEmptyWork ? '' : serializeChips(h1);
    const w2 = forceEmptyWork ? '' : serializeChips(h2);
    // Empty-row short-circuit.
    if (!att && !w1 && !w2 && !values.remark && !values.extraHours) { dirty.current = false; setSaveState('idle'); return; }
    saving.current = true;
    dirty.current = false; // clear before async so mid-flight edits re-mark
    const input: WorkLogInput = {
      date: dateIso, attendance: att,
      ...(isIntern ? {} : { purpose: isLeaveType ? values.purpose : '', leaveRequested: isLeaveType ? values.leaveRequested : '' }),
      work1stHalf: w1, work2ndHalf: w2,
      extraHours: values.extraHours, remark: values.remark,
      ...(isManager ? { status: values.status, comments: values.comments } : {}),
    };
    try {
      await onSave(input);
      setSaveState('saved');
      retried.current = false;
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 2500);
    } catch {
      setSaveState('error');
      dirty.current = true; // the content never persisted — still eligible for one retry
    } finally {
      saving.current = false;
      if (dirty.current && !retried.current) {
        retried.current = true;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void doSave(), 300);
      }
    }
  }

  // Manual Save (Part 37 "Save button + auto-save state machine"): bypasses the debounce
  // and enforces the off-day min-2hr guard before persisting.
  function manualSave() {
    if (isOff && offDayWorked && (extraHours ?? 0) < 2) {
      toast('Min 2 hrs required when working on an off day.', 'warn');
      return;
    }
    if (timer.current) clearTimeout(timer.current);
    dirty.current = true;
    void doSave();
  }

  // Flush pending edits before the parent navigates away (Part 16 "_wlCommitAllTextareas").
  useImperativeHandle(ref, () => ({
    flush: () => {
      const p1 = h1Ref.current?.commitPending();
      const p2 = h2Ref.current?.commitPending();
      if (p1) addChip(1, { type: 'custom', id: `c:${p1}`, text: p1 });
      if (p2) addChip(2, { type: 'custom', id: `c:${p2}`, text: p2 });
      const hadPending = !!timer.current || dirty.current;
      if (timer.current) { clearTimeout(timer.current); timer.current = null; }
      if (p1 || p2 || hadPending) {
        dirty.current = true;
        setTimeout(() => void doSave(), 0);
      }
    },
  }));

  function applyHrs() {
    const n = parseFloat(hrsInput);
    if (isNaN(n) || n < 0 || n > 19) { setHrsInput(''); return; }
    const snapped = Math.round(n * 2) / 2;
    const base = isOff ? (attendance ?? '') : (attendance || 'Present');
    const { att, extra } = calcFromHrs(snapped, base);
    form.setValue('attendance', att, { shouldDirty: true });
    form.setValue('extraHours', extra, { shouldDirty: true });
    setHrsInput('');
  }

  const addChip = (half: 1 | 2, chip: Chip) => {
    const set = half === 1 ? setH1 : setH2;
    set((prev) => (prev.some((c) => c.id === chip.id) ? prev : [...prev, chip]));
  };
  const removeChip = (half: 1 | 2, id: string) => (half === 1 ? setH1 : setH2)((prev) => prev.filter((c) => c.id !== id));

  // Uncheck "Worked today" -> clear work content for the off day (Part 37).
  function toggleOffWorked(checked: boolean) {
    setOffDayWorked(checked);
    if (!checked) {
      setH1([]);
      setH2([]);
      form.setValue('extraHours', 0, { shouldDirty: true });
    }
  }

  function onStatusChange(next: string) {
    form.setValue('status', next, { shouldDirty: true });
    if (!entry?.logId) {
      toast('Status will be saved when you click Save.', 'info');
      return;
    }
    setStatus.mutate({ empId, date: dateIso, status: next });
  }

  function onCommentsBlur(next: string) {
    if (!entry?.logId) return; // covered by the normal debounced row-save instead
    if ((entry.comments ?? '') === next) return;
    setComment.mutate(
      { empId, date: dateIso, comment: next },
      { onError: (err) => { if (!(err instanceof ApiError) || err.status !== 404) toast(apiErrorMessage(err, 'Unable to save comment'), 'error'); } },
    );
  }

  const rowCls = [
    'wl-row',
    isToday && 'wl-row-today',
    [0, 6].includes(date.getDay()) && 'wl-row-wknd',
    attMeta?.group === 'leave' && 'wl-row-leave',
    isFuture && !isManager && 'wl-row-future',
  ].filter(Boolean).join(' ');

  const parsedInternHrs = parseFloat(internText ?? '');
  const internHrsLabel = (internText ?? '').trim() && !isNaN(parsedInternHrs) ? `${parsedInternHrs} hrs` : '';

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
          {showsOt && <span id={`wl-ot-badge-${dateIso}`} className="wl-ot-badge" style={{ marginTop: 4, display: 'inline-block' }}>+OT</span>}
        </td>

        {/* Attendance */}
        <td className="wl-att-cell" style={{ minWidth: 150 }}>
          {isIntern ? (
            <>
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
              {!locked && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  {internHrsLabel && <span id={`wl-intern-hrs-${dateIso}`} style={{ fontSize: 11, color: 'var(--muted)' }}>{internHrsLabel}</span>}
                  {isOff && (
                    <label style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <input type="checkbox" checked={offDayWorked} onChange={(e) => toggleOffWorked(e.target.checked)} /> Worked today
                    </label>
                  )}
                </div>
              )}
            </>
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="number" min={0} max={19} step={0.5} placeholder="Hrs"
                      className="wl-inp" style={{ width: 60 }}
                      value={hrsInput}
                      onChange={(e) => { setHrsInput(e.target.value); setHrsTouched(true); }}
                      onBlur={applyHrs}
                      onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); applyHrs(); } }}
                    />
                    {isOff && (
                      <label style={{ fontSize: 10, color: 'var(--muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <input type="checkbox" checked={offDayWorked} onChange={(e) => toggleOffWorked(e.target.checked)} /> Worked
                      </label>
                    )}
                  </div>
                  {hrsTouched && hrsInput && <span style={{ fontSize: 10, color: 'var(--muted)' }}>{hrsPreview(hrsInput, isOff, attendance ?? '')}</span>}
                </div>
              )}
            </>
          )}
        </td>

        {/* Work 1st / 2nd half */}
        <HalfCell
          ref={h1Ref} half={1} chips={h1} placeholder="Custom note — 1st half…" disabled={fieldsDisabled}
          pickerItems={pickerItems} onAdd={addChip} onRemove={removeChip}
          leaveSelect={isLeaveType ? {
            show: true, replace: attendance === 'Leave Full Day', label: 'Leave Type',
            value: purpose ?? '', options: LEAVE_TYPE_OPTIONS,
            onChange: (v) => form.setValue('purpose', v, { shouldDirty: true }),
          } : undefined}
        />
        <HalfCell
          ref={h2Ref} half={2} chips={h2} placeholder="Custom note — 2nd half…" disabled={fieldsDisabled}
          pickerItems={pickerItems} onAdd={addChip} onRemove={removeChip}
          leaveSelect={isLeaveType ? {
            show: true, replace: attendance === 'Leave Full Day', label: 'Leave Requested',
            value: leaveRequested ?? '', options: LEAVE_REQUESTED_OPTIONS,
            onChange: (v) => form.setValue('leaveRequested', v, { shouldDirty: true }),
          } : undefined}
        />

        {/* Extra Hrs */}
        <td className="wl-extra-cell">
          <FormField
            control={form.control}
            name="extraHours"
            render={({ field }) => (
              <FormItem>
                <FormControl>
                  <input
                    type="number" min={0} max={12} step={0.5} className="wl-inp" style={{ width: 60 }} disabled={fieldsDisabled}
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
            <select id={`wl-st-${dateIso}`} className="wl-inp" value={status ?? ''} onChange={(e) => onStatusChange(e.target.value)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s || '—'}</option>)}
            </select>
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
                    <input
                      id={`wl-ac-${dateIso}`} className="wl-inp" placeholder="Admin notes…" {...field}
                      onBlur={(e) => { field.onBlur(); onCommentsBlur(e.target.value); }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          ) : (
            comments && <span className="wl-admin-note" style={{ fontSize: 12, color: 'var(--muted)' }}>{comments}</span>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11, color: 'var(--muted)' }}>
            <Icon name="schedule" size={13} /> <span id={`wl-dur-${dateIso}`}>{durationHms || '—'}</span>
          </div>
        </td>

        {/* Save state */}
        <td className="wl-save-cell" style={{ textAlign: 'center' }}>
          {isIntern ? (
            <Icon
              name={saveState === 'saving' ? 'sync' : saveState === 'saved' ? 'check' : saveState === 'error' ? 'error' : 'save'}
              size={18}
              style={{ color: saveState === 'saved' ? 'var(--ok)' : saveState === 'error' ? 'var(--danger)' : 'var(--muted)', animation: saveState === 'saving' ? 'spin 0.8s linear infinite' : undefined }}
            />
          ) : (
            <button
              type="button" id={`wl-save-btn-${dateIso}`} className="wl-save-btn"
              disabled={saveState === 'saving'} onClick={manualSave} aria-label="Save row"
            >
              <Icon
                name={saveState === 'saving' ? 'sync' : saveState === 'saved' ? 'check' : saveState === 'error' ? 'error' : 'save'}
                size={18}
                style={{ color: saveState === 'saved' ? 'var(--ok)' : saveState === 'error' ? 'var(--danger)' : 'var(--muted)', animation: saveState === 'saving' ? 'spin 0.8s linear infinite' : undefined }}
              />
            </button>
          )}
          <div id={`wl-as-${dateIso}`} style={{ fontSize: 9, marginTop: 2, color: saveState === 'saved' ? 'var(--ok)' : saveState === 'error' ? 'var(--danger)' : 'var(--muted)' }}>
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'Saved ✓'}
            {saveState === 'error' && 'Save failed'}
          </div>
        </td>
      </tr>
    </Form>
  );
});

export default WorkRow;

// ─── Work-update half cell: chips + custom textarea + task/project picker ──
interface HalfCellHandle { commitPending: () => string | null }
interface LeaveSelectProps {
  show: boolean;
  replace: boolean;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

const HalfCell = forwardRef<HalfCellHandle, {
  half: 1 | 2; chips: Chip[]; placeholder: string; disabled: boolean;
  pickerItems: { type: 'task' | 'project'; id: string; text: string }[];
  onAdd: (half: 1 | 2, chip: Chip) => void;
  onRemove: (half: 1 | 2, id: string) => void;
  leaveSelect?: LeaveSelectProps;
}>(function HalfCell({ half, chips, placeholder, disabled, pickerItems, onAdd, onRemove, leaveSelect }, ref) {
  const [draft, setDraft] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    commitPending: () => {
      const t = draft.trim();
      if (!t) return null;
      setDraft('');
      return t;
    },
  }));

  const commit = () => {
    const t = draft.trim();
    if (!t) return;
    onAdd(half, { type: 'custom', id: `c:${t}`, text: t });
    setDraft('');
  };

  const editChip = (c: Chip) => {
    if (c.type !== 'custom') return;
    setDraft(c.text);
    onRemove(half, c.id);
    textareaRef.current?.focus();
  };

  const filtered = pickerItems.filter((p) => p.text.toLowerCase().includes(search.toLowerCase()));
  const addedIds = new Set(chips.map((c) => c.id));
  const showChipUi = !leaveSelect?.replace;

  return (
    <td className={`wl-h${half}-cell`} style={{ minWidth: 200 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {leaveSelect?.show && (
          <select
            className="wl-inp" disabled={disabled} value={leaveSelect.value}
            onChange={(e) => leaveSelect.onChange(e.target.value)}
            aria-label={leaveSelect.label}
          >
            {leaveSelect.options.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
          </select>
        )}
        {showChipUi && !disabled && (
          <Popover open={pickerOpen} onOpenChange={(o) => { setPickerOpen(o); if (o) setSearch(''); }}>
            <PopoverTrigger asChild>
              <button type="button" className="wl-add-item-btn">
                <Icon name="add" size={13} /> Task / Project
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64 p-0">
              <input
                className="fc" autoFocus placeholder="Search…" value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: 8 }}
              />
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
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
            </PopoverContent>
          </Popover>
        )}
        {showChipUi && !disabled && (
          <textarea
            ref={textareaRef}
            className="wl-cust-inp" rows={2} placeholder={placeholder} value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); } }}
          />
        )}
        {showChipUi && (
          <div className="wl-upd-chips">
            {chips.map((c) => (
              <span
                key={c.id}
                style={{ background: '#fff3e0', border: '1px solid #ffe0b2', color: '#e65100', borderRadius: 4, padding: '3px 8px', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4, margin: '0 4px 3px 0' }}
              >
                <Icon name={CHIP_ICON[c.type]} size={12} />
                <span style={{ cursor: !disabled && c.type === 'custom' ? 'pointer' : 'default' }} onClick={() => editChip(c)}>{c.text}</span>
                {!disabled && <span style={{ color: '#e65100', cursor: 'pointer' }} onClick={() => onRemove(half, c.id)}>×</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </td>
  );
});
