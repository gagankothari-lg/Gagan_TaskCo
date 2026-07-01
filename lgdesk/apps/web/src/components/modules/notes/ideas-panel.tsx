'use client';

import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import { Card } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { useIdeas, useCreateIdea, useUpdateIdea, useDeleteIdea } from '../../../lib/api/notes';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import type { Idea } from '../../../lib/types';

// Part 28 FR-3: Status is free text — these are the documented examples, offered as
// quick picks; the underlying field accepts any string via the same input.
const STATUS_OPTIONS = ['Draft', 'Active', 'Archived'] as const;

const STATUS_BADGE: Record<string, 'secondary' | 'success' | 'outline'> = {
  Draft: 'outline',
  Active: 'success',
  Archived: 'secondary',
};

interface Draft {
  title: string;
  content: string;
  status: string;
}
const EMPTY_DRAFT: Draft = { title: '', content: '', status: 'Draft' };

/** Keep-style personal Ideas board — Part 28 FR-3 (title/content + free-text Status). */
export function IdeasPanel() {
  const { data, isLoading, error } = useIdeas();
  const create = useCreateIdea();
  const update = useUpdateIdea();
  const del = useDeleteIdea();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  async function addIdea(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() && !draft.content.trim()) return;
    try {
      await create.mutateAsync({ title: draft.title.trim() || undefined, content: draft.content.trim() || undefined, status: draft.status });
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to add idea'), 'error');
    }
  }

  async function setStatus(idea: Idea, status: string) {
    try {
      await update.mutateAsync({ id: idea.id, dto: { status } });
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to update idea'), 'error');
    }
  }

  function startEdit(idea: Idea) {
    setEditingId(idea.id);
    setEditDraft({ title: idea.title ?? '', content: idea.content ?? '', status: idea.status });
  }

  async function saveEdit(idea: Idea) {
    try {
      await update.mutateAsync({
        id: idea.id,
        dto: { title: editDraft.title.trim() || undefined, content: editDraft.content.trim() || undefined, status: editDraft.status },
      });
      setEditingId(null);
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to update idea'), 'error');
    }
  }

  async function remove(id: string) {
    try {
      await del.mutateAsync(id);
      toast('Idea removed', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to remove idea'), 'error');
    }
  }

  const list = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-3">
        <form onSubmit={addIdea} className="flex flex-col gap-2">
          <input
            className="fc"
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <textarea
            className="fc resize-none"
            rows={2}
            placeholder="Describe the idea…"
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          />
          <div className="flex items-center justify-between gap-2">
            <Select value={draft.status} onValueChange={(v) => setDraft((d) => ({ ...d, status: v }))}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={create.isPending || (!draft.title.trim() && !draft.content.trim())}
            >
              {create.isPending ? <Spinner size={14} /> : <Icon name="add" size={14} />} Add idea
            </button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-danger">{apiErrorMessage(error, 'Failed to load ideas')}</div>
      ) : list.length === 0 ? (
        <div className="empty-state"><Icon name="lightbulb" size={40} className="ei" /><p>No ideas yet — jot one down above.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((idea) => {
            const isEditing = editingId === idea.id;
            return (
              <Card key={idea.id} className="gap-2 p-3">
                {isEditing ? (
                  <div className="flex flex-col gap-2">
                    <input
                      autoFocus
                      className="fc"
                      placeholder="Title"
                      value={editDraft.title}
                      onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                    />
                    <textarea
                      className="fc resize-none"
                      rows={3}
                      placeholder="Content"
                      value={editDraft.content}
                      onChange={(e) => setEditDraft((d) => ({ ...d, content: e.target.value }))}
                    />
                    <Select value={editDraft.status} onValueChange={(v) => setEditDraft((d) => ({ ...d, status: v }))}>
                      <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex justify-end gap-2">
                      <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                      <button type="button" className="btn btn-primary" onClick={() => saveEdit(idea)}>Save</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <Icon name="lightbulb" size={15} style={{ color: 'var(--accent)', marginTop: 2 }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{idea.title || 'Untitled'}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="rounded-[6px] p-1 text-muted hover:bg-bg hover:text-p" aria-label="More actions">
                            <Icon name="more_vert" size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => startEdit(idea)}>
                            <Icon name="edit" size={14} /> Edit
                          </DropdownMenuItem>
                          {STATUS_OPTIONS.filter((s) => s !== idea.status).map((s) => (
                            <DropdownMenuItem key={s} onSelect={() => setStatus(idea, s)}>
                              <Icon name="flag" size={14} /> Mark {s}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuItem destructive onSelect={() => remove(idea.id)}>
                            <Icon name="delete" size={14} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {idea.content && <p className="whitespace-pre-wrap text-sm text-muted">{idea.content}</p>}
                    <Badge variant={STATUS_BADGE[idea.status] ?? 'outline'} className="self-start">{idea.status}</Badge>
                  </>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default IdeasPanel;
