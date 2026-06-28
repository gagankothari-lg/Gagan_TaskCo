'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { api, apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../ui/spinner';

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm ' +
  'placeholder:text-[var(--muted)] focus:border-[var(--p)] focus:outline-none transition-colors';

export function RegistrationModal({ open, onClose }: RegistrationModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [team, setTeam] = useState('');
  const [designation, setDesignation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/register/request', {
        firstName,
        lastName,
        email,
        password,
        team: team || undefined,
        designation: designation || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to submit registration'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-[440px] rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--text)]">Request access</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
            <Icon name="close" size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Icon name="check_circle" size={40} className="text-[var(--ok)]" />
            <p className="text-sm font-medium text-[var(--text)]">Request submitted</p>
            <p className="text-sm text-[var(--muted)]">
              A manager will review your request. You&apos;ll be able to sign in once it&apos;s approved.
            </p>
            <button
              onClick={onClose}
              className="btn btn-ghost mt-2"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <input className={inputClass} placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
            <input className={inputClass} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <div className="grid grid-cols-2 gap-3">
              <input className={inputClass} type="password" autoComplete="new-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <input className={inputClass} type="password" autoComplete="new-password" placeholder="Confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <input className={inputClass} placeholder="Team (optional)" value={team} onChange={(e) => setTeam(e.target.value)} />
            <input className={inputClass} placeholder="Designation (optional)" value={designation} onChange={(e) => setDesignation(e.target.value)} />

            {error && (
              <div className="rounded-[8px] border border-[var(--danger)]/40 bg-[var(--danger)]/10 px-3 py-2 text-sm text-[var(--danger)]">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-full disabled:opacity-60"
            >
              {loading && <Spinner size={14} />}
              {loading ? 'Submitting…' : 'Submit request'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default RegistrationModal;
