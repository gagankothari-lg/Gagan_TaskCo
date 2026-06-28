'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useCreateAnnouncement } from '../../../hooks/use-dashboard';
import { apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../ui/spinner';

const field = 'bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm w-full focus:border-[var(--p)] focus:outline-none';
const VISIBILITY = ['Organisation', 'TCs & TFs', 'TCs Only'];

function plus7(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function AnnouncementForm() {
  const create = useCreateAnnouncement();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(plus7);
  const [visibility, setVisibility] = useState('Organisation');
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    if (!title.trim()) return setError('Title is required');
    try {
      await create.mutateAsync({
        title,
        content: content || undefined,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        visibility,
      });
      setTitle(''); setContent(''); setOk(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to post announcement'));
    }
  }

  return (
    <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 text-sm font-medium text-[var(--text)]">
        <Icon name="campaign" size={15} className="text-[var(--p)]" /> Post Announcement
        <span className="ml-auto text-[var(--muted)]">{open ? <Icon name="expand_more" size={16} /> : <Icon name="chevron_right" size={16} />}</span>
      </button>
      {open && (
        <form onSubmit={submit} className="mt-3 space-y-3">
          <input className={field} placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea rows={2} className={`${field} resize-none`} placeholder="Content" value={content} onChange={(e) => setContent(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={field} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <input type="date" className={field} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <select className={field} value={visibility} onChange={(e) => setVisibility(e.target.value)}>
            {VISIBILITY.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {error && <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">{error}</div>}
          {ok && <div className="rounded-[8px] border border-[var(--ok)]/40 bg-[var(--ok)]/10 px-3 py-2 text-sm text-[var(--ok)]">Announcement posted.</div>}
          <button type="submit" disabled={create.isPending} className="btn btn-primary disabled:opacity-60">
            {create.isPending && <Spinner size={14} />} Post
          </button>
        </form>
      )}
    </div>
  );
}

export default AnnouncementForm;
