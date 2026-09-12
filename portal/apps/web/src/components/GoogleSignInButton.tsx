'use client';

import { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (resp: { credential: string }) => void }) => void;
          renderButton: (el: HTMLElement, options: { theme?: string; size?: string; width?: number }) => void;
        };
      };
    };
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID;

// Google Identity Services (GIS) -- loaded from Google's own CDN, not an npm package.
// Renders nothing (silently) if NEXT_PUBLIC_GOOGLE_OAUTH_CLIENT_ID isn't set yet (Phase 6's
// own note: build this fully, don't stub a fake client ID in -- it just won't work until a
// real one exists).
export function GoogleSignInButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return;
    if (window.google) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => setScriptLoaded(true);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, []);

  useEffect(() => {
    if (!CLIENT_ID || !scriptLoaded || !containerRef.current || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (resp) => onCredential(resp.credential),
    });
    window.google.accounts.id.renderButton(containerRef.current, { theme: 'outline', size: 'large', width: 280 });
  }, [scriptLoaded, onCredential]);

  if (!CLIENT_ID) return null;
  return <div ref={containerRef} />;
}
