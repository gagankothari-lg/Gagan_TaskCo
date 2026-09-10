'use client';

import { Icon } from '../../../components/ui/icon';
import { usePageHeader } from '../../../components/layout/page-header-context';

// Placeholder route — LGDesk_Master_Reference.md Part 10 nav item `#nav-forms`.
// Manager+ gated (see layout-client.tsx). This phase only wires up the app
// shell/navigation; the Forms view itself is built in a later phase.
export default function FormsPage() {
  usePageHeader({ title: 'Forms', subtitle: 'Create, manage and share forms' });

  return (
    <div className="p-6">
      <div className="empty-state">
        <Icon name="description" size={40} className="ei" />
        <p>Coming soon.</p>
      </div>
    </div>
  );
}
