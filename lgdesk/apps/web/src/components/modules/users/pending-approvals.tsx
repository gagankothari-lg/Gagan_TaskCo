'use client';

import { useMemo, useState } from 'react';
import {
  useProfileRequests,
  useApproveProfileUpdate,
  useRejectProfileUpdate,
} from '../../../lib/api/teamMembers';
import { apiErrorMessage } from '../../../lib/api/client';
import { fmtDate } from '../../../lib/utils';
import { toast } from '../../../lib/toast';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import type { ProfileUpdateRequest, User } from '../../../lib/types';

// Reference (view-team-mgmt / view-org-page) stacks #team-pending-profile-updates then
// #team-pending-ddr above the members table. This section reuses the reference's amber
// `.reg-card` convention (globals.css) — the same card look the reference uses for
// registration-style approval queues.
//
// P19: the sibling PendingRegistrationsSection that used to live in this file was removed
// -- registration (submission + approval) moved to Portal, LGDesk's own registration
// surface retired. This file now only covers profile-update requests.

const PROFILE_FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  designation: 'Designation',
  team: 'Team',
  subDepartment: 'Sub-department',
  dob: 'Date of birth',
  // Round5 add'l-2
  newManagerEmail: 'New manager (email)',
};

function describeProfileChanges(raw: string): { label: string; value: string }[] {
  try {
    const obj = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(obj).map(([key, value]) => ({
      label: PROFILE_FIELD_LABELS[key] ?? key,
      value: String(value),
    }));
  } catch {
    return [];
  }
}

// Shared by both sections below — ported from the standalone pages' reject modal
// (Round5 add'l-1 merge) so optional-reason collection isn't lost when those pages go.
function RejectReasonModal({
  title,
  notes,
  setNotes,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string;
  notes: string;
  setNotes: (v: string) => void;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="w-full max-w-[400px] rounded-[10px] border border-[var(--border)] bg-[var(--surface)] p-5">
        <h3 className="mb-1 text-sm font-semibold text-[var(--text)]">{title}</h3>
        <p className="mb-3 text-xs text-[var(--muted)]">Optionally add a reason for the rejection.</p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Reason (optional)"
          className="w-full resize-none rounded-[6px] border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--p2)] focus:outline-none"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-[6px] border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text)] hover:bg-[var(--hover)]"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-[6px] bg-[var(--danger)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Spinner size={14} />}
            Reject
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pending profile updates ───────────────────────────────────────
function ProfileUpdateCard({
  req,
  employees,
  onRejectClick,
}: {
  req: ProfileUpdateRequest;
  employees: User[];
  onRejectClick: (req: ProfileUpdateRequest, name: string) => void;
}) {
  const approve = useApproveProfileUpdate();
  const emp = employees.find((e) => e.empId === req.empId);
  const name = emp ? `${emp.firstName} ${emp.lastName}`.trim() : req.empId;
  const changes = describeProfileChanges(req.changes);

  async function onApprove() {
    if (!confirm(`Approve this profile change for ${name}?`)) return;
    try {
      await approve.mutateAsync(req.reqId);
      toast('Profile change approved', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to approve'), 'error');
    }
  }

  return (
    <div className="reg-card">
      <div className="reg-card-hd">
        <div>
          <div className="reg-card-name">{name}</div>
          <div className="reg-card-email">{req.empId}</div>
        </div>
      </div>
      <div className="reg-card-meta">
        {changes.length === 0 ? '—' : changes.map((c) => `${c.label}: ${c.value}`).join(' · ')}
      </div>
      <div className="reg-card-msg">Requested {fmtDate(req.createdAt)}</div>
      <div className="reg-card-actions">
        <button type="button" className="btn btn-accent btn-sm" disabled={approve.isPending} onClick={onApprove}>
          <Icon name="check" size={15} /> Approve
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => onRejectClick(req, name)}>
          <Icon name="close" size={15} /> Reject
        </button>
      </div>
    </div>
  );
}

export function PendingProfileUpdatesSection({ employees }: { employees: User[] }) {
  const { data, isError } = useProfileRequests();
  const reject = useRejectProfileUpdate();
  const pending = useMemo(() => (data ?? []).filter((r) => r.status === 'Pending'), [data]);
  const [rejecting, setRejecting] = useState<{ reqId: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');

  async function onConfirmReject() {
    if (!rejecting) return;
    try {
      await reject.mutateAsync({ reqId: rejecting.reqId, notes: notes || undefined });
      setRejecting(null);
      setNotes('');
      toast('Profile change rejected', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to reject'), 'error');
    }
  }

  if (isError || pending.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: 'var(--p)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Pending Profile Update Requests ({pending.length})
      </div>
      {pending.map((r) => (
        <ProfileUpdateCard
          key={r.reqId}
          req={r}
          employees={employees}
          onRejectClick={(req, name) => { setNotes(''); setRejecting({ reqId: req.reqId, name }); }}
        />
      ))}
      {rejecting && (
        <RejectReasonModal
          title={`Reject change for ${rejecting.name}?`}
          notes={notes}
          setNotes={setNotes}
          busy={reject.isPending}
          onCancel={() => { setRejecting(null); setNotes(''); }}
          onConfirm={onConfirmReject}
        />
      )}
    </div>
  );
}
