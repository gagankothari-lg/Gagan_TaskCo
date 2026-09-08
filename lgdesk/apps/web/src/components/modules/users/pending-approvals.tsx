'use client';

import { useMemo, useState } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import {
  useRegistrations,
  useProfileRequests,
  useApproveRegistration,
  useRejectRegistration,
  useApproveProfileUpdate,
  useRejectProfileUpdate,
} from '../../../lib/api/teamMembers';
import { apiErrorMessage } from '../../../lib/api/client';
import { fmtDate, rolePillClass } from '../../../lib/utils';
import { toast } from '../../../lib/toast';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import type { RegistrationRequest, ProfileUpdateRequest, User } from '../../../lib/types';

// Reference (view-team-mgmt / view-org-page) stacks #team-pending-registrations,
// #team-pending-profile-updates then #team-pending-ddr above the members table.
// These two sections reuse the reference's amber `.reg-card` convention (globals.css)
// — the same card look the reference uses for registration-style approval queues.
//
// Round5 add'l-1: this is now the ONLY surface for these two queues — the standalone
// /registrations and /profile-requests pages (and their nav items) were removed, since
// the reference has no equivalent for them at all (Part 10's full nav table has no such
// entries — they're embedded queues only). Before removing those pages, both renderers
// were compared and merged here rather than picking one wholesale:
//   - Reject-reason collection existed only on the standalone pages (an optional
//     textarea before confirming) — added here via RejectReasonModal, shared by both
//     sections, so it's not lost.
//   - The standalone Registrations page showed "Resolved manager: {r.managerId}" — a
//     raw EMP-ID, not a resolved name (F49). The embedded version showed no manager
//     info at all. Neither was actually correct; this resolves the name properly via
//     `nameFor`, the same helper members-view.tsx already uses for DDR/manager display.
//   - Profile-update name resolution was already correct and identical on both sides
//     (employees.find by empId) — no change needed there.

function nameFor(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}`.trim() : empId;
}

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

// ─── Pending registrations ─────────────────────────────────────────
function RegistrationCard({
  reg,
  employees,
  onRejectClick,
}: {
  reg: RegistrationRequest;
  employees: User[];
  onRejectClick: (reg: RegistrationRequest) => void;
}) {
  const { refresh } = useAuth();
  const approve = useApproveRegistration();
  const name = `${reg.firstName} ${reg.lastName}`.trim();
  const managerName = reg.managerId ? nameFor(reg.managerId, employees) : null;

  async function onApprove() {
    if (!confirm(`Approve ${name}'s registration and create their employee account?`)) return;
    try {
      const { empId } = await approve.mutateAsync(reg.regId);
      // MembersView sources its roster from AuthContext.payload (one-shot boot state,
      // outside TanStack Query) — refresh() re-fetches it so the new employee shows up
      // in the table below without a manual page reload.
      await refresh();
      toast(`Approved — Employee ID ${empId}`, 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to approve'), 'error');
    }
  }

  return (
    <div className="reg-card">
      <div className="reg-card-hd">
        <div>
          <div className="reg-card-name">{name}</div>
          <div className="reg-card-email">{reg.email}</div>
        </div>
        <span className={rolePillClass(reg.role)}>{reg.role}</span>
      </div>
      <div className="reg-card-meta">
        {reg.team ?? '—'}
        {reg.designation ? ` · ${reg.designation}` : ''} · Requested {fmtDate(reg.createdAt)}
        {managerName ? ` · Manager: ${managerName}` : ''}
      </div>
      <div className="reg-card-actions">
        <button type="button" className="btn btn-accent btn-sm" disabled={approve.isPending} onClick={onApprove}>
          <Icon name="check" size={15} /> Approve
        </button>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => onRejectClick(reg)}>
          <Icon name="close" size={15} /> Reject
        </button>
      </div>
    </div>
  );
}

export function PendingRegistrationsSection({ employees }: { employees: User[] }) {
  const { data, isError } = useRegistrations();
  const reject = useRejectRegistration();
  const pending = useMemo(() => (data ?? []).filter((r) => r.status === 'Pending'), [data]);
  const [rejecting, setRejecting] = useState<{ regId: string; name: string } | null>(null);
  const [notes, setNotes] = useState('');

  async function onConfirmReject() {
    if (!rejecting) return;
    try {
      await reject.mutateAsync({ reqId: rejecting.regId, notes: notes || undefined });
      setRejecting(null);
      setNotes('');
      toast('Registration rejected', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to reject'), 'error');
    }
  }

  if (isError || pending.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: 'var(--p)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Pending Registration Requests ({pending.length})
      </div>
      {pending.map((r) => (
        <RegistrationCard
          key={r.regId}
          reg={r}
          employees={employees}
          onRejectClick={(reg) => {
            setNotes('');
            setRejecting({ regId: reg.regId, name: `${reg.firstName} ${reg.lastName}`.trim() });
          }}
        />
      ))}
      {rejecting && (
        <RejectReasonModal
          title={`Reject ${rejecting.name}?`}
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
