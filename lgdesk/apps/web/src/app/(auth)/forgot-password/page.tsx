'use client';

import { useState, type KeyboardEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiErrorMessage } from '../../../lib/api/client';
import { requestPasswordReset, confirmPasswordReset } from '../../../lib/api/auth';
import { redirectToPortalLogin } from '../../../lib/portal';
import { Icon } from '../../../components/ui/icon';
import { tokens } from '../../../lib/design-tokens';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { PasswordInput } from '../../../components/ui/password-input';
import { Spinner } from '../../../components/ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../components/ui/form';
import {
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
  type ForgotPasswordRequestFormValues,
  type ForgotPasswordResetFormValues,
} from './forgot-password-page.schema';

type Mode = 'request' | 'confirm' | 'done';

const GRADIENT = tokens.colors.loginGradient;

// Phase 7b (Portal cutover): the standalone home for forgot-password, carved out of the
// retired (auth)/login page. LGDesk no longer offers its own sign-in -- Portal is the only
// front door -- but this flow stays here (not moved to Portal) as an interim exception,
// since Portal has no password-reset feature built yet and the account being reset lives
// in the shared `users` table LGDesk owns.
export default function ForgotPasswordPage() {
  const [mode, setMode] = useState<Mode>('request');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('Enter your email to receive a reset code.');
  const [loading, setLoading] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const requestForm = useForm<ForgotPasswordRequestFormValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const confirmForm = useForm<ForgotPasswordResetFormValues>({
    resolver: zodResolver(forgotPasswordResetSchema),
    defaultValues: { otp: '', newPw: '', confirmPw: '' },
  });

  async function sendResetCode(emailValue: string) {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(emailValue);
      setResetEmail(emailValue);
      setStatus('If that email exists, a 6-digit code was sent. Enter it below.');
      setMode('confirm');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to send reset code'));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword(values: ForgotPasswordResetFormValues) {
    setError(null);
    setLoading(true);
    try {
      await confirmPasswordReset({ email: resetEmail, otp: values.otp.trim(), newPassword: values.newPw });
      setError(null);
      setStatus('Password reset! Redirecting you to sign in…');
      setMode('done');
      setTimeout(() => redirectToPortalLogin(), 1200);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to reset password'));
    } finally {
      setLoading(false);
    }
  }

  const errBox = error && (
    <div style={{ background: 'var(--alert-danger-bg)', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginTop: 4 }}>{error}</div>
  );
  const statusLine = status && !error && (
    <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>{status}</div>
  );

  return (
    <main style={{ position: 'fixed', inset: 0, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <Card className="w-full" style={{ maxWidth: 400 }}>
        <div style={{ padding: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
            <div style={{ display: 'flex', color: 'var(--p2)', marginBottom: 8 }}>
              <Icon name="task_alt" size={40} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--p)', marginBottom: 4 }}>LG_Desk. . .</h1>
            <p style={{ fontSize: 13, color: 'var(--muted)' }}>Reset your password</p>
          </div>

          {statusLine}

          {mode === 'request' && (
            <Form {...requestForm}>
              <form onSubmit={requestForm.handleSubmit((values) => sendResetCode(values.email))}>
                <FormField
                  control={requestForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel htmlFor="fp-email">Email</FormLabel>
                      <FormControl>
                        <Input id="fp-email" type="email" placeholder="you@company.com" autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading} style={{ marginTop: 4 }}>
                  {loading && <Spinner size={14} />}{loading ? 'Sending…' : 'Send Reset Code'}
                </Button>
                {errBox}
              </form>
            </Form>
          )}

          {mode === 'confirm' && (
            <Form {...confirmForm}>
              <form onSubmit={confirmForm.handleSubmit(resetPassword)}>
                <FormField
                  control={confirmForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel htmlFor="fp-otp">Reset Code</FormLabel>
                      <FormControl>
                        <Input id="fp-otp" type="text" maxLength={6} placeholder="······" autoFocus {...field} style={{ letterSpacing: 8, textAlign: 'center', fontSize: 18 }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={confirmForm.control}
                  name="newPw"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel htmlFor="fp-newpw">New Password</FormLabel>
                      <FormControl>
                        <PasswordInput id="fp-newpw" field={field} placeholder="At least 6 characters" autoComplete="new-password" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={confirmForm.control}
                  name="confirmPw"
                  render={({ field }) => (
                    <FormItem className="fg">
                      <FormLabel htmlFor="fp-confirmpw">Confirm Password</FormLabel>
                      <FormControl>
                        <PasswordInput
                          id="fp-confirmpw"
                          field={field}
                          placeholder="Re-enter password"
                          autoComplete="new-password"
                          onEnter={() => confirmForm.handleSubmit(resetPassword)()}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Spinner size={14} />}{loading ? 'Resetting…' : 'Reset Password'}
                </Button>
                {errBox}
                <div style={{ textAlign: 'center', marginTop: 14 }}>
                  <a
                    onClick={() => sendResetCode(resetEmail)}
                    onKeyDown={(e: KeyboardEvent<HTMLAnchorElement>) => { if (e.key === 'Enter') sendResetCode(resetEmail); }}
                    role="button"
                    tabIndex={0}
                    style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}
                  >Resend code</a>
                </div>
              </form>
            </Form>
          )}

          {mode === 'done' && (
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Spinner size={20} />
            </div>
          )}
        </div>
      </Card>
    </main>
  );
}
