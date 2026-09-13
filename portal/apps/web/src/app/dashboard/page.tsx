'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, LayoutGrid } from 'lucide-react';
import { apiFetch, getToken } from '../../lib/api';
import { useMe } from '../../lib/useMe';
import { PortalShell } from '../../components/PortalShell';

interface SoftwareTile {
  id: string;
  key: string;
  label: string;
  url: string;
  sortOrder: number;
}

// Tile colors keyed by SoftwareTile.key -- a plain fallback palette, nothing elaborate
// (Phase 6's own tone: "maybe a simple icon/color, nothing elaborate").
const TILE_COLORS: Record<string, string> = {
  lgdesk: 'var(--p)',
};
const DEFAULT_TILE_COLOR = 'var(--muted)';

// P28: SoftwareTile has no description field (checked schema.prisma before adding this --
// not inventing backend data). This is a small, static, purely-presentational UI label,
// same pattern as TILE_COLORS above -- not a stat, count, or fabricated activity.
const TILE_SUBTITLES: Record<string, string> = {
  lgdesk: 'Task & project management',
};

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function DashboardPage() {
  const { me, loading } = useMe();
  const [tiles, setTiles] = useState<SoftwareTile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    apiFetch<SoftwareTile[]>('/software-tiles')
      .then(setTiles)
      .catch(() => setError('Unable to load your tools'));
  }, [me]);

  function openTile(tile: SoftwareTile) {
    const token = getToken();
    window.location.href = `${tile.url}/sso-callback?token=${encodeURIComponent(token ?? '')}`;
  }

  if (loading || !me) return null;

  return (
    <PortalShell me={me} title="Dashboard">
      {/* Greeting band -- same navy-to-teal gradient as the login card, so the
          dashboard reads as the same product picking up where sign-in left off,
          not a bare content page. Real data only: name from /auth/me, date computed
          client-side, role/team pills from the already-loaded session. */}
      <div
        className="rounded-[var(--r)] p-6 mb-6 text-white flex flex-wrap items-center justify-between gap-4"
        style={{ background: 'linear-gradient(135deg,#2D3E51 0%,#2F6E68 100%)' }}
      >
        <div>
          <h2 className="text-xl font-bold">{greeting()}, {me.firstName}!</h2>
          <p className="text-sm text-white/70 mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <span className="rounded-full bg-white/15 px-3 py-1">{me.role}</span>
          {me.team && <span className="rounded-full bg-white/15 px-3 py-1">{me.team}</span>}
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-3 text-[15px] font-semibold text-p">
        <LayoutGrid size={15} />
        <span>Your tools</span>
      </div>

      {error && <p className="text-danger text-sm mb-4">{error}</p>}
      {!error && tiles !== null && tiles.length === 0 && <div className="empty-state">No tools available yet.</div>}

      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
        {(tiles ?? []).map((tile) => (
          <button
            key={tile.id}
            onClick={() => openTile(tile)}
            className="card relative flex flex-col items-start gap-3 p-5 text-left transition-all hover:shadow-card hover:-translate-y-0.5"
          >
            <ArrowUpRight size={16} className="absolute top-4 right-4 text-muted2" />
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-lg shrink-0"
              style={{ background: TILE_COLORS[tile.key] ?? DEFAULT_TILE_COLOR }}
            >
              {tile.label.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="text-sm font-semibold text-text">{tile.label}</div>
              {TILE_SUBTITLES[tile.key] && (
                <div className="text-xs text-muted mt-0.5">{TILE_SUBTITLES[tile.key]}</div>
              )}
            </div>
          </button>
        ))}
      </div>
    </PortalShell>
  );
}
