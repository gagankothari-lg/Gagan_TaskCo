'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { apiErrorMessage } from '../../../lib/api/client';
import { registerRequest, useTeamCaptain } from '../../../lib/api/auth';
import { Spinner } from '../../ui/spinner';
import { Button } from '../../ui/button';
import { Input } from '../../ui/input';
import { Textarea } from '../../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../ui/form';
import {
  DIVISIONS,
  MANUAL_MANAGER_ROLES,
  ROLES,
  registrationSchema,
  subDepartmentRequired,
  subDepartmentsFor,
  type RegistrationFormValues,
} from './registration-modal.schema';

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
}

export function RegistrationModal({ open, onClose }: RegistrationModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<RegistrationFormValues>({
    resolver: zodResolver(registrationSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: 'Team Member',
      dob: '',
      team: '',
      subDepartment: '',
      designation: '',
      managerEmail: '',
      message: '',
    },
  });

  const role = form.watch('role');
  const team = form.watch('team');
  const subDepartment = form.watch('subDepartment');
  const managerManual = MANUAL_MANAGER_ROLES.includes(role as (typeof MANUAL_MANAGER_ROLES)[number]);
  const subDeptOptions = subDepartmentsFor(team);
  const hasSubDepts = subDepartmentRequired(team);

  // PFIX-REGISTRATION-MANAGER-EMAIL: mirrors reference/app.js.html's _regAutoFillManager —
  // Team Member / Team Facilitator / Intern get Manager's Email auto-resolved (team's Team
  // Captain, falling back to any Super Admin then any Admin) and read-only; Super Admin /
  // Admin / Team Captain type it manually (managerManual, handled by the existing label/
  // placeholder switch below). The lookup itself (GET /auth/team-captain) is public/no-auth,
  // matching the reference's own "called before the user has an account" design.
  const autoFillEnabled = !managerManual && !!team;
  const tcQuery = useTeamCaptain(team ?? '', subDepartment ?? '', autoFillEnabled);
  const managerNotFound = autoFillEnabled && tcQuery.isSuccess && tcQuery.data === null;
  const managerLookupFailed = autoFillEnabled && tcQuery.isError;
  const managerLoading = autoFillEnabled && tcQuery.isFetching;
  // Read-only whenever auto-fill applies AND the lookup hasn't "failed open" (reference:
  // a network/script error un-blocks the field so the user can type manually rather than
  // getting stuck) — resolved value, in-flight loading, and the team-not-selected-yet
  // idle state are all read-only; only manual roles and lookup failures are editable.
  const managerReadOnly = !managerManual && !managerLookupFailed;

  // Switching INTO a manual role clears any stale auto-filled address so the user starts
  // from a blank field they actually typed, rather than one that looks resolved but isn't.
  useEffect(() => {
    if (managerManual) form.setValue('managerEmail', '', { shouldValidate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerManual]);

  useEffect(() => {
    if (managerManual) return; // manual roles keep whatever the user typed
    if (!team) { form.setValue('managerEmail', '', { shouldValidate: form.formState.isSubmitted }); return; }
    // Clear during an in-flight lookup too — otherwise a stale previously-resolved email
    // (e.g. from a different Sub-Department) would linger visible while a new one loads,
    // instead of showing the "Looking up manager…" placeholder against an empty value.
    if (tcQuery.isFetching) { form.setValue('managerEmail', '', { shouldValidate: false }); return; }
    if (tcQuery.isError) { form.setValue('managerEmail', '', { shouldValidate: form.formState.isSubmitted }); return; }
    if (tcQuery.isSuccess) {
      form.setValue('managerEmail', tcQuery.data?.email ?? '', { shouldValidate: form.formState.isSubmitted });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [managerManual, team, tcQuery.isFetching, tcQuery.isError, tcQuery.isSuccess, tcQuery.data]);

  async function onSubmit(values: RegistrationFormValues) {
    setError(null);
    try {
      // Only the API-whitelisted fields are persisted; role/dob/manager/message are
      // collected for parity with the GAS form (the backend DTO would 400 on unknown keys).
      await registerRequest({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        password: values.password,
        team: values.team || undefined,
        subDepartment: values.subDepartment || undefined,
        designation: values.designation || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to submit registration'));
    }
  }

  function handleTeamChange(next: string) {
    form.setValue('team', next);
    // Controlled cascade: resetting sub-department whenever the division changes keeps a
    // stale value from a previous division from lingering (and re-triggers validation).
    form.setValue('subDepartment', '', { shouldValidate: form.formState.isSubmitted });
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      // Reset the one-shot "submitted" success screen so a later re-open of this same
      // modal instance starts fresh instead of showing the last request's confirmation.
      setSubmitted(false);
      setError(null);
      onClose();
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Request Access — Register</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="p-5">
            <div className="empty-state">
              <Icon name="check_circle" size={40} className="ei" style={{ color: 'var(--ok)', opacity: 1 }} />
              <p><strong>Registration submitted!</strong><br />Your manager will review your request. You can sign in once it&apos;s approved.</p>
            </div>
            <Button className="w-full" onClick={() => handleOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="p-5" noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>First Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>Last Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel>Work Email</FormLabel>
                    <FormControl><Input type="email" placeholder="you@company.com" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <select className="fc" {...field}>
                          {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dob"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>Date of Birth</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" placeholder="Min 6 characters" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>Confirm Password</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="designation"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel>Designation (optional)</FormLabel>
                    <FormControl><Input maxLength={100} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField
                  control={form.control}
                  name="team"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>Team Division</FormLabel>
                      <FormControl>
                        <select
                          className="fc"
                          name={field.name}
                          ref={field.ref}
                          value={field.value}
                          onBlur={field.onBlur}
                          onChange={(e) => handleTeamChange(e.target.value)}
                        >
                          <option value="">— Select Division —</option>
                          {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="subDepartment"
                  render={({ field }) => (
                    <FormItem className="fg" style={{ opacity: team && !hasSubDepts ? 0.4 : 1 }}>
                      <FormLabel>Sub-Department</FormLabel>
                      <FormControl>
                        <select className="fc" disabled={!hasSubDepts} {...field}>
                          <option value="">{hasSubDepts ? '— Select Sub-department —' : 'N/A for this division'}</option>
                          {subDeptOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="managerEmail"
                render={({ field }) => {
                  const managerPlaceholder = managerManual
                    ? 'manager@company.com'
                    : !team
                      ? 'Select a Team Division first'
                      : managerLoading
                        ? 'Looking up manager…'
                        : managerNotFound
                          ? 'No manager assigned for this team'
                          : managerLookupFailed
                            ? 'Enter manager email manually'
                            : '';
                  return (
                    <FormItem className="fg">
                      <FormLabel>{role === 'Super Admin' ? 'Reports-to Email (optional)' : managerManual ? 'Reports-to Email' : "Manager's Email"}</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={managerPlaceholder}
                          readOnly={managerReadOnly}
                          style={managerNotFound ? { borderColor: 'var(--danger)' } : managerReadOnly && field.value ? { borderColor: 'var(--ok)' } : undefined}
                          {...field}
                        />
                      </FormControl>
                      {managerLoading && (
                        <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>⏳ Fetching manager from database…</p>
                      )}
                      {!managerLoading && managerReadOnly && field.value && tcQuery.data && (
                        <p style={{ fontSize: 12, color: 'var(--ok)', margin: 0 }}>✓ Auto-filled: {tcQuery.data.name} (Manager)</p>
                      )}
                      {managerNotFound && (
                        <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>No manager is assigned for this team yet. Please contact the admin.</p>
                      )}
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel>Message (optional)</FormLabel>
                    <FormControl><Textarea rows={2} className="resize-none" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && <div style={{ background: '#fce8e8', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting || managerLoading || managerNotFound}
              >
                {form.formState.isSubmitting && <Spinner size={14} />}{form.formState.isSubmitting ? 'Submitting…' : 'Submit Registration'}
              </Button>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RegistrationModal;
