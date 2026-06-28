'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/use-auth';
import { api, apiErrorMessage } from '../../../lib/api';
import { Icon } from '../../../components/ui/icon';
import { RegistrationModal } from '../../../components/modules/users/registration-modal';
import { rolePillClass, initials, avatarColor } from '../../../lib/utils';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // forgot-password fields
  const [otp, setOtp] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');

  async function onLogin(e?: FormEvent) {
    e?.preventDefault();
    setError(null);
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    setLoading(true);
    try {
      await login(email.trim(), password);
      setStatus('Account verified. Click below to continue.');
      setMode('verified');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to sign in'));
    } finally {
      setLoading(false);
    }
  }

  async function sendResetCode() {
    setError(null);
    if (!email.trim()) { setError('Enter your email.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/request', { email: email.trim() });
      setStatus('If that email exists, a 6-digit code was sent. Enter it below.');
      setMode('forgot2');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to send reset code'));
    } finally {
      setLoading(false);
    }
  }

  async function resetPassword() {
    setError(null);
    if (!otp.trim()) { setError('Enter the reset code.'); return; }
    if (newPw.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm', { email: email.trim(), otp: otp.trim(), newPassword: newPw });
      setMode('login');
      setPassword(''); setOtp(''); setNewPw(''); setConfirmPw('');
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
          <form onSubmit={onLogin}>
            <div className="fg">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                className="fc"
                value={email}
                placeholder="you@company.com"
                autoComplete="email"
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e: KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('login-password')?.focus(); } }}
              />
            </div>
            <div className="fg">
              <label htmlFor="login-password">Password</label>
              <PwField id="login-password" value={password} onChange={setPassword} placeholder="••••••••" onEnter={onLogin} />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading} style={{ marginTop: 4 }}>
              {loading && <span className="btn-spinner" />}
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
            {errBox}
            <div style={{ textAlign: 'right', marginTop: 10 }}>
              <a onClick={() => { setError(null); setStatus('Enter your email to receive a reset code.'); setMode('forgot1'); }} style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}>Forgot password?</a>
            </div>
            <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: 'var(--muted)' }}>
              New here?{' '}
              <a onClick={() => setRegOpen(true)} style={{ color: 'var(--p)', cursor: 'pointer', fontWeight: 600 }}>Register →</a>
            </div>
          </form>
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
          <div>
            <div className="fg">
              <label htmlFor="fp-email">Email</label>
              <input id="fp-email" type="email" className="fc" value={email} placeholder="you@company.com" onChange={(e) => setEmail(e.target.value)} />
            </div>
            <button className="btn btn-primary btn-full" disabled={loading} onClick={sendResetCode}>
              {loading && <span className="btn-spinner" />}{loading ? 'Sending…' : 'Send Reset Code'}
            </button>
            {errBox}
            <div style={{ textAlign: 'center', marginTop: 14 }}>
              <a onClick={() => { setError(null); setStatus(null); setMode('login'); }} style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}>← Back to Sign In</a>
            </div>
          </div>
        )}

        {/* ── Forgot step 2: OTP + new password ─────────── */}
        {mode === 'forgot2' && (
          <div>
            <div className="fg">
              <label htmlFor="fp-otp">Reset Code</label>
              <input id="fp-otp" type="text" maxLength={6} className="fc" value={otp} placeholder="······" onChange={(e) => setOtp(e.target.value)} style={{ letterSpacing: 8, textAlign: 'center', fontSize: 18 }} />
            </div>
            <div className="fg">
              <label htmlFor="fp-newpw">New Password</label>
              <PwField id="fp-newpw" value={newPw} onChange={setNewPw} placeholder="At least 6 characters" />
            </div>
            <div className="fg">
              <label htmlFor="fp-confirmpw">Confirm Password</label>
              <PwField id="fp-confirmpw" value={confirmPw} onChange={setConfirmPw} placeholder="Re-enter password" onEnter={resetPassword} />
            </div>
            <button className="btn btn-primary btn-full" disabled={loading} onClick={resetPassword}>
              {loading && <span className="btn-spinner" />}{loading ? 'Resetting…' : 'Reset Password'}
            </button>
            {errBox}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <a onClick={sendResetCode} style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}>Resend code</a>
              <a onClick={() => { setError(null); setStatus(null); setMode('login'); }} style={{ fontSize: 13, color: 'var(--p)', cursor: 'pointer' }}>← Back to Sign In</a>
            </div>
          </div>
        )}
      </div>

      <RegistrationModal open={regOpen} onClose={() => setRegOpen(false)} />
    </main>
  );
}
