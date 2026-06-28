'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, apiErrorMessage } from '../../../lib/api';
import { Spinner } from '../../../components/ui/spinner';

const inputClass =
  'w-full bg-[#0D1117] border border-[#30363D] text-[#E6EDF3] rounded-[6px] px-3 py-2 text-sm ' +
  'placeholder:text-[#8B949E] focus:border-[#58A6FF] focus:outline-none transition-colors';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.post('/auth/password-reset/request', { email });
      // Always succeeds (no email-existence leak) → advance to step 2.
      setStep(2);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to send reset code'));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/password-reset/confirm', { email, otp, newPassword });
      router.push('/login?reset=success');
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to reset password'));
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0D1117] flex items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 rounded-[10px] bg-[#58A6FF] flex items-center justify-center mb-3">
            <span className="text-white font-bold text-lg tracking-tight">LG</span>
          </div>
          <h1 className="text-[#E6EDF3] text-lg font-semibold">Reset password</h1>
          <p className="text-[#8B949E] text-sm">
            {step === 1 ? 'Enter your email to get a reset code' : 'Enter the code sent to your email'}
          </p>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-[10px] p-6">
          {step === 1 ? (
            <form onSubmit={requestOtp} className="space-y-4" noValidate>
              <div>
                <label htmlFor="email" className="block text-sm text-[#E6EDF3] mb-1.5">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@leveragedgrowth.in"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#58A6FF] text-white rounded-[6px] px-3 py-2 text-sm font-medium hover:bg-[#79B8FF] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Spinner size={16} />}
                {loading ? 'Sending…' : 'Send reset code'}
              </button>
            </form>
          ) : (
            <form onSubmit={confirmReset} className="space-y-4" noValidate>
              <div>
                <label htmlFor="otp" className="block text-sm text-[#E6EDF3] mb-1.5">
                  6-digit code
                </label>
                <input
                  id="otp"
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className={`${inputClass} tracking-[0.4em] font-mono`}
                />
              </div>
              <div>
                <label htmlFor="newPassword" className="block text-sm text-[#E6EDF3] mb-1.5">
                  New password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="block text-sm text-[#E6EDF3] mb-1.5">
                  Confirm password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className={inputClass}
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-[#58A6FF] text-white rounded-[6px] px-3 py-2 text-sm font-medium hover:bg-[#79B8FF] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {loading && <Spinner size={16} />}
                {loading ? 'Resetting…' : 'Reset password'}
              </button>
            </form>
          )}

          {error && (
            <div className="mt-4 rounded-[6px] border border-[#F85149]/40 bg-[#F85149]/10 px-3 py-2 text-sm text-[#F85149]">
              {error}
            </div>
          )}

          <div className="mt-4 text-center">
            <Link href="/login" className="text-sm text-[#58A6FF] hover:underline">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
