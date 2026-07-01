'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin } from '../../../lib/auth';
import { canDeleteTask, canEditTask, canLogTaskProgress } from '../../../lib/rbac';
import { useTask, useDeleteTask, useProgressUpdates, useAddProgress } from '../../../lib/api/tasks';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';
import { Badge } from '../../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormMessage } from '../../ui/form';
import { DdrModal } from './ddr-modal';
import { TaskEditModal } from './task-edit-modal';
import { fieldClass } from './create-task-modal';
import { addProgressSchema, type AddProgressFormValues } from './task-detail-modal.schema';
import { avatarColor, initials, fmtDate } from '../../../lib/utils';
import { statusPillStyle, priorityDisplay } from '../../../lib/status-styles';
import { isTaskOverdue } from './task-row';

interface TaskDetailModalProps {
  taskId: string | null;
  onClose: () => void;
}

function empName(empId: string, employees: { empId: string; firstName: string; lastName: string }[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}` : empId;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trimEnd()}…` : s;
}

/**
 * Task Detail modal — a single shared, read-only view component (Part 13's exact
 * field/action inventory). Reused as-is from every caller that needs to show a task
 * (My Tasks, Plan My Week, and Team/All Tasks built in later phases) — nothing here is
 * per-caller state, so there is exactly one implementation to keep in sync.
 * Editing happens in the separate <TaskEditModal>, opened via the pencil button.
 */
