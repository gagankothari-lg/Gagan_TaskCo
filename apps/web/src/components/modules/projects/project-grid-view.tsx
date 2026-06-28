'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useProjects, type ProjectScope } from '../../../hooks/use-projects';
import { isManager } from '../../../lib/auth';
import { apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../ui/spinner';
import { ProjectCard } from './project-card';
import { CreateProjectModal } from './create-project-modal';
import { ProjectDetailModal } from './project-detail-modal';

export function ProjectGridView({ scope, title, subtitle }: { scope?: ProjectScope; title: string; subtitle?: string }) {
  const { currentUser } = useAuth();
  const { data: projects, isLoading, error } = useProjects(scope);
  const [statusFilter, setStatusFilter] = useState('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const statuses = useMemo(() => ['All', ...Array.from(new Set((projects ?? []).map((p) => p.status)))], [projects]);
  const filtered = (projects ?? []).filter((p) => statusFilter === 'All' || p.status === statusFilter);
  const canCreate = currentUser ? isManager(currentUser.role) : false;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">{title}</h1>
          {subtitle && <p className="text-sm text-[var(--muted)]">{subtitle}</p>}
        </div>
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
            <Icon name="add" size={15} /> New Project
          </button>
        )}
      </div>

      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={['shrink-0 rounded-[9999px] border px-3 py-1 text-xs', statusFilter === s ? 'border-[var(--p)] bg-[var(--p3)] text-[var(--p)]' : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'].join(' ')}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-[var(--danger)]">{apiErrorMessage(error, 'Failed to load projects')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] py-12 text-center">
          <Icon name="folder" size={28} className="text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">No projects</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => <ProjectCard key={p.projId} project={p} onClick={() => setDetailId(p.projId)} />)}
        </div>
      )}

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ProjectDetailModal projId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}

export default ProjectGridView;
