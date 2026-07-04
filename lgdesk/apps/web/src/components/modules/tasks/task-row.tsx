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
import { statusDot, priorityDisplay, statusPillStyle } from '../../../lib/status-styles';
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

// Leftmost 4px priority-bar colour (reference: `.ts-pribar.p-<Priority>`).
// Medium standardized to #3949ab app-wide (matches lib/status-styles.ts priorityDisplay()).
export function priorityBarColor(priority: string): string {
  switch (priority) {
    case 'Critical': return 'var(--danger)';
    case 'High': return 'var(--warn)';
    case 'Medium': return '#3949ab';
    case 'Low': return 'var(--muted2)';
    default: return 'transparent';
  }
}

// Responsive column-hide classes shared with task-list-view.tsx's <th> header/filter
// cells, so <td> and <th> stay in lockstep at every breakpoint (single source of truth).
// Cascade mirrors the GAS reference's 3-tier column hiding (1024px/960px/768px media
// queries), approximated onto Tailwind's default lg(1024)/md(768) breakpoints:
// at <768px only Sub-Function, Task, Status, Actions (+ the priority bar) remain — 5
// columns total, matching the reference's mobile comment exactly.
export const COL_HIDE = {
  function: 'hidden lg:table-cell',
  subFn: '',
  task: '',
  assignee: 'hidden md:table-cell',
  assigner: 'hidden lg:table-cell',
  project: 'hidden lg:table-cell',
  status: '',
  priority: 'hidden md:table-cell',
  due: 'hidden md:table-cell',
} as const;

// Sticky last (Actions) column — reference `.ts-actions-cell` / `.task-sheet thead
// th:last-child`.
export const stickyActionsStyle = (bg: string): CSSProperties => ({
  position: 'sticky', right: 0, background: bg, zIndex: 1, boxShadow: '-2px 0 6px rgba(0,0,0,.04)',
});

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

/** Function-mode table row (task-sheet: priority-bar + 8 data columns + actions) with double-click inline status edit. */
export function TaskRow({ task, onOpen, onEdit }: { task: Task; onOpen: (id: string) => void; onEdit: (id: string) => void }) {
  const { currentUser, employees, functions, projects } = useAuth();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const canEdit = canEditTask(currentUser, task);
  const canDelete = canDeleteTask(currentUser, task);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const committed = useRef(false);

  const overdue = isTaskOverdue(task);
  const closed = CLOSED.includes(task.status);
  const fnName = functions.find((f) => f.functionId === task.functionId)?.name;
  const subFnName = functions.find((f) => f.functionId === task.subFnId)?.name;
  const projName = projects.find((p) => p.projId === task.projId)?.name;
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
      {/* Leftmost 4px priority-bar column (reference: ts-pribar) */}
      <td style={{ padding: 0, width: 4, minWidth: 4, maxWidth: 4, background: priorityBarColor(task.priority) }} />
      <td className={COL_HIDE.function}>{fnName ? <span>{fnName}</span> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>
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
      <td className={COL_HIDE.project}>{projName ? <span>{projName}</span> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>

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

      <td className={COL_HIDE.priority}>{(() => { const pd = priorityDisplay(task.priority); return <span style={{ color: pd.color, fontWeight: 600, fontSize: 12 }}>{pd.label}</span>; })()}</td>
      <td className={COL_HIDE.due} style={{ whiteSpace: 'nowrap' }}>
        {task.dueDate ? (
          <span style={{ color: overdue ? 'var(--danger)' : 'var(--muted)', fontSize: 12, textDecoration: closed ? 'line-through' : 'none' }}>
            {overdue ? 'Overdue · ' : ''}{fmtDate(task.dueDate, { month: 'short', day: 'numeric' })}
          </span>
        ) : <span style={{ color: 'var(--muted2)' }}>—</span>}
      </td>
      <td onClick={stop} style={{ ...stickyActionsStyle('var(--surface)'), whiteSpace: 'nowrap' }}>
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
