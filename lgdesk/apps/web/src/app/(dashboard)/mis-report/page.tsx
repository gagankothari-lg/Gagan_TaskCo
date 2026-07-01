import { Icon } from '../../../components/ui/icon';

// Placeholder route — LGDesk_Master_Reference.md Part 10 nav item `#nav-mis-report`.
// Gated by `hasMisAccess` in the sidebar (see layout-client.tsx), independent
// of role. This phase only wires up the app shell/navigation; the MIS Report
// view itself is built in a later phase.
export default function MisReportPage() {
  return (
    <div className="p-6">
      <h1 className="mb-1 text-xl font-semibold text-[var(--text)]">MIS Report</h1>
      <p className="mb-5 text-sm text-[var(--muted)]">Management information summaries.</p>
      <div className="flex flex-col items-center gap-2 rounded-[8px] border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--muted)]">
        <Icon name="assessment" size={32} className="opacity-50" />
        <p className="text-sm">Coming soon.</p>
      </div>
    </div>
  );
}
