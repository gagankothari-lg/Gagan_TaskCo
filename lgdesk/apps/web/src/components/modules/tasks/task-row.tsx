'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
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
export function priorityColor(priority: string): string {
  switch (priority) {
    case 'Critical': return '#c62828';
    case 'High': return '#e65100';
    case 'Medium': return '#1565c0';
    default: return '#9e9e9e';
  }
}

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

/** Function-mode table row (10 columns) with double-click inline status edit. */
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
      <td style={{ whiteSpace: 'nowrap', color: 'var(--muted)' }}>{fmtDate(task.createdAt, { month: 'short', day: 'numeric' })}</td>
      <td>{subFnName ? <span>{subFnName} <span style={{ color: 'var(--muted2)', fontFamily: 'monospace', fontSize: 10 }}>{task.subFnId}</span></span> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>
      <td>
        <div style={{ fontWeight: 600, color: closed ? 'var(--muted)' : 'var(--text)', textDecoration: closed ? 'line-through' : 'none' }}>{task.title}</div>
        <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'monospace' }}>{task.taskId}{task.links?.length ? ` · +${task.links.split('\n').filter(Boolean).length} link` : ''}</div>
      </td>
      <td>{task.assigneeIds.length ? <AvatarStack ids={task.assigneeIds} /> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: avatarColor(task.assignerId), color: '#fff', fontSize: 8, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{initials(empName(task.assignerId, employees))}</span>
          <span style={{ fontSize: 12 }}>{empName(task.assignerId, employees)}</span>
        </div>
      </td>
      <td>{task.recurring ? <span className="wl-chip" style={{ margin: 0 }}><Icon name="autorenew" size={12} /> Recurring</span> : <span style={{ color: 'var(--muted2)' }}>—</span>}</td>

      {/* Status — double-click inline edit */}
      <td onClick={stop} onDoubleClick={() => setEditing(true)} title="Double-click to edit status" style={{ opacity: saving ? 0.5 : 1 }}>
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

      <td>{(() => { const pd = priorityDisplay(task.priority); return <span style={{ color: pd.color, fontWeight: 600, fontSize: 12 }}>{pd.label}</span>; })()}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {task.dueDate ? (
          <span style={{ color: overdue ? 'var(--danger)' : 'var(--muted)', fontSize: 12, textDecoration: closed ? 'line-through' : 'none' }}>
            {overdue ? 'Overdue · ' : ''}{fmtDate(task.dueDate, { month: 'short', day: 'numeric' })}
          </span>
        ) : <span style={{ color: 'var(--muted2)' }}>—</span>}
      </td>
      <td onClick={stop} style={{ whiteSpace: 'nowrap' }}>
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
