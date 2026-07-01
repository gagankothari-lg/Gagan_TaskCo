'use client';

import { useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuth } from '../../../hooks/use-auth';
import { apiErrorMessage } from '../../../lib/api/client';
import { requestPasswordReset, confirmPasswordReset } from '../../../lib/api/auth';
import { Icon } from '../../../components/ui/icon';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../components/ui/form';
import { RegistrationModal } from '../../../components/modules/users/registration-modal';
import { rolePillClass, initials, avatarColor } from '../../../lib/utils';
import {
  loginSchema,
  forgotPasswordRequestSchema,
  forgotPasswordResetSchema,
  type LoginFormValues,
  type ForgotPasswordRequestFormValues,
  type ForgotPasswordResetFormValues,
} from './login-page.schema';

type Mode = 'login' | 'verified' | 'forgot1' | 'forgot2';

const GRADIENT = 'linear-gradient(135deg,#1a237e 0%,#283593 50%,#1565c0 100%)';

function PwField({
  id, value, onChange, placeholder, onEnter,
}: { id: string; value: string; onChange: (v: string) => void; placeholder: string; onEnter?: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <input
        id={id}
        type={show ? 'text' : 'password'}
        className="fc"
        value={value}
        placeholder={placeholder}
        autoComplete="current-password"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter' && onEnter) { e.preventDefault(); onEnter(); } }}
        style={{ paddingRight: 38 }}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}
      >
        <Icon name={show ? 'visibility_off' : 'visibility'} size={18} />
      </button>
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { login, user } = useAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [regOpen, setRegOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Carries the email across forgot1 -> forgot2 (forgot2 has no email field of its own —
  // same single-source-of-truth role the shared `email` useState played pre-migration).
  const [resetEmail, setResetEmail] = useState('');

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const forgot1Form = useForm<ForgotPasswordRequestFormValues>({
    resolver: zodResolver(forgotPasswordRequestSchema),
    defaultValues: { email: '' },
  });

  const forgot2Form = useForm<ForgotPasswordResetFormValues>({
    resolver: zodResolver(forgotPasswordResetSchema),
    defaultValues: { otp: '', newPw: '', confirmPw: '' },
  });

  async function onLogin(values: LoginFormValues) {
    setError(null);
    setLoading(true);
    try {
      await login(values.email, values.password);
      setStatus('Account verified. Click below to continue.');
      setMode('verified');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  }

  async function sendResetCode(emailValue: string) {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(emailValue);
      setResetEmail(emailValue);
      setStatus('If that email exists, a 6-digit code was sent. Enter it below.');
      setMode('forgot2');
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
      setMode('login');
      loginForm.setValue('email', resetEmail);
      loginForm.setValue('password', '');
      forgot2Form.reset();
      setError(null);
      setStatus('Password reset! Please sign in.');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to reset password'));
    } finally {
      setLoading(false);
    }
  }

  const errBox = error && (
    <div style={{ background: '#fce8e8', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginTop: 4 }}>{error}</div>
  );
  const statusLine = status && !error && (
    <div style={{ color: 'var(--muted)', fontSize: 13, textAlign: 'center', marginBottom: 4 }}>{status}</div>
  );

  return (
    <main style={{ position: 'fixed', inset: 0, background: GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'var(--surface)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', width: '100%', maxWidth: 400, padding: 32 }}>
        {/* Logo */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: 'var(--p)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
            <Icon name="task_alt" size={28} />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>LG Desk</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)' }}>
            {mode === 'forgot1' || mode === 'forgot2' ? 'Reset your password' : 'Sign in to your workspace'}
          </p>
        </div>

        {statusLine}

        {/* ── Step 1: Sign in ───────────────────────────── */}
        {mode === 'login' && (
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLogin)}>
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel htmlFor="login-email">Email</FormLabel>
                    <FormControl>
                      <input
                        id="login-email"
                        type="email"
                        className="fc"
                        placeholder="you@company.com"
                        autoComplete="email"
                        {...field}
                        onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('login-password')?.focus(); } }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel htmlFor="login-password">Password</FormLabel>
                    <FormControl>
                      <PwField
                        id="login-password"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="••••••••"
                        onEnter={() => loginForm.handleSubmit(onLogin)()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
                {loading && <span className="btn-spinner" />}
                {loading ? 'Signing in…' : 'Sign In →'}
              </button>
              {errBox}
              <div style={{ textAlign: 'right', marginTop: 10 }}>
                <a
                  onClick={() => {
                    setError(null);
                    setStatus('Enter your email to receive a reset code.');
                    forgot1Form.setValue('email', loginForm.getValues('email'));
                    setMode('forgot1');
                  }}
                  style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}
                >Forgot password?</a>
              </div>
              <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
                New here?{' '}
                <a onClick={() => setRegOpen(true)} style={{ color: 'var(--p)', cursor: 'pointer', fontWeight: 600 }}>Register →</a>
              </div>
            </form>
          </Form>
        )}

        {/* ── Step 2: Verified account card ─────────────── */}
        {mode === 'verified' && user && (
          <div>
            <div style={{ background: 'var(--p3)', borderRadius: 10, padding: 16, display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div style={{ width: 38, height: 38, borderRadius: '50%', background: avatarColor(user.empId), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
                {initials(user.name)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--p)' }}>{user.email}</div>
                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={rolePillClass(user.role)}>{user.role}</span>
                  {user.team && <span style={{ fontSize: 12, color: 'var(--muted)' }}>{user.team}</span>}
                </div>
              </div>
            </div>
            <button className="btn btn-primary btn-full" onClick={() => router.push('/dashboard')}>Enter Dashboard →</button>
          </div>
        )}

        {/* ── Forgot step 1: email ──────────────────────── */}
        {mode === 'forgot1' && (
          <Form {...forgot1Form}>
            <form onSubmit={forgot1Form.handleSubmit((values) => sendResetCode(values.email))}>
              <FormField
                control={forgot1Form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel htmlFor="fp-email">Email</FormLabel>
                    <FormControl>
                      <input id="fp-email" type="email" className="fc" placeholder="you@company.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading && <span className="btn-spinner" />}{loading ? 'Sending…' : 'Send Reset Code'}
              </button>
              {errBox}
              <div style={{ textAlign: 'center', marginTop: 14 }}>
                <a onClick={() => { setError(null); setStatus(null); setMode('login'); }} style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}>← Back to Sign In</a>
              </div>
            </form>
          </Form>
        )}

        {/* ── Forgot step 2: OTP + new password ─────────── */}
        {mode === 'forgot2' && (
          <Form {...forgot2Form}>
            <form onSubmit={forgot2Form.handleSubmit(resetPassword)}>
              <FormField
                control={forgot2Form.control}
                name="otp"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel htmlFor="fp-otp">Reset Code</FormLabel>
                    <FormControl>
                      <input id="fp-otp" type="text" maxLength={6} className="fc" placeholder="······" {...field} style={{ letterSpacing: 8, textAlign: 'center', fontSize: 18 }} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={forgot2Form.control}
                name="newPw"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel htmlFor="fp-newpw">New Password</FormLabel>
                    <FormControl>
                      <PwField id="fp-newpw" value={field.value} onChange={field.onChange} placeholder="At least 6 characters" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={forgot2Form.control}
                name="confirmPw"
                render={({ field }) => (
                  <FormItem className="fg">
                    <FormLabel htmlFor="fp-confirmpw">Confirm Password</FormLabel>
                    <FormControl>
                      <PwField
                        id="fp-confirmpw"
                        value={field.value}
                        onChange={field.onChange}
                        placeholder="Re-enter password"
                        onEnter={() => forgot2Form.handleSubmit(resetPassword)()}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading && <span className="btn-spinner" />}{loading ? 'Resetting…' : 'Reset Password'}
              </button>
              {errBox}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
                <a onClick={() => sendResetCode(resetEmail)} style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}>Resend code</a>
                <a onClick={() => { setError(null); setStatus(null); setMode('login'); }} style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}>← Back to Sign In</a>
              </div>
            </form>
          </Form>
        )}
      </div>

      <RegistrationModal open={regOpen} onClose={() => setRegOpen(false)} />
    </main>
  );
}