export function TaskDetailModal({ taskId, onClose }: TaskDetailModalProps) {
  const { currentUser, employees, projects, functions, attCounts } = useAuth();
  const { data: task, isLoading } = useTask(taskId);
  const { data: progress } = useProgressUpdates(taskId);
  const del = useDeleteTask();
  const addProgress = useAddProgress();

  const [error, setError] = useState<string | null>(null);
  const [ddrOpen, setDdrOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);

  const progressForm = useForm<AddProgressFormValues>({
    resolver: zodResolver(addProgressSchema),
    defaultValues: { description: '', hoursLogged: '', blockers: '' },
  });

  if (!taskId) return null;

  const canEdit = task ? canEditTask(currentUser, task) : false;
  const canDelete = task ? canDeleteTask(currentUser, task) : false;
  const canProgress = task ? canLogTaskProgress(currentUser, task) : false;
  const overdue = task ? isTaskOverdue(task) : false;
  const admin = currentUser ? isAdmin(currentUser.role) : false;
  const isAssigner = task && currentUser ? task.assignerId === currentUser.empId : false;
  const showRequestChange = task && !admin && !isAssigner;
  const attCount = task ? attCounts[task.taskId] ?? 0 : 0;

  const project = task?.projId ? projects.find((p) => p.projId === task.projId) : undefined;
  const fn = task?.functionId ? functions.find((f) => f.functionId === task.functionId) : undefined;
  const subFn = task?.subFnId ? functions.find((f) => f.functionId === task.subFnId) : undefined;
  const links = (task?.links ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const sp = task ? statusPillStyle(task.status) : { bg: '', color: '' };
  const pr = task ? priorityDisplay(task.priority) : { label: '', color: '' };

  async function remove() {
    if (!task) return;
    if (!confirm(`Delete ${task.taskId}?`)) return;
    try {
      await del.mutateAsync(task.taskId);
      toast('Task deleted', 'success');
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to delete'));
    }
  }

  async function onSubmitProgress(values: AddProgressFormValues) {
    if (!task) return;
    try {
      await addProgress.mutateAsync({
        taskId: task.taskId,
        description: values.description,
        hoursLogged: values.hoursLogged ? Number(values.hoursLogged) : undefined,
        blockers: values.blockers || undefined,
      });
      progressForm.reset();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to add progress'));
    }
  }

  return (
    <>
      <Dialog open={!!taskId} onOpenChange={(next) => { if (!next) onClose(); }}>
        <DialogContent size="lg" showCloseButton={false}>
          <DialogHeader>
            {isLoading || !task ? (
              <DialogTitle>Task</DialogTitle>
            ) : (
              <div className="min-w-0 flex-1">
                <DialogTitle className="truncate">{task.title}</DialogTitle>
                <p className="mt-0.5 text-xs text-muted">Task · {task.taskId}</p>
              </div>
            )}
            <div className="flex shrink-0 items-center gap-1">
              {!isLoading && task && canEdit && (
                <button type="button" onClick={() => setEditOpen(true)} aria-label="Edit task" className="rounded-[6px] p-1.5 text-muted hover:bg-bg hover:text-p">
                  <Icon name="edit" size={16} />
                </button>
              )}
              {!isLoading && task && canDelete && (
                <button type="button" onClick={remove} aria-label="Delete task" className="rounded-[6px] p-1.5 text-muted hover:bg-[#fce8e8] hover:text-danger">
                  <Icon name="delete" size={16} />
                </button>
              )}
              <button type="button" onClick={onClose} aria-label="Close" className="rounded-[6px] p-1.5 text-muted hover:bg-bg hover:text-text">
                <Icon name="close" size={18} />
              </button>
            </div>
          </DialogHeader>

          {isLoading || !task ? (
            <div className="flex items-center justify-center px-5 py-10 text-p"><Spinner size={24} /></div>
          ) : (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto px-5 py-4">
              {/* Info strip */}
              <div className="flex flex-wrap items-center gap-2">
                <Badge style={{ background: sp.bg, color: sp.color, borderColor: 'transparent' }}>{task.status}</Badge>
                <span className="text-xs font-semibold" style={{ color: pr.color }}>{pr.label}</span>
                <span className="flex items-center gap-1 text-xs" style={{ color: overdue ? 'var(--danger)' : 'var(--muted)' }}>
                  <Icon name="today" size={13} /> {task.dueDate ? `${overdue ? 'Overdue · ' : 'Due '}${fmtDate(task.dueDate)}` : 'No due date'}
                </span>
                {task.recurring && (
                  <Badge variant="secondary"><Icon name="autorenew" size={11} /> Recurring</Badge>
                )}
              </div>
              {showRequestChange && (
                <button type="button" onClick={() => setDdrOpen(true)} className="btn btn-ghost btn-sm -mt-2">
                  <Icon name="edit_calendar" size={13} /> Request Change
                </button>
              )}

              {/* Context cards */}
              {(project || fn || subFn) && (
                <div className="grid gap-2 sm:grid-cols-3">
                  {project && (
                    <div className="rounded-[8px] border border-border bg-bg p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Project</p>
                      <p className="truncate text-sm font-semibold text-text">{project.name}</p>
                      {project.description && <p className="mt-0.5 text-xs text-muted">{truncate(project.description, 120)}</p>}
                    </div>
                  )}
                  {fn && (
                    <div className="rounded-[8px] border border-border bg-bg p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Function</p>
                      <p className="truncate text-sm font-semibold text-text">{fn.name}</p>
                      {fn.description && <p className="mt-0.5 text-xs text-muted">{truncate(fn.description, 120)}</p>}
                    </div>
                  )}
                  {subFn && (
                    <div className="rounded-[8px] border border-border bg-bg p-2.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Sub-Function</p>
                      <p className="truncate text-sm font-semibold text-text">{subFn.name}</p>
                      {subFn.description && <p className="mt-0.5 text-xs text-muted">{truncate(subFn.description, 120)}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* People */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted">Assigned To</p>
                  {task.assigneeIds.length === 0 ? (
                    <span className="text-sm text-muted2">—</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {task.assigneeIds.map((id) => (
                        <span key={id} className="inline-flex items-center gap-1.5 rounded-[9999px] bg-p3 px-2 py-1 text-xs text-p">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: avatarColor(id) }}>{initials(empName(id, employees))}</span>
                          {empName(id, employees)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-muted">Assigned By</p>
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: avatarColor(task.assignerId) }}>{initials(empName(task.assignerId, employees))}</span>
                    <div>
                      <p className="text-sm text-text">{empName(task.assignerId, employees)}</p>
                      <p className="text-xs text-muted">{fmtDate(task.createdAt)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Hours */}
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">Hours</p>
                {!task.estimatedHours && !task.actualHours ? (
                  <p className="text-sm text-muted2">Not tracked</p>
                ) : (
                  <p className="text-sm text-text">
                    {task.estimatedHours ? `${task.estimatedHours}h estimated` : 'No estimate'} · {task.actualHours || 0}h logged
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">Description</p>
                <p className="whitespace-pre-wrap text-sm text-text">{task.description || <span className="text-muted2">No description added.</span>}</p>
              </div>

              {/* Related links */}
              <div>
                <p className="mb-1 text-xs uppercase tracking-wide text-muted">Related Links</p>
                {links.length === 0 ? (
                  <p className="text-sm text-muted2">No links added.</p>
                ) : (
                  <div className="flex flex-col gap-1">
                    {links.map((l) => (
                      <a key={l} href={l} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 truncate text-sm text-p hover:underline">
                        <Icon name="link" size={13} /> {l}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* Assignment chain */}
              {task.assignmentHistory.length > 0 && (
                <div>
                  <button type="button" onClick={() => setChainOpen((o) => !o)} className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted hover:text-text">
                    <Icon name={chainOpen ? 'expand_more' : 'chevron_right'} size={14} /> Assignment Chain ({task.assignmentHistory.length})
                  </button>
                  {chainOpen && (
                    <div className="mt-2 space-y-1.5">
                      {task.assignmentHistory.map((h, i) => (
                        <div key={i} className="rounded-[8px] border border-border bg-bg px-2.5 py-1.5 text-xs text-muted">
                          <span className="font-semibold text-text">{empName(h.by, employees)}</span> → {h.assignees.length ? h.assignees.map((id) => empName(id, employees)).join(', ') : '—'}
                          {h.teams.length > 0 && <> · teams: {h.teams.join(', ')}</>}
                          <span className="ml-2 text-muted2">{fmtDate(h.date)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Progress updates */}
              <div className="border-t border-border pt-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-muted">Progress Updates</p>
                {canProgress && (
                  <Form {...progressForm}>
                    <form onSubmit={progressForm.handleSubmit(onSubmitProgress)} className="mb-3 space-y-2">
                      <FormField
                        control={progressForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl><textarea rows={2} className={`${fieldClass} resize-none`} placeholder="What did you do?" {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <FormField
                          control={progressForm.control}
                          name="hoursLogged"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl><input type="number" min={0} step="0.5" className={fieldClass} placeholder="Hours" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={progressForm.control}
                          name="blockers"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl><input className={fieldClass} placeholder="Blockers (optional)" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <button type="submit" disabled={addProgress.isPending} className="btn btn-ghost btn-sm disabled:opacity-60">
                        {addProgress.isPending && <Spinner size={14} />} + Add Progress
                      </button>
                    </form>
                  </Form>
                )}
                <div className="space-y-2">
                  {(progress ?? []).length === 0 ? (
                    <p className="text-sm text-muted2">No progress updates yet.</p>
                  ) : (
                    (progress ?? []).map((u) => (
                      <div key={u.updateId} className="rounded-[8px] border border-border bg-bg p-3">
                        <div className="mb-1 flex items-center justify-between text-xs text-muted">
                          <span className="font-semibold text-text">{empName(u.authorEmpId, employees)}</span>
                          <span>{new Date(u.date).toLocaleString()}</span>
                        </div>
                        <p className="text-sm text-text">{u.description}</p>
                        {(u.hoursLogged || u.blockers) && (
                          <div className="mt-1 flex gap-3 text-xs text-muted">
                            {u.hoursLogged ? <span>{u.hoursLogged}h logged</span> : null}
                            {u.blockers ? <span className="text-warn">Blocker: {u.blockers}</span> : null}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Attachments (backend not yet built — Google Drive creds pending) */}
              <div className="border-t border-border pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wide text-muted">Attachments {attCount > 0 && `(${attCount})`}</p>
                  <div className="flex gap-1">
                    <button type="button" onClick={() => toast('Attachments require Google Drive credentials (coming soon).', 'info')} className="rounded-[6px] p-1.5 text-muted hover:bg-bg hover:text-p" title="Attach file">
                      <Icon name="attach_file" size={15} />
                    </button>
                    <button type="button" onClick={() => toast('Voice notes are not yet available.', 'info')} className="rounded-[6px] p-1.5 text-muted hover:bg-bg hover:text-p" title="Record audio">
                      <Icon name="videocam" size={15} />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-muted2">{attCount > 0 ? `${attCount} attachment${attCount === 1 ? '' : 's'}.` : 'No attachments yet.'}</p>
              </div>

              {error && <div className="rounded-[8px] border border-danger/40 bg-[#fce8e8] px-3 py-2 text-sm text-danger">{error}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {task && <DdrModal open={ddrOpen} onClose={() => setDdrOpen(false)} entityType="Task" entityId={task.taskId} />}
      <TaskEditModal taskId={editOpen ? taskId : null} onClose={() => setEditOpen(false)} />
    </>
  );
}

export default TaskDetailModal;
