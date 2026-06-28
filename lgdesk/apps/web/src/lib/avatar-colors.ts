// Deterministic avatar colours — same person always gets the same colour.
// Exact palette + hash from the GAS app (PMASTER-UI §16 avatar generator).
export const AVATAR_COLORS = [
  '#1a237e', '#283593', '#0277bd', '#01579b', '#00695c', '#2e7d32',
  '#558b2f', '#e65100', '#bf360c', '#6a1b9a', '#4527a0', '#880e4f',
  '#c62828', '#455a64', '#37474f',
];

export const avatarColor = (id: string): string =>
  AVATAR_COLORS[id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
