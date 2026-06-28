const STYLE: Record<string, string> = {
  Pending: 'bg-[#E3B341]/20 text-[#E3B341]',
  Approved: 'bg-[#3FB950]/20 text-[#3FB950]',
  Rejected: 'bg-[#F85149]/20 text-[#F85149]',
};

export function LeaveStatusBadge({ status }: { status: string }) {
  const cls = STYLE[status] ?? 'bg-[#30363D] text-[#8B949E]';
  return <span className={`inline-flex items-center rounded-[9999px] px-2 py-0.5 text-xs font-medium ${cls}`}>{status}</span>;
}

export default LeaveStatusBadge;
