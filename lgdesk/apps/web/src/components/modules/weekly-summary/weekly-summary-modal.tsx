'use client';

import { useEffect, useState } from 'react';
import { Icon } from '../../ui/icon';
import { toast } from '../../../lib/toast';
import { apiErrorMessage } from '../../../lib/api';
import { useWeeklySummary, useSaveWeeklySummary, useGenerateWeeklySummary } from '../../../hooks/use-weekly-summary';
import { Spinner } from '../../ui/spinner';

// GAS Option-C inline-edit summary. Bullets persist via the weekly-summary API
// (Gemini generation server-side; stored newline-delimited WITHOUT the "• " prefix).
export function WeeklySummaryModal({ open, onClose, weekLabel, weekStart }: { open: boolean; onClose: () => void; weekLabel: string; weekStart: string }) {
  const { data: summary, isLoading } = useWeeklySummary(weekStart, open);
  const save = useSaveWeeklySummary();
  const generate = useGenerateWeeklySummary();

  const [bullets, setBullets] = useState<string[]>([]);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [savedHint, setSavedHint] = useState(false);

  // Sync local bullets from server when not actively editing.
  useEffect(() => {
    if (summary && editIdx === null) setBullets(summary.bullets);
  }, [summary, editIdx]);

  if (!open) return null;

  const persist = (next: string[]) => {
    save.mutate({ weekStart, bullets: next.filter(Boolean) }, {
      onSuccess: () => { setSavedHint(true); setTimeout(() => setSavedHint(false), 2500); },
      onError: (e) => toast(apiErrorMessage(e, 'Save failed'), 'error'),
    });
  };

  const startEdit = (i: number) => { setEditIdx(i); setDraft(bullets[i]); };
  const confirm = (i: number) => {
    const t = draft.trim();
    const next = t ? bullets.map((x, idx) => (idx === i ? t : x)) : bullets.filter((_, idx) => idx !== i);
    setBullets(next); setEditIdx(null); setDraft('');
    persist(next);
  };
  const cancel = (i: number) => { if (!bullets[i].trim()) setBullets((b) => b.filter((_, idx) => idx !== i)); setEditIdx(null); setDraft(''); };
  const remove = (i: number) => { const next = bullets.filter((_, idx) => idx !== i); setBullets(next); setEditIdx(null); persist(next); };
  const addPoint = () => { setBullets((b) => [...b, '']); setEditIdx(bullets.length); setDraft(''); };

  const copyAll = () => {
    const text = bullets.filter(Boolean).map((b) => `• ${b}`).join('\n');
    navigator.clipboard?.writeText(text).then(() => toast('Copied to clipboard', 'success')).catch(() => toast('Copy failed', 'error'));
  };

  const runGenerate = async () => {
    try { await generate.mutateAsync(weekStart); toast('Summary generated', 'success'); }
    catch (e) { toast(apiErrorMessage(e, 'Generation failed'), 'error'); }
  };

  const hasBullets = bullets.some(Boolean);

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-hd">
          <span className="modal-hd-title">Weekly Summary</span>
          <button className="modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>
        <div className="modal-bd">
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12 }}>
            {weekLabel}
            {summary?.found && <span style={{ background: 'var(--p3)', color: 'var(--p)', borderRadius: 10, padding: '1px 8px', fontSize: 10, marginLeft: 6 }}>editable</span>}
          </div>

          {isLoading || generate.isPending ? (
            <div className="empty-state">
              <Spinner size={22} />
              <p style={{ marginTop: 10 }}>{generate.isPending ? 'Generating summary with AI…' : 'Loading…'}</p>
            </div>
          ) : !hasBullets ? (
            <div className="empty-state">
              <Icon name="description" size={40} className="ei" />
              <p><strong>No summary for this week yet</strong><br />Summaries are auto-generated every Monday. Generate one now if your work logs are filled in.</p>
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
                        <button className="btn btn-sm" style={{ background: '#2D3E51', color: '#fff' }} onClick={() => confirm(i)} title="Save"><Icon name="check" size={15} /></button>
                        <button className="btn btn-ghost btn-sm" onClick={() => cancel(i)} title="Cancel"><Icon name="undo" size={15} /></button>
                        <button className="btn btn-sm" style={{ background: 'transparent', color: '#dc2626', border: '1px solid #fca5a5' }} onClick={() => remove(i)} title="Delete"><Icon name="delete" size={15} /></button>
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

          {!generate.isPending && <button className="wl-add-item-btn" style={{ marginTop: 12 }} onClick={addPoint}><Icon name="add" size={13} /> Add a point</button>}
        </div>
        <div className="modal-ft" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-accent btn-sm" disabled={generate.isPending} onClick={runGenerate}>
              <Icon name="auto_awesome" size={15} /> {summary?.found ? 'Regenerate' : 'Generate Now'}
            </button>
            {hasBullets && <button className="btn btn-ghost btn-sm" onClick={copyAll}><Icon name="content_copy" size={15} /> Copy</button>}
            {savedHint && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, color: 'var(--ok)' }}>
                <Icon name="check" size={13} /> Saved
              </span>
            )}
            {summary?.generatedAt && <span style={{ fontSize: 11, color: 'var(--muted2)' }}>Generated {new Date(summary.generatedAt).toLocaleString()}{summary.isEdited ? ' · edited' : ''}</span>}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default WeeklySummaryModal;
