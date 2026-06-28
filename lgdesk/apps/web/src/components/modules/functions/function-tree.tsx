'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../ui/icon';
import type { WorkFunction } from '../../../lib/types';

function statusColor(f: WorkFunction): string {
  if (f.status === 'Done') return 'var(--ok)';
  if (f.deadline && !['Done', 'Cancelled'].includes(f.status) && new Date(f.deadline) < new Date(new Date().setHours(0, 0, 0, 0)))
    return 'var(--danger)';
  if (f.status.startsWith('WIP')) return 'var(--p)';
  return 'var(--muted)';
}

interface TreeNode extends WorkFunction {
  children: TreeNode[];
}

function buildTree(functions: WorkFunction[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  functions.forEach((f) => byId.set(f.functionId, { ...f, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    const parent = node.parentFnId ? byId.get(node.parentFnId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  });
  return roots;
}

function Node({ node, depth, onSelect, selectedId }: { node: TreeNode; depth: number; onSelect: (id: string) => void; selectedId?: string }) {
  const [open, setOpen] = useState(depth < 1);
  const hasChildren = node.children.length > 0;
  return (
    <div>
      <div
        className={[
          'flex items-center gap-1.5 rounded-[8px] border px-2 py-1.5 transition-colors',
          selectedId === node.functionId ? 'border-[var(--p)] bg-[var(--p3)]' : 'border-transparent hover:bg-[var(--p3)]',
        ].join(' ')}
        style={{ marginLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button onClick={() => setOpen((o) => !o)} aria-label={open ? 'Collapse' : 'Expand'} className="text-[var(--muted)] hover:text-[var(--text)]">
            {open ? <Icon name="expand_more" size={14} /> : <Icon name="chevron_right" size={14} />}
          </button>
        ) : (
          <span className="w-[14px]" />
        )}
        <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ backgroundColor: statusColor(node) }} />
        <button onClick={() => onSelect(node.functionId)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <span className="font-mono text-xs text-[var(--muted)]">{node.functionId}</span>
          <span className="truncate text-sm text-[var(--text)]">{node.name}</span>
          {hasChildren && (
            <span className="ml-auto rounded-[9999px] bg-[var(--p3)] px-1.5 text-[10px] text-[var(--muted)]">{node.children.length}</span>
          )}
          {node.deadline && (
            <span className="shrink-0 text-xs text-[var(--muted)]">{new Date(node.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
          )}
        </button>
      </div>
      {open && node.children.map((c) => <Node key={c.functionId} node={c} depth={depth + 1} onSelect={onSelect} selectedId={selectedId} />)}
    </div>
  );
}

export function FunctionTree({ functions, onSelect, selectedId }: { functions: WorkFunction[]; onSelect: (id: string) => void; selectedId?: string }) {
  const tree = useMemo(() => buildTree(functions), [functions]);
  if (tree.length === 0) return <p className="text-sm text-[var(--muted)]">No functions yet.</p>;
  return <div className="space-y-0.5">{tree.map((n) => <Node key={n.functionId} node={n} depth={0} onSelect={onSelect} selectedId={selectedId} />)}</div>;
}

export default FunctionTree;
