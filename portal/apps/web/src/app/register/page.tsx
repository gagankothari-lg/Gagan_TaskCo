'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { takePendingGoogleIdToken, decodeJwtPayloadUnsafe } from '../../lib/session';
import { TEAM_HIERARCHY, DIVISIONS } from '../../lib/team-hierarchy';
import { ThemeToggle } from '../../components/ThemeToggle';

const ALL_ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator', 'Team Member', 'Intern'];
// Same as apps/api/src/common/constants.ts's MANUAL_MANAGER_ROLES -- these roles type in
// who they report to; everyone else gets it auto-resolved via the team-captain lookup.
const MANUAL_MANAGER_ROLES = new Set(['Super Admin', 'Admin', 'Team Captain']);

export default function RegisterPage() {
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Team Member');
  const [team, setTeam] = useState('');
  const [subDepartment, setSubDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [dob, setDob] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [resolvedManager, setResolvedManager] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const manualManager = MANUAL_MANAGER_ROLES.has(role);

  // Google-assisted path (Phase 6 Part 2): pick up the already-verified ID token exactly
  // once and prefill name/email -- the person shouldn't need to notice a difference beyond
  // "continue filling in your details."
  useEffect(() => {
    const token = takePendingGoogleIdToken();
    if (!token) return;
    setGoogleIdToken(token);
    const payload = decodeJwtPayloadUnsafe(token);
    if (payload) {
      if (typeof payload.given_name === 'string') setFirstName(payload.given_name);
      if (typeof payload.family_name === 'string') setLastName(payload.family_name);
      if (typeof payload.email === 'string') setEmail(payload.email);
    }
  }, []);

  // Manager/Team-Captain auto-fill lookup (Phase 4a) for every role except the manual ones.
  useEffect(() => {
    if (manualManager || !team) {
      setResolvedManager(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ team, ...(subDepartment ? { subDept: subDepartment } : {}) });
        const tc = await apiFetch<{ email: string; name: string } | null>(`/registration/team-captain?${qs.toString()}`);
        if (!cancelled) setResolvedManager(tc);
      } catch {
        if (!cancelled) setResolvedManager(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [team, subDepartment, manualManager]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/registration', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          email,
          password,
          role,
          team: team || undefined,
          subDepartment: subDepartment || undefined,
          designation: designation || undefined,
          dob: dob || undefined,
          managerEmail: manualManager && managerEmail ? managerEmail : undefined,
          googleIdToken: googleIdToken ?? undefined,
        },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit registration');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-4"
        style={{ background: 'linear-gradient(135deg,#2D3E51 0%,#2F6E68 100%)' }}
      >
        <div className="fixed top-4 right-4">
          <ThemeToggle />
        </div>
        <div className="card w-full max-w-sm p-8 text-center">
          <h1 className="text-lg font-bold mb-2" style={{ color: 'var(--ok)' }}>Request submitted</h1>
          <p className="text-sm text-muted">Your registration is pending approval from your manager or an admin. You&apos;ll be able to sign in once it&apos;s approved.</p>
          <a href="/" className="inline-block mt-4 text-p-fg text-sm font-semibold hover:underline">← Back to sign in</a>
        </div>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen flex items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg,#2D3E51 0%,#2F6E68 100%)' }}
    >
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <form onSubmit={onSubmit} className="card w-full max-w-md p-8">
        <h1 className="text-xl font-bold text-p-fg">Register</h1>
        <p className="text-sm text-muted mb-4">
          {googleIdToken ? 'Continue setting up your account.' : 'Create your account.'}
        </p>

        <div className="grid grid-cols-2 gap-2">
          <div className="fg">
            <label>First name</label>
            <input className="fc" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="fg">
            <label>Last name</label>
            <input className="fc" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>
        <div className="fg">
          <label>Email</label>
          <input className="fc" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="fg">
          <label>Password (min 6 characters)</label>
          <input className="fc" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </div>

        <div className="fg">
          <label>Role</label>
          <select className="fc" value={role} onChange={(e) => setRole(e.target.value)}>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>

        <div className="fg">
          <label>Team</label>
          <select className="fc" value={team} onChange={(e) => { setTeam(e.target.value); setSubDepartment(''); }}>
            <option value="">— Select a division —</option>
            {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {team && TEAM_HIERARCHY[team]?.length > 0 && (
          <div className="fg">
            <label>Sub-department</label>
            <select className="fc" value={subDepartment} onChange={(e) => setSubDepartment(e.target.value)}>
              <option value="">— Select —</option>
              {TEAM_HIERARCHY[team].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        <div className="fg">
          <label>Designation (optional)</label>
          <input className="fc" value={designation} onChange={(e) => setDesignation(e.target.value)} />
        </div>
        <div className="fg">
          <label>Date of birth</label>
          <input className="fc" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
        </div>

        <div className="fg">
          <label>Reports to</label>
          {manualManager ? (
            <input
              className="fc"
              type="email"
              placeholder={role === 'Super Admin' ? "Manager's email (optional)" : "Manager's email"}
              value={managerEmail}
              onChange={(e) => setManagerEmail(e.target.value)}
              required={role !== 'Super Admin'}
            />
          ) : (
            <input
              className="fc"
              readOnly
              value={resolvedManager ? `${resolvedManager.name} (${resolvedManager.email})` : team ? 'Resolving…' : 'Select a team first'}
              style={{ background: 'var(--bg)', color: 'var(--muted)' }}
            />
          )}
        </div>

        {error && <p className="text-danger text-sm mb-3">{error}</p>}

        <button type="submit" disabled={busy} className="btn btn-primary btn-full mt-2">
          {busy ? 'Submitting…' : 'Submit registration'}
        </button>
        <p className="text-sm text-muted mt-3 text-center">
          <a href="/" className="text-p-fg font-semibold hover:underline">← Back to sign in</a>
        </p>
      </form>
    </main>
  );
}
