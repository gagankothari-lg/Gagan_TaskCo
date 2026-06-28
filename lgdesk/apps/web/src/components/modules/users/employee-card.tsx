'use client';

import { RoleBadge } from '../../ui/role-badge';
import type { User } from '../../../lib/types';

interface EmployeeCardProps {
  employee: Pick<User, 'firstName' | 'lastName' | 'role' | 'team' | 'designation' | 'email'>;
  variant?: 'full' | 'compact';
  selected?: boolean;
  onClick?: () => void;
}

function initialsOf(first?: string, last?: string) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || 'U';
}

function Avatar({ first, last, size = 36 }: { first?: string; last?: string; size?: number }) {
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-[#58A6FF] text-white font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initialsOf(first, last)}
    </div>
  );
}

export function EmployeeCard({ employee, variant = 'full', selected, onClick }: EmployeeCardProps) {
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  const clickable = typeof onClick === 'function';

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={onClick}
        className={[
          'flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-2 text-left transition-colors',
          selected
            ? 'bg-[rgba(88,166,255,0.10)] border border-[#58A6FF]'
            : 'border border-[#30363D] hover:bg-[#21262D]',
        ].join(' ')}
      >
        <Avatar first={employee.firstName} last={employee.lastName} size={28} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-[#E6EDF3]">{name}</p>
          {employee.team && <p className="truncate text-xs text-[#8B949E]">{employee.team}</p>}
        </div>
      </button>
    );
  }

  return (
    <div
      onClick={onClick}
      className={[
        'rounded-[6px] border border-[#30363D] bg-[#21262D] p-4 transition-colors',
        clickable ? 'cursor-pointer hover:border-[#58A6FF]' : '',
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <Avatar first={employee.firstName} last={employee.lastName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#E6EDF3]">{name}</p>
          {employee.designation && (
            <p className="truncate text-xs text-[#8B949E]">{employee.designation}</p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RoleBadge role={employee.role} />
            {employee.team && (
              <span className="inline-flex items-center rounded-[9999px] border border-[#30363D] bg-[#0D1117] px-2 py-0.5 text-xs text-[#8B949E]">
                {employee.team}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default EmployeeCard;
