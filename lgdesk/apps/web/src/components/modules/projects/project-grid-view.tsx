'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useProjects, type ProjectScope } from '../../../lib/api/projects';
import { canCreateProject } from '../../../lib/rbac';
import { apiErrorMessage } from '../../../lib/api/client';
import { Spinner } from '../../ui/spinner';
import { ProjectCard } from './project-card';
import { CreateProjectModal } from './create-project-modal';
import { ProjectDetailModal } from './project-detail-modal';
import type { Project } from '../../../lib/types';

type OwnershipTab = 'All' | 'To Me' | 'By Me';

export function ProjectGridView({ scope, title, subtitle }: { scope?: ProjectScope; title: string; subtitle?: string }) {
  const { currentUser } = useAuth();
  const { data: projects, isLoading, error } = useProjects(scope);
  const [tab, setTab] = useState<OwnershipTab>('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Part 37: "Tabs All / To Me / By Me toggle the grid" — mirrors My Tasks' ownership
  // tabs (assignee-or-owner vs. assigner), applied on top of the scope already
  // returned by the server (`_applyAsgnProjFilter`).
  const byOwnership = useMemo(() => {
    const list = projects ?? [];
    if (!currentUser) return list;
    if (tab === 'To Me') return list.filter((p) => p.assigneeIds.includes(currentUser.empId) || p.ownerIds.includes(currentUser.empId));
    if (tab === 'By Me') return list.filter((p) => p.assignerId === currentUser.empId);
    return list;
  }, [projects, tab, currentUser]);

  const statuses = useMemo(() => ['All', ...Array.from(new Set(byOwnership.map((p) => p.status)))], [byOwnership]);
  const filtered = byOwnership.filter((p) => statusFilter === 'All' || p.status === statusFilter);
  const canCreate = canCreateProject(currentUser);

  // Group standalone projects vs. parent+sub-project blocks (Part 37: "_projGroupBlock
  // header + sub-project mini-cards grid"). A project with no parent AND no children
  // in the filtered set renders as a normal standalone card.
  const topLevel = filtered.filter((p) => !p.parentProjId);
  const subProjectsOf = (projId: string) => filtered.filter((p) => p.parentProjId === projId);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text">{title}</h1>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
        {canCreate && (
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
            <Icon name="add" size={15} /> New Project
          </button>
        )}
      </div>

      <div className="tl-tabs mb-3">
        {(['All', 'To Me', 'By Me'] as OwnershipTab[]).map((t) => (
          <button key={t} className={`tl-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-1.5 overflow-x-auto pb-1">
        {statuses.map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={['shrink-0 rounded-[9999px] border px-3 py-1 text-xs', statusFilter === s ? 'border-p bg-p3 text-p' : 'border-border text-muted hover:text-text'].join(' ')}>
            {s}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-muted"><Spinner size={16} /> Loading…</div>
      ) : error ? (
        <div className="text-sm text-danger">{apiErrorMessage(error, 'Failed to load projects')}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-[8px] border border-border bg-surface py-12 text-center">
          <Icon name="folder" size={28} className="text-muted" />
          <p className="text-sm text-muted">No projects</p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {topLevel.map((p) => {
            const subs = subProjectsOf(p.projId);
            if (subs.length === 0) {
              return (
                <div key={p.projId} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <ProjectCard project={p} onEdit={() => setEditId(p.projId)} />
                </div>
              );
            }
            return <ProjectGroupBlock key={p.projId} parent={p} subProjects={subs} onEdit={setEditId} />;
          })}
        </div>
      )}

      <CreateProjectModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <ProjectDetailModal projId={editId} onClose={() => setEditId(null)} />
    </div>
  );
}

/** Parent project with sub-projects: a compact group header + a mini-card grid. */
function ProjectGroupBlock({ parent, subProjects, onEdit }: { parent: Project; subProjects: Project[]; onEdit: (projId: string) => void }) {
  return (
    <div className="rounded-[8px] border border-border bg-bg p-3">
      <div className="mb-3 flex items-center gap-2 border-b border-border pb-2">
        <Icon name="folder_open" size={16} className="text-p" />
        <span className="text-sm font-bold text-text">{parent.name}</span>
        <span className="rounded-[9999px] bg-p3 px-2 py-0.5 text-[10px] font-semibold text-p">{subProjects.length} sub-project{subProjects.length === 1 ? '' : 's'}</span>
        <button type="button" onClick={() => onEdit(parent.projId)} className="ml-auto flex items-center gap-1 rounded-[6px] px-2 py-1 text-xs text-muted hover:bg-surface hover:text-p">
          <Icon name="edit" size={13} /> Edit parent
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subProjects.map((sp) => <ProjectCard key={sp.projId} project={sp} onEdit={() => onEdit(sp.projId)} />)}
      </div>
    </div>
  );
}

export default ProjectGridView;
