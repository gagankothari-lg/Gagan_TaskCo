'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { apiErrorMessage } from '../../../lib/api/client';
import { requestPasswordReset, confirmPasswordReset } from '../../../lib/api/auth';
import { Spinner } from '../../../components/ui/spinner';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../components/ui/form';
import {
  requestOtpSchema,
  confirmResetSchema,
  type RequestOtpFormValues,
  type ConfirmResetFormValues,
} from './forgot-password-page.schema';

const inputClass =
  'w-full bg-[#0D1117] border border-[#30363D] text-[#E6EDF3] rounded-[6px] px-3 py-2 text-sm ' +
  'placeholder:text-[#8B949E] focus:border-[#58A6FF] focus:outline-none transition-colors';

const labelClass = 'block text-sm text-[#E6EDF3] mb-1.5';

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const requestOtpForm = useForm<RequestOtpFormValues>({
    resolver: zodResolver(requestOtpSchema),
    defaultValues: { email: '' },
  });

  const confirmResetForm = useForm<ConfirmResetFormValues>({
    resolver: zodResolver(confirmResetSchema),
    defaultValues: { otp: '', newPassword: '', confirmPassword: '' },
  });

  async function requestOtp(values: RequestOtpFormValues) {
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(values.email);
      // Always succeeds (no email-existence leak) → advance to step 2.
      setEmail(values.email);
      setStep(2);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to send reset code'));
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(values: ConfirmResetFormValues) {
    setError(null);
    setLoading(true);
    try {
      await confirmPasswordReset({ email, otp: values.otp, newPassword: values.newPassword });
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
            <Form {...requestOtpForm}>
              <form onSubmit={requestOtpForm.handleSubmit(requestOtp)} className="space-y-4" noValidate>
                <FormField
                  control={requestOtpForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="email" className={labelClass}>Email</FormLabel>
                      <FormControl>
                        <input
                          id="email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@leveragedgrowth.in"
                          className={inputClass}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#58A6FF] text-white rounded-[6px] px-3 py-2 text-sm font-medium hover:bg-[#79B8FF] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && <Spinner size={16} />}
                  {loading ? 'Sending…' : 'Send reset code'}
                </button>
              </form>
            </Form>
          ) : (
            <Form {...confirmResetForm}>
              <form onSubmit={confirmResetForm.handleSubmit(confirmReset)} className="space-y-4" noValidate>
                <FormField
                  control={confirmResetForm.control}
                  name="otp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="otp" className={labelClass}>6-digit code</FormLabel>
                      <FormControl>
                        <input
                          id="otp"
                          inputMode="numeric"
                          maxLength={6}
                          placeholder="123456"
                          className={`${inputClass} tracking-[0.4em] font-mono`}
                          {...field}
                          onChange={(e) => field.onChange(e.target.value.replace(/\D/g, ''))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={confirmResetForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="newPassword" className={labelClass}>New password</FormLabel>
                      <FormControl>
                        <input
                          id="newPassword"
                          type="password"
                          autoComplete="new-password"
                          placeholder="At least 8 characters"
                          className={inputClass}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={confirmResetForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel htmlFor="confirmPassword" className={labelClass}>Confirm password</FormLabel>
                      <FormControl>
                        <input
                          id="confirmPassword"
                          type="password"
                          autoComplete="new-password"
                          placeholder="Re-enter password"
                          className={inputClass}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 bg-[#58A6FF] text-white rounded-[6px] px-3 py-2 text-sm font-medium hover:bg-[#79B8FF] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {loading && <Spinner size={16} />}
                  {loading ? 'Resetting…' : 'Reset password'}
                </button>
              </form>
            </Form>
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
