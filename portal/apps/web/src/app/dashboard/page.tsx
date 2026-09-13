'use client';

import { useEffect, useState } from 'react';
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
      <p className="text-sm text-muted mb-4">Welcome, {me.firstName}. Choose a tool below.</p>
      {error && <p className="text-danger text-sm mb-4">{error}</p>}
      {!error && tiles !== null && tiles.length === 0 && <div className="empty-state">No tools available yet.</div>}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {(tiles ?? []).map((tile) => (
          <button
            key={tile.id}
            onClick={() => openTile(tile)}
            className="card flex flex-col items-center justify-center gap-3 py-8 px-3 hover:shadow-card transition-shadow"
          >
            <div
              className="w-12 h-12 rounded flex items-center justify-center text-white font-bold text-lg"
              style={{ background: TILE_COLORS[tile.key] ?? DEFAULT_TILE_COLOR }}
            >
              {tile.label.charAt(0).toUpperCase()}
            </div>
            <span className="text-sm font-semibold text-text">{tile.label}</span>
          </button>
        ))}
      </div>
    </PortalShell>
  );
}
