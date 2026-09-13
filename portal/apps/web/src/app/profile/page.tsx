'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError, setToken } from '../../lib/api';
import { useMe } from '../../lib/useMe';
import { PortalShell } from '../../components/PortalShell';
import { TEAM_HIERARCHY, DIVISIONS } from '../../lib/team-hierarchy';

// P27: which fields apply immediately vs need manager/admin approval -- exactly
// ProfileUpdatesService.PROFILE_IMMEDIATE_KEYS (Phase 5a, re-read fresh). Don't invent a
// different split; mirrored here only to decide which submitted fields to describe as
// "updated" vs "submitted for approval" in the feedback message -- the server enforces
// the actual split independently either way.
const IMMEDIATE_KEYS = new Set(['designation', 'firstName', 'lastName', 'dob']);
const FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  designation: 'Designation',
  dob: 'Date of birth',
  team: 'Team',
  subDepartment: 'Sub-department',
  newManagerEmail: 'Manager',
};

export default function ProfilePage() {
  const { me, loading, refresh } = useMe();

  if (loading || !me) return null;
  return (
    <PortalShell me={me} title="My Profile">
      <div className="grid gap-6 max-w-2xl">
        <ProfileCard me={me} onSaved={refresh} />
        <ChangePasswordCard />
      </div>
    </PortalShell>
  );
}

function ProfileCard({ me, onSaved }: { me: NonNullable<ReturnType<typeof useMe>['me']>; onSaved: () => Promise<unknown> }) {
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState(me.firstName);
  const [lastName, setLastName] = useState(me.lastName);
  const [designation, setDesignation] = useState(me.designation ?? '');
  const [dob, setDob] = useState(me.dob ?? '');
  const [team, setTeam] = useState(me.team ?? '');
  const [subDepartment, setSubDepartment] = useState(me.subDepartment ?? '');
  const [managerEmail, setManagerEmail] = useState(me.managerEmail ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ immediate: string[]; queued: string[] } | null>(null);

  function startEdit() {
    setFirstName(me.firstName);
    setLastName(me.lastName);
    setDesignation(me.designation ?? '');
    setDob(me.dob ?? '');
    setTeam(me.team ?? '');
    setSubDepartment(me.subDepartment ?? '');
    setManagerEmail(me.managerEmail ?? '');
    setError(null);
    setResult(null);
    setEditing(true);
  }

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const body: Record<string, string> = {};
    if (firstName !== me.firstName) body.firstName = firstName;
    if (lastName !== me.lastName) body.lastName = lastName;
    if (designation !== (me.designation ?? '')) body.designation = designation;
    if (dob !== (me.dob ?? '')) body.dob = dob;
    if (team !== (me.team ?? '')) body.team = team;
    if (subDepartment !== (me.subDepartment ?? '')) body.subDepartment = subDepartment;
    if (managerEmail !== (me.managerEmail ?? '')) body.newManagerEmail = managerEmail;

    if (Object.keys(body).length === 0) {
      setEditing(false);
      setBusy(false);
      return;
    }

    try {
      await apiFetch('/profile-updates', { method: 'POST', body });
      const immediate = Object.keys(body).filter((k) => IMMEDIATE_KEYS.has(k)).map((k) => FIELD_LABELS[k] ?? k);
      const queued = Object.keys(body).filter((k) => !IMMEDIATE_KEYS.has(k)).map((k) => FIELD_LABELS[k] ?? k);
      setResult({ immediate, queued });
      setEditing(false);
      await onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit changes');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-text">Profile details</h2>
        {!editing && (
          <button className="btn btn-outline" onClick={startEdit}>Edit</button>
        )}
      </div>

      {result && (
        <div className="mb-4 text-sm rounded p-3" style={{ background: 'var(--alert-ok-bg)', color: 'var(--ok)' }}>
          {result.immediate.length > 0 && <p>Updated: {result.immediate.join(', ')}.</p>}
          {result.queued.length > 0 && <p>Submitted for approval: {result.queued.join(', ')}. You&apos;ll see the change once a manager/admin approves it.</p>}
        </div>
      )}

      {!editing ? (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <Field label="Employee ID" value={me.empId} />
          <Field label="Email" value={me.email} />
          <Field label="Role" value={me.role} />
          <Field label="Team" value={me.team ?? '—'} />
          <Field label="Sub-department" value={me.subDepartment ?? '—'} />
          <Field label="Designation" value={me.designation ?? '—'} />
          <Field label="Date of birth" value={me.dob ?? '—'} />
          <Field label="Manager" value={me.managerName ? `${me.managerName} (${me.managerEmail})` : '—'} />
        </dl>
      ) : (
        <form onSubmit={onSave}>
          <div className="grid grid-cols-2 gap-x-4">
            <div className="fg">
              <label>First name</label>
              <input className="fc" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
            </div>
            <div className="fg">
              <label>Last name</label>
              <input className="fc" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
            </div>
            <div className="fg">
              <label>Designation</label>
              <input className="fc" value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
            <div className="fg">
              <label>Date of birth</label>
              <input className="fc" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
            </div>
            <div className="fg">
              <label>Team (needs approval)</label>
              <select className="fc" value={team} onChange={(e) => { setTeam(e.target.value); setSubDepartment(''); }}>
                <option value="">— Select —</option>
                {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            {team && TEAM_HIERARCHY[team]?.length > 0 && (
              <div className="fg">
                <label>Sub-department (needs approval)</label>
                <select className="fc" value={subDepartment} onChange={(e) => setSubDepartment(e.target.value)}>
                  <option value="">— Select —</option>
                  {TEAM_HIERARCHY[team].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="fg col-span-2">
              <label>Manager email (needs approval)</label>
              <input className="fc" type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder="manager@company.com" />
            </div>
          </div>
          {error && <p className="text-danger text-sm mb-3">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>
            <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)} disabled={busy}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-text mt-0.5">{value}</dd>
    </div>
  );
}

function ChangePasswordCard() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 5000);
    return () => clearTimeout(t);
  }, [done]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setBusy(true);
    try {
      const { token } = await apiFetch<{ token: string }>('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      });
      setToken(token);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to change password');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-6">
      <h2 className="text-base font-semibold text-text mb-1">Change password</h2>
      <p className="text-xs text-muted mb-4">Changing your password signs you out of every other session. This one stays signed in.</p>
      {done && (
        <div className="mb-4 text-sm rounded p-3" style={{ background: 'var(--alert-ok-bg)', color: 'var(--ok)' }}>
          Password changed. Other sessions have been signed out.
        </div>
      )}
      <form onSubmit={onSubmit} className="max-w-sm">
        <div className="fg">
          <label>Current password</label>
          <input className="fc" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="fg">
          <label>New password</label>
          <input className="fc" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={6} required />
        </div>
        <div className="fg">
          <label>Confirm new password</label>
          <input className="fc" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} minLength={6} required />
        </div>
        {error && <p className="text-danger text-sm mb-3">{error}</p>}
        <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Changing…' : 'Change password'}</button>
      </form>
    </div>
  );
}
