'use client';

import { useRef, useState } from 'react';
import { useUpdateTask } from '../../../lib/api/tasks';
import { toast } from '../../../lib/toast';
import { statusPillStyle } from '../../../lib/status-styles';
import { Badge } from '../../ui/badge';
import { TASK_STATUSES } from './task-row';
import type { Task } from '../../../lib/types';

/**
 * Status pill that turns into an inline `<select>` on double-click and PATCHes the
 * task's status on change — the same double-click-to-edit affordance already used by
 * the My Tasks table (task-row.tsx), extracted here so the Dashboard's "My Upcoming
 * Tasks" widget and Plan My Week (Part 37 checklist: "Double-click a task status pill
 * -> inline status editor appears") share one implementation instead of two.
 */
export function InlineStatusPill({ task }: { task: Task }) {
  const update = useUpdateTask();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const committed = useRef(false);
  const sp = statusPillStyle(task.status);

  async function saveStatus(newStatus: string) {
    committed.current = true;
    if (newStatus === task.status) {
      setEditing(false);
      return;
    }
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

  if (editing) {
    return (
      <select
        autoFocus
        className="wl-inp"
        defaultValue={task.status}
        disabled={saving}
        style={{ border: '1.5px solid var(--p)', width: 'auto', display: 'inline-block' }}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => saveStatus(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }}
        onBlur={() => setTimeout(() => { if (!committed.current) setEditing(false); committed.current = false; }, 200)}
      >
        {TASK_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    );
  }

  return (
    <Badge
      variant="outline"
      title="Double-click to edit status"
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => { e.stopPropagation(); setEditing(true); }}
      style={{ background: sp.bg, color: sp.color, borderColor: 'transparent', cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
    >
      {task.status}
    </Badge>
  );
}

export default InlineStatusPill;
