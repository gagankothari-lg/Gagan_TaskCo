// Imperative toast — mirrors GAS toast(msg, type): appends a .toast to #toasts
// and auto-removes after 3500ms. Type maps to .success / .error / .warn.

type ToastType = 'success' | 'error' | 'warn' | 'info';

const TYPE_CLASS: Record<ToastType, string> = {
  success: 'success',
  error: 'error',
  warn: 'warn',
  info: '', // dark default
};

export function toast(message: string, type: ToastType = 'info'): void {
  if (typeof document === 'undefined') return;
  const host = document.getElementById('toasts');
  if (!host) return;
  const el = document.createElement('div');
  el.className = `toast ${TYPE_CLASS[type] ?? ''}`.trim();
  el.textContent = message;
  host.appendChild(el);
  window.setTimeout(() => {
    el.style.transition = 'opacity 0.2s';
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 200);
  }, 3500);
}
