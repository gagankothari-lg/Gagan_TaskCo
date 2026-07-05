'use client';

import { useRef, useState, type KeyboardEvent, type CSSProperties } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useUpdateTask, useDeleteTask } from '../../../lib/api/tasks';
import { canDeleteTask, canEditTask } from '../../../lib/rbac';
import { toast } from '../../../lib/toast';
import { Icon } from '../../ui/icon';
import { Badge } from '../../ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { avatarColor, initials, statusDotColor as dotColor, fmtDate } from '../../../lib/utils';
import { statusDot, statusPillStyle } from '../../../lib/status-styles';
import { TASK_STATUSES } from './create-task-modal.schema';
import type { Task, User } from '../../../lib/types';

const CLOSED = ['Done', 'Cancelled'];
export { TASK_STATUSES };

export function isTaskOverdue(task: Pick<Task, 'dueDate' | 'status'>): boolean {
  if (!task.dueDate || CLOSED.includes(task.status)) return false;
  const due = new Date(task.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return due < today;
}
export function isDueToday(dueDate?: string): boolean {
  if (!dueDate) return false;
  const d = new Date(dueDate);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

// Back-compat wrappers (old signatures) for task-detail-modal + plan-week.
export function statusDotColor(status: string, overdue: boolean): string {
  return dotColor(status, { overdue });
}

// FIX B (task-sheet rebuild): there is no priority-bar anywhere in the live reference
// app — the only function that would ever emit a `.ts-pribar` cell (`_renderTskSheet`,
// app.js.html:9424) has zero callers. Priority is instead an icon + colored-text label
// in a normal column (8th of 9, after Status, before Due date) — exact values from
// `_tskGrpPriorityHtml` (app.js.html:5212-5216). These are literal hex values confirmed
// from the reference's own live rendering, not this app's indigo brand tokens — used
// as-is since this is a data-status indicator, not a brand element.
const TASK_PRIORITY_DISPLAY: Record<string, { icon: string; color: string }> = {
  Critical: { icon: '⬆', color: '#dc2626' },
  High: { icon: '↑', color: '#dc2626' },
  Medium: { icon: '→', color: '#d97706' },
  Low: { icon: '↓', color: '#16a34a' },
};
export function taskPriorityDisplay(priority: string): { icon: string; color: string } {
  return TASK_PRIORITY_DISPLAY[priority] ?? { icon: '–', color: '#94a3b8' };
}

// Responsive column-hide classes shared with task-list-view.tsx's <th> header/filter
// cells, so <td> and <th> stay in lockstep at every breakpoint (single source of truth).
// FIX A (PVERIFY-FULL-APP-PARITY Part B, task-sheet rebuild): column set corrected to
// match the reference's real 9-column `_TSK_COL_SPEC` (app.js.html:677-688, cited in
// CLAUDE.md's "task-sheet markup is largely dead code" note) — Assigned date,
// Sub-Function, Task, Assigned To, Assigned By, Recurring, Status, Priority, Due date
// (+ Actions). Function is a collapsible group header, not a column (unchanged,
// see FunctionGroup in task-list-view.tsx); there is no Project column at all —
// Project remains available only as a filter field (filter-bar.tsx), never a column.
// At <768px only Sub-Function, Task, Status, Actions remain — 4 columns + Actions,
// matching the reference's mobile comment.
export const COL_HIDE = {
  adate: 'hidden lg:table-cell',
  subFn: '',
  task: '',
  assignee: 'hidden md:table-cell',
  assigner: 'hidden lg:table-cell',
  recurring: 'hidden lg:table-cell',
  status: '',
  priority: 'hidden md:table-cell',
  due: 'hidden md:table-cell',
} as const;

// Last (Actions) column background helper. FIX C (task-sheet rebuild): NOT sticky —
// nothing in the live reference app is sticky (the static CSS's `position:sticky`
// rules, lgdesk-gas-source.html:319,371, are attached to the dead <thead> the JS
// deletes at runtime; the live per-group table CSS, `_tskGrpInjectCss`,
// app.js.html:5046-5101, has zero `position:sticky` rules).
export const actionsCellStyle = (bg: string): CSSProperties => ({ background: bg });

function empName(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}` : empId;
}

function AvatarStack({ ids }: { ids: string[] }) {
  const { employees } = useAuth();
  const shown = ids.slice(0, 3);
  const extra = ids.length - shown.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      {shown.map((id, i) => (
        <div key={id} title={empName(id, employees)}
          style={{ width: 22, height: 22, borderRadius: '50%', background: avatarColor(id), color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--surface)', marginLeft: i ? -6 : 0 }}>
          {initials(empName(id, employees))}
        </div>
      ))}
      {extra > 0 && <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'var(--border)', color: 'var(--muted)', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -6 }}>+{extra}</div>}
    </div>
  );
}

/** Function-mode table row (task-sheet: 9 data columns + actions, no priority bar — FIX B) with double-click inline status edit. */
export function TaskRow({ task, onOpen, onEdit }: { task: Task; onOpen: (id: string) => void; onEdit: (id: string) => void }) {
  const { currentUser, employees, functions } = useAuth();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const canEdit = canEditTask(currentUser, task);
  const canDelete = canDeleteTask(currentUser, task);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const committed = useRef(false);

  const overdue = isTaskOverdue(task);
  const closed = CLOSED.includes(task.status);
  const subFnName = functions.find((f) => f.functionId === task.subFnId)?.name;
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  async function saveStatus(newStatus: string) {
    committed.current = true;
    if (newStatus === task.status) { setEditing(false); return; }
    setSaving(true);
    try {
      await update.mutateAsync({ taskId: task.taskId, dto: { status: newStatus } });
      toast('Status updated', 'success');
    } catch {
      toast('Could not update status', 'error');
    } finally {
      setSaving(false);
      setEditing(false);
    }
  }

  async function remove() {
    if (confirm(`Delete ${task.taskId}?`)) {
      try {
        await del.mutateAsync(task.taskId);
        toast('Task deleted', 'success');
      } catch {
        toast('Could not delete task', 'error');
      }
    }
  }

  const sp = statusPillStyle(task.status);

  return (
    <tr onClick={() => onOpen(task.taskId)} className={closed ? 'tsk-row-closed' : undefined} style={{ cursor: 'pointer' }}>
      <td className={COL_HIDE.adate} style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--muted)' }}>{fmtDate(task.createdAt, { month: 'short', day: 'numeric' })}</td>
      <td className={COL_HIDE.subFn}>{subFnName ? <span>{subFnName} <span style={{ color: 'var(--muted2)', fontFamily: 'monospace', fontSize: 10 }}>{task.subFnId}</span></span> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>
      <td className={COL_HIDE.task}>
        <div style={{ fontWeight: 600, color: closed ? 'var(--muted)' : 'var(--text)', textDecoration: closed ? 'line-through' : 'none' }}>{task.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'monospace' }}>{task.taskId}{task.links?.length ? ` · +${task.links.split('\n').filter(Boolean).length} link` : ''}</div>
      </td>
      <td className={COL_HIDE.assignee}>{task.assigneeIds.length ? <AvatarStack ids={task.assigneeIds} /> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>
      <td className={COL_HIDE.assigner} style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: avatarColor(task.assignerId), color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(empName(task.assignerId, employees))}</span>
          <span style={{ fontSize: 12 }}>{empName(task.assignerId, employees)}</span>
        </div>
      </td>
      {/* Recurring — interim schema-safe stand-in: `Task.recurring` is currently a plain
          Boolean (no migration needed). The reference's real field is a 5-value cadence
          dropdown (One Time/Daily/Weekly/Monthly/Quarterly, app.js.html:10480-10485),
          which needs a `recurrencePattern` schema migration not yet authorized — see
          CLAUDE.md / AUDIT_REPORT.md A2. This Yes/No display is a simplified placeholder
          until that migration decision is made. */}
      <td className={COL_HIDE.recurring} style={{ fontSize: 12 }}>
        {task.recurring ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--p)' }}><Icon name="autorenew" size={13} /> Yes</span>
        ) : (
          <span style={{ color: 'var(--muted2)' }}>No</span>
        )}
      </td>

      {/* Status — double-click inline edit */}
      <td className={COL_HIDE.status} onClick={stop} onDoubleClick={() => setEditing(true)} title="Double-click to edit status" style={{ opacity: saving ? 0.5 : 1 }}>
        {editing ? (
          <select
            autoFocus className="wl-inp" defaultValue={task.status} disabled={saving}
            style={{ border: '1.5px solid var(--p)' }}
            onChange={(e) => saveStatus(e.target.value)}
            onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Escape') setEditing(false); }}
            onBlur={() => setTimeout(() => { if (!committed.current) setEditing(false); committed.current = false; }, 200)}
          >
            {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          <Badge style={{ background: sp.bg, color: sp.color, borderColor: 'transparent' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot(task.status, overdue) }} /> {task.status}
          </Badge>
        )}
      </td>

      <td className={COL_HIDE.priority}>
        {(() => {
          const pd = taskPriorityDisplay(task.priority);
          return (
            <span style={{ color: pd.color, fontWeight: 600, fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <span aria-hidden="true">{pd.icon}</span>{task.priority}
            </span>
          );
        })()}
      </td>
      <td className={COL_HIDE.due} style={{ whiteSpace: 'nowrap' }}>
        {task.dueDate ? (
          <span style={{ color: overdue ? 'var(--danger)' : 'var(--muted)', fontSize: 12, textDecoration: closed ? 'line-through' : 'none' }}>
            {overdue ? 'Overdue · ' : ''}{fmtDate(task.dueDate, { month: 'short', day: 'numeric' })}
          </span>
        ) : <span style={{ color: 'var(--muted2)' }}>—</span>}
      </td>
      <td onClick={stop} style={{ ...actionsCellStyle('var(--surface)'), whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', gap: 2 }}>
          <button className="wl-save-btn" title="Open" onClick={() => onOpen(task.taskId)}><Icon name="open_in_new" size={16} /></button>
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="wl-save-btn" title="More actions" aria-label="More actions"><Icon name="more_vert" size={16} /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                {canEdit && (
                  <DropdownMenuItem onSelect={() => onEdit(task.taskId)}>
                    <Icon name="edit" size={14} /> Edit
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem destructive onSelect={remove}>
                    <Icon name="delete" size={14} /> Delete
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </td>
    </tr>
  );
}

export default TaskRow;
