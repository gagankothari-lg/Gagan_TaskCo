'use client';

import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import { Card } from '../../ui/card';
import { Popover, PopoverTrigger, PopoverContent } from '../../ui/popover';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '../../ui/dropdown-menu';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '../../../lib/api/notes';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { NOTE_COLORS } from './note-colors';
import type { Note } from '../../../lib/types';

interface Draft {
  title: string;
  content: string;
  color: string;
}
const EMPTY_DRAFT: Draft = { title: '', content: '', color: '' };

function ColorSwatchPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-border"
          style={{ background: value || 'var(--surface)' }}
          title="Note colour"
          aria-label="Note colour"
        >
          {!value && <Icon name="palette" size={14} className="text-muted" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <div className="flex flex-wrap gap-2">
          {NOTE_COLORS.map((c) => (
            <button
              key={c.value || 'default'}
              type="button"
              title={c.label}
              onClick={() => onChange(c.value)}
              className="h-7 w-7 rounded-full border"
              style={{
                background: c.value || 'var(--surface)',
                borderColor: value === c.value ? 'var(--p)' : 'var(--border)',
                borderWidth: value === c.value ? 2 : 1,
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Keep-style personal Notes board — Part 28 FR-2 (title/content + Pinned + Color). */
export function NotesPanel() {
  const { data, isLoading, error } = useNotes();
  const create = useCreateNote();
  const update = useUpdateNote();
  const del = useDeleteNote();

  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Draft>(EMPTY_DRAFT);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.title.trim() && !draft.content.trim()) return;
    try {
      await create.mutateAsync({ title: draft.title.trim() || undefined, content: draft.content.trim() || undefined, color: draft.color || undefined });
      setDraft(EMPTY_DRAFT);
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to add note'), 'error');
    }
  }

  async function togglePin(note: Note) {
    try {
      await update.mutateAsync({ id: note.id, dto: { pinned: !note.pinned } });
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to update note'), 'error');
    }
  }

  function startEdit(note: Note) {
    setEditingId(note.id);
    setEditDraft({ title: note.title ?? '', content: note.content ?? '', color: note.color ?? '' });
  }

  async function saveEdit(note: Note) {
    try {
      await update.mutateAsync({
        id: note.id,
        dto: { title: editDraft.title.trim() || undefined, content: editDraft.content.trim() || undefined, color: editDraft.color || undefined },
      });
      setEditingId(null);
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to update note'), 'error');
    }
  }

  async function remove(id: string) {
    try {
      await del.mutateAsync(id);
      toast('Note removed', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to remove note'), 'error');
    }
  }

  const list = data ?? [];

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-3">
        <form onSubmit={addNote} className="flex flex-col gap-2">
          <input
            className="fc"
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <textarea
            className="fc resize-none"
            rows={2}
            placeholder="Take a note…"
            value={draft.content}
            onChange={(e) => setDraft((d) => ({ ...d, content: e.target.value }))}
          />
          <div className="flex items-center justify-between">
            <ColorSwatchPicker value={draft.color} onChange={(v) => setDraft((d) => ({ ...d, color: v }))} />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={create.isPending || (!draft.title.trim() && !draft.content.trim())}
            >
              {create.isPending ? <Spinner size={14} /> : <Icon name="add" size={14} />} Add note
            </button>
          </div>
        </form>
      </Card>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-danger">{apiErrorMessage(error, 'Failed to load notes')}</div>
      ) : list.length === 0 ? (
        <div className="empty-state"><Icon name="edit_note" size={40} className="ei" /><p>No notes yet — capture one above.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((note) => {
            const isEditing = editingId === note.id;
            return (
              <Card key={note.id} className="gap-2 p-3" style={{ background: note.color || undefined }}>
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
                    <div className="flex items-center justify-between">
                      <ColorSwatchPicker value={editDraft.color} onChange={(v) => setEditDraft((d) => ({ ...d, color: v }))} />
                      <div className="flex gap-2">
                        <button type="button" className="btn btn-ghost" onClick={() => setEditingId(null)}>Cancel</button>
                        <button type="button" className="btn btn-primary" onClick={() => saveEdit(note)}>Save</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{note.title || 'Untitled'}</span>
                      <button
                        type="button"
                        onClick={() => togglePin(note)}
                        className={note.pinned ? 'text-p' : 'text-muted2 hover:text-p'}
                        title={note.pinned ? 'Unpin' : 'Pin'}
                        aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                      >
                        <Icon name="push_pin" size={15} />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" className="rounded-[6px] p-1 text-muted hover:bg-bg hover:text-p" aria-label="More actions">
                            <Icon name="more_vert" size={16} />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onSelect={() => startEdit(note)}>
                            <Icon name="edit" size={14} /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem destructive onSelect={() => remove(note.id)}>
                            <Icon name="delete" size={14} /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    {note.content && <p className="whitespace-pre-wrap text-sm text-muted">{note.content}</p>}
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

export default NotesPanel;
