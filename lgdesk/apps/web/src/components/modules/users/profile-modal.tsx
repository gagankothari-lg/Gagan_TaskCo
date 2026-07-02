'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { useSubmitProfileUpdate, useMe } from '../../../lib/api/teamMembers';
import { useChangePassword } from '../../../lib/api/auth';
import { apiErrorMessage } from '../../../lib/api/client';
import { RoleBadge } from '../../ui/role-badge';
import { Spinner } from '../../ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import type { ProfileUpdateInput } from '../../../lib/types';
import {
  profileUpdateSchema,
  changePasswordSchema,
  type ProfileUpdateFormValues,
  type ChangePasswordFormValues,
} from './profile-modal.schema';

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

  const [profileMsg, setProfileMsg] = useState<{ kind: 'ok' | 'err' | 'pending'; text: string } | null>(null);
  const [pwMsg, setPwMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const profileForm = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: { firstName: '', lastName: '', team: '', designation: '' },
  });

  const passwordForm = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  // Reset both forms to current values whenever the modal opens.
  useEffect(() => {
    if (open && currentUser) {
      profileForm.reset({
        firstName: currentUser.firstName ?? '',
        lastName: currentUser.lastName ?? '',
        team: currentUser.team ?? '',
        designation: currentUser.designation ?? '',
      });
      passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setProfileMsg(null);
      setPwMsg(null);
    }
  }, [open, currentUser, profileForm, passwordForm]);

  if (!currentUser) return null;

  async function saveProfile(values: ProfileUpdateFormValues) {
    setProfileMsg(null);
    const changes: ProfileUpdateInput = {};
    if (values.firstName !== (currentUser!.firstName ?? '')) changes.firstName = values.firstName;
    if (values.lastName !== (currentUser!.lastName ?? '')) changes.lastName = values.lastName;
    if ((values.team ?? '') !== (currentUser!.team ?? '')) changes.team = values.team;
    if ((values.designation ?? '') !== (currentUser!.designation ?? '')) changes.designation = values.designation;

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

  async function updatePassword(values: ChangePasswordFormValues) {
    setPwMsg(null);
    try {
      await changePassword.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword });
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
          <Form {...profileForm}>
            <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Profile</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-[var(--muted)]">First name</FormLabel>
                      <FormControl><input className={inputClass} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="mb-1 block text-xs text-[var(--muted)]">Last name</FormLabel>
                      <FormControl><input className={inputClass} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={profileForm.control}
                name="designation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">
                      Designation <span className="text-[var(--ok)]">(applies immediately)</span>
                    </FormLabel>
                    <FormControl><input className={inputClass} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="team"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="mb-1 block text-xs text-[var(--muted)]">
                      Team <span className="text-[var(--warn)]">(needs approval)</span>
                    </FormLabel>
                    <FormControl><input className={inputClass} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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
          </Form>

          <div className="border-t border-[var(--border)]" />

          {/* Change password */}
          <Form {...passwordForm}>
            <form onSubmit={passwordForm.handleSubmit(updatePassword)} className="space-y-3">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Change password</p>
              <FormField
                control={passwordForm.control}
                name="currentPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        type="password"
                        autoComplete="current-password"
                        placeholder="Current password"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="New password (min 6 chars)"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <input
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        className={inputClass}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
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
          </Form>
        </div>
      </aside>
    </>
  );
}

export default ProfileModal;
