'use client';

import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { toast } from '../../../lib/toast';

// NOTE: the weekly-summary backend (Gemini generation + persistence) is not built yet.
// This modal is the GAS Option-C inline-edit UI with local state; bullets are not yet persisted.
export function WeeklySummaryModal({ open, onClose, weekLabel }: { open: boolean; onClose: () => void; weekLabel: string }) {
  const [bullets, setBullets] = useState<string[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  if (!open) return null;

  const startEdit = (i: number) => { setEditIdx(i); setDraft(bullets[i]); };
  const confirm = (i: number) => {
    const t = draft.trim();
    setBullets((b) => (t ? b.map((x, idx) => (idx === i ? t : x)) : b.filter((_, idx) => idx !== i)));
    setEditIdx(null); setDraft('');
  };
  const cancel = (i: number) => { if (!bullets[i].trim()) setBullets((b) => b.filter((_, idx) => idx !== i)); setEditIdx(null); setDraft(''); };
  const remove = (i: number) => { setBullets((b) => b.filter((_, idx) => idx !== i)); setEditIdx(null); };
  const addPoint = () => { setBullets((b) => [...b, '']); setEditIdx(bullets.length); setDraft(''); };
  const copyAll = () => {
    const text = bullets.filter(Boolean).map((b) => `• ${b}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard', 'success')).catch(() => toast('Copy failed', 'error'));
  };

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-hd">
          <span className="modal-hd-title">Weekly Summary</span>
          <button className="modal-x" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-bd">
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            {weekLabel} <span style={{ background: 'var(--p3)', color: 'var(--p)', borderRadius: 10, padding: '1px 8px', fontSize: 10, marginLeft: 6 }}>editable</span>
          </div>

          {bullets.length === 0 ? (
            <div className="empty-state">
              <span className="ei material-symbols-outlined">description</span>
              <p><strong>No summary for this week yet</strong><br />Summaries are auto-generated every Monday. You can start adding points now.</p>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 8 }}>Click any point to edit</div>
              <div>
                {bullets.map((b, i) => (
                  editIdx === i ? (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <textarea className="fc" rows={2} autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} style={{ flex: 1 }} />
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <button className="btn btn-sm" style={{ background: '#2D3E51', color: '#fff' }} onClick={() => confirm(i)}><Icon name="check" size={15} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => cancel(i)}><Icon name="undo" size={15} /></button>
                        <button className="btn btn-sm" style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={() => remove(i)}><Icon name="delete" size={15} /></button>
                      </div>
                    </div>
                  ) : (
                    b.trim() ? (
                      <div key={i} onClick={() => startEdit(i)} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', cursor: 'pointer' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--danger)', marginTop: 6, flexShrink: 0 }} />
                        <span style={{ fontSize: 13 }}>{b}</span>
                      </div>
                    ) : null
                  )
                ))}
              </div>
            </>
          )}

          <button className="wl-add-item-btn" style={{ marginTop: 12 }} onClick={addPoint}><Icon name="add" size={13} /> Add a point</button>
        </div>
        <div className="modal-ft" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-accent btn-sm" onClick={() => toast('AI generation needs the weekly-summary backend (coming soon)', 'info')}><Icon name="auto_awesome" size={15} /> Generate Now</button>
            {bullets.some(Boolean) && <button className="btn btn-ghost btn-sm" onClick={copyAll}><Icon name="content_copy" size={15} /> Copy</button>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default WeeklySummaryModal;
