'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useSubmitProfileUpdate, useMe } from '../../../lib/api/teamMembers';
import { useChangePassword } from '../../../lib/api/auth';
import { apiErrorMessage } from '../../../lib/api/client';
import { RoleBadge } from '../../ui/role-badge';
import { Spinner } from '../../ui/spinner';
import type { ProfileUpdateInput } from '../../../lib/types';

interface ProfileModalProps {
  open: boolean;
  onClose: () => void;
}

const inputClass =
  'w-full bg-[var(--bg)] border border-[var(--border)] text-[var(--text)] rounded-[8px] px-3 py-2 text-sm ' +
  'placeholder:text-[var(--muted)] focus:border-[var(--p)] focus:outline-none transition-colors';

export function ProfileModal({ open, onClose }: ProfileModalProps) {
  const { currentUser, refresh } = useAuth();
  const submitProfile = useSubmitProfileUpdate();
  const changePassword = useChangePassword();
  const { logout } = useAuth();
  const me = useMe(open); // fetch own record (incl. pending profile request) only while open
  const hasPending = !!me.data?.pendingProfileRequest;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [team, setTeam] = useState('');
  const [designation, setDesignation] = useState('');
  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err' | 'pending'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Reset form to current values whenever the modal opens.
  useEffect(() => {
    if (open && currentUser) {
      setFirstName(currentUser.firstName ?? '');
      setLastName(currentUser.lastName ?? '');
      setTeam(currentUser.team ?? '');
      setDesignation(currentUser.designation ?? '');
      setProfileMsg(null);
      setPwMsg(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    }
  }, [open, currentUser]);

  if (!currentUser) return null;

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    const changes: ProfileUpdateInput = {};
    if (firstName !== (currentUser!.firstName ?? '')) changes.firstName = firstName;
    if (lastName !== (currentUser!.lastName ?? '')) changes.lastName = lastName;
    if (team !== (currentUser!.team ?? '')) changes.team = team;
    if (designation !== (currentUser!.designation ?? '')) changes.designation = designation;

    if (Object.keys(changes).length === 0) {
      setProfileMsg({ kind: 'ok', text: 'No changes to save.' });
      return;
    }
    try {
      const res = await submitProfile.mutateAsync(changes);
      if (res.immediate) {
        setProfileMsg({ kind: 'ok', text: 'Profile updated.' });
        await refresh();
      } else {
        setProfileMsg({ kind: 'pending', text: 'Change submitted — pending manager approval.' });
      }
    } catch (err) {
      setProfileMsg({ kind: 'err', text: apiErrorMessage(err, 'Unable to update profile') });
    }
  }

  async function updatePassword(e: FormEvent) {
    e.preventDefault();
    setPwMsg(null);
    if (newPassword.length < 8) {
      setPwMsg({ kind: 'err', text: 'Password must be at least 8 characters' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ kind: 'err', text: 'Passwords do not match' });
      return;
    }
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      setPwMsg({ kind: 'ok', text: 'Password updated. Signing you out…' });
      setTimeout(() => logout(), 1200);
    } catch (err) {
      setPwMsg({ kind: 'err', text: apiErrorMessage(err, 'Unable to change password') });
    }
  }

  const msgColor = (kind: 'ok' | 'err' | 'pending') =>
    kind === 'err'
      ? 'border-[var(--danger)]/40 bg-[var(--danger)]/10 text-[var(--danger)]'
      : kind === 'pending'
        ? 'border-[var(--warn)]/40 bg-[var(--warn)]/10 text-[var(--warn)]'
        : 'border-[var(--ok)]/40 bg-[var(--ok)]/10 text-[var(--ok)]';

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        className={[
          'fixed inset-0 z-40 bg-black/50 transition-opacity',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
        aria-hidden
      />
      {/* Panel */}
      <aside
        role="dialog"
        aria-label="My profile"
        className={[
          'fixed right-0 top-0 z-50 h-full w-[420px] max-w-full border-l border-[var(--border)] bg-[var(--surface)]',
          'flex flex-col transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full',
        ].join(' ')}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 h-[52px] shrink-0">
          <h2 className="text-sm font-semibold text-[var(--text)]">My Profile</h2>
          <button onClick={onClose} aria-label="Close" className="text-[var(--muted)] hover:text-[var(--text)]">
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Identity */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--p)] text-white font-semibold">
              {`${currentUser.firstName?.[0] ?? ''}${currentUser.lastName?.[0] ?? ''}`.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-[var(--text)]">{currentUser.name}</p>
              <p className="truncate text-xs text-[var(--muted)]">{currentUser.email}</p>
              <div className="mt-1 flex items-center gap-1.5">
                <RoleBadge role={currentUser.role} />
                {hasPending && (
                  <span className="inline-flex items-center rounded-[9999px] border border-[var(--warn)]/40 bg-[var(--warn)]/10 px-2 py-0.5 text-xs text-[var(--warn)]">
                    Change pending
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--border)]" />

          {/* Profile form */}
          <form onSubmit={saveProfile} className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Profile</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">First name</label>
                <input className={inputClass} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[var(--muted)]">Last name</label>
                <input className={inputClass} value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">
                Designation <span className="text-[var(--ok)]">(applies immediately)</span>
              </label>
              <input className={inputClass} value={designation} onChange={(e) => setDesignation(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[var(--muted)]">
                Team <span className="text-[var(--warn)]">(needs approval)</span>
              </label>
              <input className={inputClass} value={team} onChange={(e) => setTeam(e.target.value)} />
            </div>
            {profileMsg && (
              <div className={`rounded-[8px] border px-3 py-2 text-sm ${msgColor(profileMsg.kind)}`}>
                {profileMsg.text}
              </div>
            )}
            <button
              type="submit"
              disabled={submitProfile.isPending}
              className="btn btn-primary disabled:opacity-60"
            >
              {submitProfile.isPending && <Spinner size={14} />}
              Save changes
            </button>
          </form>

          <div className="border-t border-[var(--border)]" />

          {/* Change password */}
          <form onSubmit={updatePassword} className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Change password</p>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Current password"
              className={inputClass}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="New password (min 8 chars)"
              className={inputClass}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Confirm new password"
              className={inputClass}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            {pwMsg && (
              <div className={`rounded-[8px] border px-3 py-2 text-sm ${msgColor(pwMsg.kind)}`}>{pwMsg.text}</div>
            )}
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="btn btn-ghost disabled:opacity-60"
            >
              {changePassword.isPending && <Spinner size={14} />}
              Update password
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}

export default ProfileModal;
