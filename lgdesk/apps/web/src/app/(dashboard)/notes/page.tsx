import { Icon } from '../../../components/ui/icon';

// Placeholder route — LGDesk_Master_Reference.md Part 10 nav item `#nav-notes`.
// This phase only wires up the app shell/navigation; the Notes view itself
// (todos + notes + ideas) is built in a later phase.
export default function NotesPage() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text)]">Notes</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">Personal todos, notes and ideas.</p>
      <div className="flex flex-col items-center gap-2 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
        <Icon name="edit_note" size={32} className="opacity-50" />
        <p className="text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
