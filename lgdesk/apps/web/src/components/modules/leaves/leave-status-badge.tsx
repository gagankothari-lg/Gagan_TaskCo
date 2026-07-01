import { Badge } from '../../ui/badge';

// Master Reference Part 23 BR-2: Pending | Approved | Rejected (Cancelled added for the
// own-leave "Cancel" action). Badge variants line up with the existing .pill-Pending/
// .pill-Approved/.pill-Rejected colours in globals.css.
const VARIANT: Record<string, 'warning' | 'success' | 'destructive' | 'outline'> = {
  Pending: 'warning',
  Approved: 'success',
  Rejected: 'destructive',
  Cancelled: 'outline',
};

export function LeaveStatusBadge({ status }: { status: string }) {
  return <Badge variant={VARIANT[status] ?? 'outline'}>{status}</Badge>;
}

export default LeaveStatusBadge;
