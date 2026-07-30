'use client';

import { useEffect } from 'react';
import { API_URL } from '../lib/api/client';

const PING_INTERVAL_MS = 10 * 60 * 1000;

export function KeepAlivePing() {
  useEffect(() => {
    const ping = () => {
      fetch(`${API_URL}/api/health`, { cache: 'no-store' }).catch(() => {});
    };
    ping();
    const id = setInterval(ping, PING_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);
  return null;
}
