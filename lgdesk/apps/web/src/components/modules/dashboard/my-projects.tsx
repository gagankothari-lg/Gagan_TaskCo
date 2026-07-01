'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { Icon } from '../../ui/icon';
import { Badge } from '../../ui/badge';
import { statusPillStyle } from '../../../lib/status-styles';
import { fmtDate } from '../../../lib/utils';
import type { Project, Task, WorkFunction } from '../../../lib/types';

const MAX_PROJECT_CARDS = 10;

function priorityStyle(p: string) {
  const map: Record<string, { bg: string; color: string }> = {
    Critical: { bg: '#fce8e8', color: '#c62828' }, High: { bg: '#fce8e8', color: '#c62828' },
    Medium: { bg: '#e8eaf6', color: '#1a237e' }, Low: { bg: '#f5f5f5', color: '#757575' },
  };
  return map[p] ?? { bg: '#f5f5f5', color: '#757575' };
}
const overdue = (t: Task) => !!t.dueDate && !['Done', 'Cancelled'].includes(t.status) && new Date(t.dueDate) < new Date(new Date().toDateString());

function TaskLine({ t }: { t: Task }) {
  const sp = statusPillStyle(t.status);
  const od = overdue(t);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', marginLeft: 32 }}>
      <Icon name="task_alt" size={12} style={{ color: 'var(--muted)' }} />
      <span style={{ flex: 1, fontSize: 13 }}>{t.title}</span>
      <Badge variant="outline" style={{ background: sp.bg, color: sp.color, borderColor: 'transparent' }}>{t.status}</Badge>
      {t.dueDate && <span style={{ fontSize: 11, color: od ? '#c62828' : 'var(--muted2)', whiteSpace: 'nowrap' }}>{fmtDate(t.dueDate)}</span>}
    </div>
  );
}

export function MyProjects() {
  const { projects, functions, tasks } = useAuth();
  const shownProjects = useMemo(() => projects.slice(0, MAX_PROJECT_CARDS), [projects]);
  const [selId, setSelId] = useState<string | null>(shownProjects[0]?.projId ?? null);

  const taskCount = (p: Project) => {
    const ts = tasks.filter((t) => t.projId === p.projId);
    const done = ts.filter((t) => t.status === 'Done').length;
    return { total: ts.length, done, pct: ts.length ? Math.round((done / ts.length) * 100) : 0 };
  };
  const parentName = (p: Project) => (p.parentProjId ? projects.find((x) => x.projId === p.parentProjId)?.name : undefined);

  const selected = shownProjects.find((p) => p.projId === selId) ?? null;
  const tree = useMemo(() => {
    if (!selected) return null;
    const fns = functions.filter((f) => f.projId === selected.projId);
    const tops = fns.filter((f) => !f.parentFnId);
    const subsOf = (fid: string) => fns.filter((f) => f.parentFnId === fid);
    const tasksOf = (fid: string) => tasks.filter((t) => t.functionId === fid);
    const projTasks = tasks.filter((t) => t.projId === selected.projId);
    const done = projTasks.filter((t) => t.status === 'Done').length;
    return { tops, subsOf, tasksOf, total: projTasks.length, done, pct: projTasks.length ? Math.round((done / projTasks.length) * 100) : 0 };
  }, [selected, functions, tasks]);

  const FnRow = ({ f }: { f: WorkFunction }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#f5f5f5', borderRadius: 4, marginBottom: 2 }}>
      <Icon name="folder" size={16} style={{ color: 'var(--muted)' }} />
      <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
      <span style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'monospace' }}>{f.functionId}</span>
    </div>
  );
  const SubRow = ({ f }: { f: WorkFunction }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: '#fafafa', borderRadius: 4, marginBottom: 2, marginLeft: 16 }}>
      <Icon name="subdirectory_arrow_right" size={14} style={{ color: 'var(--muted)' }} />
      <span style={{ flex: 1, fontSize: 13 }}>{f.name}</span>
      <span style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: 'monospace' }}>{f.functionId}</span>
    </div>
  );

  if (projects.length === 0) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ background: '#fafafa', borderRight: '1px solid var(--border)', padding: 12, fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>No projects assigned yet.</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, color: 'var(--muted)' }}>
          <Icon name="account_tree" size={40} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: 13, marginTop: 8 }}>Select a project</div>
          <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Click a project to view its structure</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      {/* Left: project list (capped at 10) */}
      <div style={{ background: '#fafafa', borderRight: '1px solid var(--border)', padding: 8, maxHeight: 380, overflowY: 'auto' }}>
        {shownProjects.map((p) => {
          const c = taskCount(p);
          const active = p.projId === selId;
          const pb = priorityStyle(p.priority);
          const sp = statusPillStyle(p.status);
          const parent = parentName(p);
          return (
            <div key={p.projId} onClick={() => setSelId(p.projId)} style={{ background: active ? '#e8eaf6' : '#fff', border: `1px solid ${active ? '#1a237e' : 'var(--border)'}`, borderRadius: 6, padding: '8px 10px', marginBottom: 6, cursor: 'pointer' }}>
              {parent && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--muted)', marginBottom: 2 }}>
                  <Icon name="subdirectory_arrow_right" size={12} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{parent}</span>
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{p.name}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                <Badge variant="outline" style={{ background: pb.bg, color: pb.color, borderColor: 'transparent' }}>{p.priority}</Badge>
                <Badge variant="outline" style={{ background: sp.bg, color: sp.color, borderColor: 'transparent' }}>{p.status}</Badge>
                {p.deadline && <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted2)' }}>{fmtDate(p.deadline)}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                <div style={{ flex: 1, height: 4, background: '#e0e0e0', borderRadius: 2 }}>
                  <div style={{ width: `${c.pct}%`, height: '100%', background: 'var(--p2)', borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>{c.total === 0 ? 'No tasks' : `${c.done}/${c.total} done`}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: tree */}
      <div style={{ background: '#fff', padding: 12, maxHeight: 380, overflowY: 'auto' }}>
        {selected && tree ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon name="chevron_right" size={16} style={{ color: 'var(--muted)' }} />
              <span style={{ fontWeight: 600, fontSize: 13 }}>{selected.name}</span>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>{tree.done}/{tree.total} tasks done</span>
              <span style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 700, color: 'var(--p)' }}>{tree.pct}%</span>
            </div>
            {tree.tops.length === 0 && tree.total === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--muted)', fontStyle: 'italic', padding: '8px 0' }}>No functions or tasks yet</div>
            ) : (
              tree.tops.map((f) => (
                <div key={f.functionId}>
                  <FnRow f={f} />
                  {tree.tasksOf(f.functionId).map((t) => <TaskLine key={t.taskId} t={t} />)}
                  {tree.subsOf(f.functionId).map((sf) => (
                    <div key={sf.functionId}>
                      <SubRow f={sf} />
                      {tree.tasksOf(sf.functionId).map((t) => <TaskLine key={t.taskId} t={t} />)}
                    </div>
                  ))}
                </div>
              ))
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 32, color: 'var(--muted)' }}>
            <Icon name="account_tree" size={40} style={{ opacity: 0.3 }} />
            <div style={{ fontSize: 13, marginTop: 8 }}>Select a project</div>
            <div style={{ fontSize: 12, color: 'var(--muted2)' }}>Click a project to view its structure</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MyProjects;
