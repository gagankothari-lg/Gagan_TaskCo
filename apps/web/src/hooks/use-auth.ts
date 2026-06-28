'use client';

import { useContext } from 'react';
import { AuthContext } from '../contexts/auth-context';

/** Typed accessor for AuthContext. Throws if used outside <AuthProvider>. */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
