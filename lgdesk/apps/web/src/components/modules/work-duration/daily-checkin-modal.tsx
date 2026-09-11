'use client';

import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { useSetDailyStatus } from '../../../lib/api/workDuration';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { Spinner } from '../../ui/spinner';

// Daily check-in popup (implementation brief 2026-09-09, Feature 1). Answering
// Yes + WFO/WFH IS the clock-in action -- there is no separate "now click Clock In" step
// after this. Not shown for Interns at all (gated by the caller -- see layout-client.tsx).
export function DailyCheckinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const setDailyStatus = useSetDailyStatus();
  const [step, setStep] = useState<'ask' | 'mode'>('ask');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function submit(isWorking: boolean, workMode?: 'WFO' | 'WFH') {
    setError(null);
    try {
      await setDailyStatus.mutateAsync({ isWorking, workMode });
      toast(isWorking ? `Clocked in — ${workMode}` : 'Marked as not working today', 'success');
      setStep('ask');
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save your answer'));
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[380px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
        {step === 'ask' ? (
          <>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Are you working today?</h3>
            <p className="mb-5 text-sm text-[var(--muted)]">Let us know so today&apos;s attendance is logged correctly.</p>
            <div className="flex gap-3">
              <button onClick={() => setStep('mode')} className="btn btn-primary flex-1">
                Yes
              </button>
              <button
                onClick={() => submit(false)}
                disabled={setDailyStatus.isPending}
                className="flex-1 rounded-[8px] border px-4 py-2.5 text-sm font-semibold hover:bg-[var(--hover-tint)] disabled:opacity-60"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                {setDailyStatus.isPending && <Spinner size={14} />} No
              </button>
            </div>
          </>
        ) : (
          <>
            <h3 className="mb-1 text-base font-semibold text-[var(--text)]">Working From Office or Home?</h3>
            <p className="mb-5 text-sm text-[var(--muted)]">This clocks you in for today.</p>
            <div className="flex gap-3">
              <button onClick={() => submit(true, 'WFO')} disabled={setDailyStatus.isPending} className="btn btn-primary flex-1">
                <Icon name="business" size={16} /> WFO
              </button>
              <button onClick={() => submit(true, 'WFH')} disabled={setDailyStatus.isPending} className="btn btn-primary flex-1">
                <Icon name="home" size={16} /> WFH
              </button>
            </div>
            <button
              onClick={() => setStep('ask')}
              className="mt-3 text-xs hover:text-[var(--text)]"
              style={{ color: 'var(--muted)' }}
            >
              ← Back
            </button>
          </>
        )}
        {error && (
          <div className="mt-3 rounded-[8px] border px-3 py-2 text-sm" style={{ borderColor: 'rgba(198,40,40,.4)', background: 'rgba(198,40,40,.1)', color: 'var(--danger)' }}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

export default DailyCheckinModal;
