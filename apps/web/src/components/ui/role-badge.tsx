// Compact colored badge for a user's role. Dark Command palette.
const ROLE_STYLES: Record<string, string> = {
  'Super Admin': 'bg-[rgba(88,166,255,0.15)] text-[#58A6FF] border-[rgba(88,166,255,0.30)]',
  Admin: 'bg-[rgba(121,184,255,0.15)] text-[#79B8FF] border-[rgba(121,184,255,0.30)]',
  'Team Captain': 'bg-[rgba(63,185,80,0.15)] text-[#3FB950] border-[rgba(63,185,80,0.30)]',
  'Team Facilitator': 'bg-[rgba(45,212,191,0.15)] text-[#2DD4BF] border-[rgba(45,212,191,0.30)]',
  'Team Member': 'bg-[rgba(139,148,158,0.15)] text-[#8B949E] border-[rgba(139,148,158,0.30)]',
  Intern: 'bg-[rgba(227,179,65,0.15)] text-[#E3B341] border-[rgba(227,179,65,0.30)]',
};

export function RoleBadge({ role, className = '' }: { role: string; className?: string }) {
  const style = ROLE_STYLES[role] ?? ROLE_STYLES['Team Member'];
  return (
    <span
      className={`inline-flex items-center rounded-[9999px] border px-2 py-0.5 text-xs font-medium ${style} ${className}`}
    >
      {role}
    </span>
  );
}

export default RoleBadge;
