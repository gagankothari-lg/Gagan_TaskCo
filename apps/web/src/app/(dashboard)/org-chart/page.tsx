'use client';

import { useMemo, useRef, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useOrgChart, type DirectoryUser } from '../../../hooks/use-directory';
import { Icon } from '../../../components/ui/icon';
import { initials } from '../../../lib/utils';

const TEAM_COLORS: Record<string, string> = {
  "1. Founder's Office": '#6a1b9a',
  '2. Student Success': '#0277bd',
  '3. Knowledge': '#00695c',
  '4. Growth (Marketing)': '#e65100',
  '5. Tech': '#1565c0',
  '6. Consulting': '#880e4f',
  '7. Operations - PP & Admin': '#2e7d32',
  '8. Operations - FP&A': '#6a4c93',
};
const teamColor = (t?: string | null) => (t && TEAM_COLORS[t]) || '#455a64';

interface TreeNode { user: DirectoryUser; children: TreeNode[] }

function buildTree(users: DirectoryUser[]): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  users.forEach((u) => byId.set(u.empId, { user: u, children: [] }));
  const roots: TreeNode[] = [];
  byId.forEach((node) => {
    const mgr = node.user.managerId ? byId.get(node.user.managerId) : undefined;
    if (mgr && mgr !== node) mgr.children.push(node);
    else roots.push(node);
  });
  return roots;
}

export default function OrgChartPage() {
  const { currentUser } = useAuth();
  const { data: users, isLoading } = useOrgChart();
  const roots = useMemo(() => buildTree(users ?? []), [users]);

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [highlight, setHighlight] = useState<string | null>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);

  const teams = useMemo(() => Array.from(new Set((users ?? []).map((u) => u.team).filter(Boolean))) as string[], [users]);

  const toggle = (id: string) => setCollapsed((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set((users ?? []).map((u) => u.empId)));
  const stepZoom = (d: number) => setZoom((z) => Math.min(3, Math.max(0.2, +(z + d).toFixed(2))));
  const reset = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
  const findMe = () => { if (currentUser) { setHighlight(currentUser.empId); setZoom(1); setPan({ x: 0, y: 0 }); setTimeout(() => setHighlight(null), 2500); } };

  function onDown(e: React.MouseEvent) { drag.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }; }
  function onMove(e: React.MouseEvent) { if (!drag.current) return; setPan({ x: drag.current.px + (e.clientX - drag.current.x), y: drag.current.py + (e.clientY - drag.current.y) }); }
  function onUp() { drag.current = null; }

  const Node = ({ node }: { node: TreeNode }) => {
    const { user } = node;
    const color = teamColor(user.team);
    const isCollapsed = collapsed.has(user.empId);
    const isMe = user.empId === currentUser?.empId;
    const isHi = highlight === user.empId;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ background: 'var(--surface)', borderRadius: 8, boxShadow: 'var(--sh)', borderTop: `3px solid ${color}`, padding: '10px 14px', minWidth: 150, textAlign: 'center', outline: isHi ? '3px solid var(--p)' : isMe ? '2px solid var(--accent)' : 'none' }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: color, color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 6px' }}>{initials(`${user.firstName} ${user.lastName}`)}</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{user.firstName} {user.lastName}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{user.designation || user.role}</div>
          {node.children.length > 0 && (
            <button onClick={() => toggle(user.empId)} style={{ marginTop: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)' }}>
              <Icon name={isCollapsed ? 'unfold_more' : 'unfold_less'} size={16} /> {node.children.length}
            </button>
          )}
        </div>
        {node.children.length > 0 && !isCollapsed && (
          <>
            <div style={{ width: 2, height: 20, background: 'var(--border)' }} />
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              {node.children.map((c) => <Node key={c.user.empId} node={c} />)}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div>
      <div className="ph">
        <div className="ph-left"><div className="ph-title">Org Chart</div><div className="ph-sub">Reporting structure across teams</div></div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={expandAll}><Icon name="unfold_more" size={15} /> Expand</button>
          <button className="btn btn-ghost btn-sm" onClick={collapseAll}><Icon name="unfold_less" size={15} /> Collapse</button>
          <div className="tl-tabs">
            <button className="tl-tab" onClick={() => stepZoom(-0.15)}><Icon name="remove" size={15} /></button>
            <span style={{ alignSelf: 'center', fontSize: 12, color: 'var(--muted)', minWidth: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button className="tl-tab" onClick={() => stepZoom(0.15)}><Icon name="add" size={15} /></button>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={findMe}><Icon name="my_location" size={15} /> Find me</button>
          <button className="btn btn-ghost btn-sm" onClick={reset}><Icon name="fit_screen" size={15} /> Reset</button>
        </div>
      </div>

      {/* Team legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 12 }}>
        {teams.map((t) => (
          <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--muted)' }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: teamColor(t) }} /> {t}
          </span>
        ))}
      </div>

      {isLoading ? (
        <div className="empty-state"><span className="ei material-symbols-outlined">hourglass_empty</span><p>Loading…</p></div>
      ) : (
        <div
          onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
          style={{ overflow: 'hidden', border: '1px solid var(--border)', borderRadius: 8, background: 'var(--surface)', height: 'calc(100vh - 240px)', cursor: drag.current ? 'grabbing' : 'grab', position: 'relative' }}
        >
          <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', padding: 40, display: 'inline-flex', gap: 40, alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ background: 'var(--p)', color: '#fff', borderRadius: 8, padding: '10px 18px', fontWeight: 700 }}>Leveraged Growth</div>
              <div style={{ width: 2, height: 20, background: 'var(--border)' }} />
              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
                {roots.map((r) => <Node key={r.user.empId} node={r} />)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
