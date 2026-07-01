'use client';

import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { toast } from '../../../lib/toast';
import { TodosPanel } from '../../../components/modules/notes/todos-panel';
import { NotesPanel } from '../../../components/modules/notes/notes-panel';
import { IdeasPanel } from '../../../components/modules/notes/ideas-panel';

type Tab = 'Todos' | 'Notes' | 'Ideas';
const TABS: { key: Tab; icon: string }[] = [
  { key: 'Todos', icon: 'checklist_rtl' },
  { key: 'Notes', icon: 'edit_note' },
  { key: 'Ideas', icon: 'lightbulb' },
];

// LGDesk_Master_Reference.md Part 28 "Module — Personal Productivity": Keep-style
// per-user Todos/Notes/Ideas, empId-scoped, no role gating (personal data).
export default function NotesPage() {
  const [tab, setTab] = useState<Tab>('Todos');

  return (
    <div className="p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-text">Notes</h1>
          <p className="text-sm text-muted">Personal todos, notes and ideas — only visible to you.</p>
        </div>
        {/* Sync Google Tasks is a placeholder attach point for the still-blocked
            Google Tasks OAuth work (lib/api/googleTasks.ts is a signature-only stub
            pending credentials) — no implementation is wired up yet. */}
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => toast('Sync Google Tasks is not available yet.', 'info')}
        >
          <Icon name="refresh" size={14} /> Sync Google Tasks
        </button>
      </div>

      <div className="tl-tabs mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tl-tab inline-flex items-center gap-1${tab === t.key ? ' active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            <Icon name={t.icon} size={13} /> {t.key}
          </button>
        ))}
      </div>

      {tab === 'Todos' && <TodosPanel />}
      {tab === 'Notes' && <NotesPanel />}
      {tab === 'Ideas' && <IdeasPanel />}
    </div>
  );
}
