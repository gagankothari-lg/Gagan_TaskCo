'use client';

import { useState, type KeyboardEvent } from 'react';
import type { ControllerRenderProps } from 'react-hook-form';
import { Icon } from './icon';
import { Input } from './input';

interface PasswordInputProps {
  id?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  field: ControllerRenderProps<any, any>;
  placeholder?: string;
  autoComplete?: string;
  onEnter?: () => void;
}

/** Password input with a show/hide toggle, built on the shared shadcn `Input`. */
export function PasswordInput({ id, field, placeholder, autoComplete, onEnter }: PasswordInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="pr-9"
        {...field}
        onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
          if (e.key === 'Enter' && onEnter) {
            e.preventDefault();
            onEnter();
          }
        }}
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
