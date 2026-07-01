'use client';

import { useState } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useProjects } from '../../../lib/api/projects';
import { useFunctions } from '../../../lib/api/functions';
import { FunctionTree } from '../../../components/modules/functions/function-tree';
import { CreateFunctionModal } from '../../../components/modules/functions/create-function-modal';
import { FunctionDetailModal } from '../../../components/modules/functions/function-detail-modal';
import { Spinner } from '../../../components/ui/spinner';

export default function FunctionsPage() {
  const { data: projects } = useProjects();
  const [projId, setProjId] = useState('');
  const { data: functions, isLoading } = useFunctions(projId || undefined);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  return (
    <div className="p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[var(--text)]">Functions</h1>
          <p className="text-sm text-[var(--muted)]">Function hierarchy {projId ? 'for the selected project' : '(all)'}</p>
        </div>
        <div className="flex items-center gap-2">
          <select value={projId} onChange={(e) => setProjId(e.target.value)} className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1.5 text-sm text-[var(--text)] focus:border-[var(--p)] focus:outline-none">
            <option value="">All projects</option>
            {(projects ?? []).map((p) => <option key={p.projId} value={p.projId}>{p.projId} — {p.name}</option>)}
          </select>
          <button onClick={() => setCreateOpen(true)} className="btn btn-primary">
            <Icon name="add" size={15} /> New Function
          </button>
        </div>
      </div>

      <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-[var(--muted)]"><Spinner size={16} /> Loading…</div>
        ) : (
          <FunctionTree functions={functions ?? []} onSelect={setDetailId} selectedId={detailId ?? undefined} />
        )}
      </div>

      <CreateFunctionModal open={createOpen} onClose={() => setCreateOpen(false)} defaultProjId={projId || undefined} />
      <FunctionDetailModal functionId={detailId} onClose={() => setDetailId(null)} />
    </div>
  );
}
