'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Icon } from '../../ui/icon';
import { apiErrorMessage } from '../../../lib/api/client';
import { registerRequest } from '../../../lib/api/auth';
import { Spinner } from '../../ui/spinner';
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
  const managerManual = MANUAL_MANAGER_ROLES.includes(role as (typeof MANUAL_MANAGER_ROLES)[number]);
  const subDeptOptions = subDepartmentsFor(team);
  const hasSubDepts = subDepartmentRequired(team);

  if (!open) return null;

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

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-hd">
          <span className="modal-hd-title">Request Access — Register</span>
          <button className="modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        {submitted ? (
          <div className="modal-bd">
            <div className="empty-state">
              <Icon name="check_circle" size={40} className="ei" style={{ color: 'var(--ok)', opacity: 1 }} />
              <p><strong>Registration submitted!</strong><br />Your manager will review your request. You can sign in once it&apos;s approved.</p>
            </div>
            <button className="btn btn-primary btn-full" onClick={onClose}>Done</button>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="modal-bd" noValidate>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel>First Name</FormLabel>
                      <FormControl><input className="fc" {...field} /></FormControl>
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
                      <FormControl><input className="fc" {...field} /></FormControl>
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
                    <FormControl><input className="fc" type="email" placeholder="you@company.com" {...field} /></FormControl>
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
                      <FormControl><input className="fc" type="date" {...field} /></FormControl>
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
                        <input className="fc" type="password" autoComplete="new-password" placeholder="Min 6 characters" {...field} />
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
                        <input className="fc" type="password" autoComplete="new-password" {...field} />
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
                    <FormControl><input className="fc" maxLength={100} {...field} /></FormControl>
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
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel>{role === 'Super Admin' ? 'Reports-to Email (optional)' : managerManual ? 'Reports-to Email' : "Manager's Email"}</FormLabel>
                    <FormControl>
                      <input className="fc" type="email" placeholder={managerManual ? 'manager@company.com' : 'Auto-resolved on approval'} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="message"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel>Message (optional)</FormLabel>
                    <FormControl><textarea className="fc" rows={2} style={{ resize: 'none' }} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {error && <div style={{ background: '#fce8e8', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}

              <button type="submit" className="btn btn-primary btn-full" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Spinner size={14} />}{form.formState.isSubmitting ? 'Submitting…' : 'Submit Registration'}
              </button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}

export default RegistrationModal;
