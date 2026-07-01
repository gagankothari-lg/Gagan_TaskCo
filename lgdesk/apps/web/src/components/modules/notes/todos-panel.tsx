'use client';

import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import { Card } from '../../ui/card';
import { Checkbox } from '../../ui/checkbox';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../../../lib/api/notes';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import type { Todo } from '../../../lib/types';

/** Keep-style personal Todos board — Part 28 FR-1 (title + Done flag, empId-scoped). */
export function TodosPanel() {
  const { data, isLoading, error } = useTodos();
  const create = useCreateTodo();
  const update = useUpdateTodo();
  const del = useDeleteTodo();

  const [title, setTitle] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  async function addTodo(e: React.FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    try {
      await create.mutateAsync({ title: t });
      setTitle('');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to add todo'), 'error');
    }
  }

  async function toggleDone(todo: Todo) {
    try {
      await update.mutateAsync({ id: todo.id, dto: { completed: !todo.completed } });
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to update todo'), 'error');
    }
  }

  function startEdit(todo: Todo) {
    setEditingId(todo.id);
    setEditingTitle(todo.title);
  }

  async function commitEdit(todo: Todo) {
    const t = editingTitle.trim();
    setEditingId(null);
    if (!t || t === todo.title) return;
    try {
      await update.mutateAsync({ id: todo.id, dto: { title: t } });
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to update todo'), 'error');
    }
  }

  async function remove(id: string) {
    try {
      await del.mutateAsync(id);
      toast('Todo removed', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to remove todo'), 'error');
    }
  }

  const list = data ?? [];
  const open = list.filter((t) => !t.completed);
  const done = list.filter((t) => t.completed);
  const ordered = [...open, ...done];

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={addTodo} className="flex gap-2">
        <input
          className="fc flex-1"
          placeholder="Add a todo…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={create.isPending || !title.trim()}>
          {create.isPending ? <Spinner size={14} /> : <Icon name="add" size={14} />} Add
        </button>
      </form>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-danger">{apiErrorMessage(error, 'Failed to load todos')}</div>
      ) : ordered.length === 0 ? (
        <div className="empty-state"><Icon name="checklist_rtl" size={40} className="ei" /><p>No todos yet — add one above.</p></div>
      ) : (
        <div className="flex flex-col gap-2">
          {ordered.map((todo) => (
            <Card key={todo.id} className="flex-row items-center gap-3 px-3 py-2.5">
              <Checkbox checked={todo.completed} onCheckedChange={() => toggleDone(todo)} aria-label="Mark done" />
              {editingId === todo.id ? (
                <input
                  autoFocus
                  className="fc flex-1"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={() => commitEdit(todo)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitEdit(todo);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                />
              ) : (
                <span
                  onClick={() => startEdit(todo)}
                  className={`min-w-0 flex-1 cursor-text truncate text-sm ${todo.completed ? 'text-muted line-through' : 'text-text'}`}
                >
                  {todo.title}
                </span>
              )}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="rounded-[6px] p-1 text-muted hover:bg-bg hover:text-p" aria-label="More actions">
                    <Icon name="more_vert" size={16} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => startEdit(todo)}>
                    <Icon name="edit" size={14} /> Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={() => remove(todo.id)}>
                    <Icon name="delete" size={14} /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default TodosPanel;
