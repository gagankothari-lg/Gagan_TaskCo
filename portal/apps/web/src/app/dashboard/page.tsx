'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError, getToken, clearToken } from '../../lib/api';

interface SoftwareTile {
  id: string;
  key: string;
  label: string;
  url: string;
  sortOrder: number;
}

interface Me {
  firstName: string;
  lastName: string;
  email: string;
}

// Tile colors keyed by SoftwareTile.key -- a plain fallback palette, nothing elaborate
// (Phase 6's own tone: "maybe a simple icon/color, nothing elaborate").
const TILE_COLORS: Record<string, string> = {
  lgdesk: '#1a237e',
};
const DEFAULT_TILE_COLOR = '#455a64';

export default function DashboardPage() {
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [tiles, setTiles] = useState<SoftwareTile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace('/');
      return;
    }
    (async () => {
      try {
        const [meData, tilesData] = await Promise.all([
          apiFetch<Me>('/auth/me'),
          apiFetch<SoftwareTile[]>('/software-tiles'),
        ]);
        setMe(meData);
        setTiles(tilesData);
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          clearToken();
          router.replace('/');
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Unable to load');
      } finally {
        setChecked(true);
      }
    })();
  }, [router]);

  async function onLogout() {
    try {
      await apiFetch('/auth/logout', { method: 'POST' });
    } catch {
      // Best-effort — clear locally regardless of server outcome, same as LGDesk's logout().
    }
    clearToken();
    router.replace('/');
  }

  function openTile(tile: SoftwareTile) {
    const token = getToken();
    window.location.href = `${tile.url}/sso-callback?token=${encodeURIComponent(token ?? '')}`;
  }

  if (!checked) return null;

  return (
    <main style={{ minHeight: '100vh', fontFamily: 'system-ui, sans-serif', background: '#f0f2f5' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', background: '#1a237e', color: '#fff' }}>
        <div style={{ fontWeight: 700, fontSize: 18 }}>Portal</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {me && <span style={{ fontSize: 13 }}>{me.firstName} {me.lastName}</span>}
          <button
            onClick={onLogout}
            style={{ fontSize: 13, background: 'none', border: '1px solid rgba(255,255,255,.4)', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer' }}
          >
            Log out
          </button>
        </div>
      </header>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: 24 }}>
        <h1 style={{ fontSize: 18, color: '#333', marginBottom: 16 }}>Your tools</h1>
        {error && <p style={{ color: '#c62828' }}>{error}</p>}
        {!error && tiles !== null && tiles.length === 0 && <p style={{ color: '#666' }}>No tools available yet.</p>}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {(tiles ?? []).map((tile) => (
            <button
              key={tile.id}
              onClick={() => openTile(tile)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '24px 12px',
                border: '1px solid #ddd',
                borderRadius: 10,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: TILE_COLORS[tile.key] ?? DEFAULT_TILE_COLOR,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {tile.label.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#333' }}>{tile.label}</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 32, paddingTop: 16, borderTop: '1px solid #ddd' }}>
          <p style={{ fontSize: 12, color: '#999', marginBottom: 8 }}>
            Admin tools (shown to everyone for now — Phase 6 has no role-based nav yet; the
            approval endpoints themselves are still role-gated server-side)
          </p>
          <div style={{ display: 'flex', gap: 16, fontSize: 13 }}>
            <a href="/registration" style={{ color: '#1a237e' }}>Registration approvals →</a>
            <a href="/profile-updates" style={{ color: '#1a237e' }}>Profile-update approvals →</a>
          </div>
        </div>
      </div>
    </main>
  );
}
