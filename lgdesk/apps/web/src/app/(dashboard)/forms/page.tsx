import { Icon } from '../../../components/ui/icon';

// Placeholder route — LGDesk_Master_Reference.md Part 10 nav item `#nav-forms`.
// Manager+ gated (see layout-client.tsx). This phase only wires up the app
// shell/navigation; the Forms view itself is built in a later phase.
export default function FormsPage() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text)]">Forms</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">Company forms.</p>
      <div className="flex flex-col items-center gap-2 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
        <Icon name="description" size={32} className="opacity-50" />
        <p className="text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
