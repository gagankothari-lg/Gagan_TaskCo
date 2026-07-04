'use client';

import { useMemo } from 'react';
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
import type { RegistrationRequest, ProfileUpdateRequest, User } from '../../../lib/types';

// Reference (view-team-mgmt / view-org-page) stacks #team-pending-registrations,
// #team-pending-profile-updates then #team-pending-ddr above the members table.
// These two sections reuse the reference's amber `.reg-card` convention (globals.css)
// — the same card look the reference uses for registration-style approval queues.

const PROFILE_FIELD_LABELS: Record<string, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  designation: 'Designation',
  team: 'Team',
  subDepartment: 'Sub-department',
  dob: 'Date of birth',
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

// ─── Pending registrations ─────────────────────────────────────────
function RegistrationCard({ reg }: { reg: RegistrationRequest }) {
  const { refresh } = useAuth();
  const approve = useApproveRegistration();
  const reject = useRejectRegistration();
  const busy = approve.isPending || reject.isPending;
  const name = `${reg.firstName} ${reg.lastName}`.trim();

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

  async function onReject() {
    try {
      await reject.mutateAsync({ reqId: reg.regId });
      toast('Registration rejected', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to reject'), 'error');
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
      </div>
      <div className="reg-card-actions">
        <button type="button" className="btn btn-accent btn-sm" disabled={busy} onClick={onApprove}>
          <Icon name="check" size={15} /> Approve
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onReject}>
          <Icon name="close" size={15} /> Reject
        </button>
      </div>
    </div>
  );
}

export function PendingRegistrationsSection() {
  const { data, isError } = useRegistrations();
  const pending = useMemo(() => (data ?? []).filter((r) => r.status === 'Pending'), [data]);

  if (isError || pending.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: 'var(--p)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Pending Registration Requests ({pending.length})
      </div>
      {pending.map((r) => (
        <RegistrationCard key={r.regId} reg={r} />
      ))}
    </div>
  );
}

// ─── Pending profile updates ───────────────────────────────────────
function ProfileUpdateCard({ req, employees }: { req: ProfileUpdateRequest; employees: User[] }) {
  const approve = useApproveProfileUpdate();
  const reject = useRejectProfileUpdate();
  const busy = approve.isPending || reject.isPending;
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

  async function onReject() {
    try {
      await reject.mutateAsync({ reqId: req.reqId });
      toast('Profile change rejected', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to reject'), 'error');
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
        <button type="button" className="btn btn-accent btn-sm" disabled={busy} onClick={onApprove}>
          <Icon name="check" size={15} /> Approve
        </button>
        <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={onReject}>
          <Icon name="close" size={15} /> Reject
        </button>
      </div>
    </div>
  );
}

export function PendingProfileUpdatesSection({ employees }: { employees: User[] }) {
  const { data, isError } = useProfileRequests();
  const pending = useMemo(() => (data ?? []).filter((r) => r.status === 'Pending'), [data]);

  if (isError || pending.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: 'var(--p)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Pending Profile Update Requests ({pending.length})
      </div>
      {pending.map((r) => (
        <ProfileUpdateCard key={r.reqId} req={r} employees={employees} />
      ))}
    </div>
  );
}
