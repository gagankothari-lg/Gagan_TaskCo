'use client';

import { useMemo } from 'react';
import { useAuth } from '../../../hooks/use-auth';
import { useDdrs, useApproveDdr, useRejectDdr } from '../../../hooks/use-tasks';
import { isManager } from '../../../lib/auth';
import { apiErrorMessage } from '../../../lib/api';
import { avatarColor, initials, fmtDate, rolePillClass } from '../../../lib/utils';
import { toast } from '../../../lib/toast';
import { Icon } from '../../ui/icon';
import type { User, DueDateRequest } from '../../../lib/types';

interface MembersViewProps {
  title: string;
  subtitle: string;
  /** 'team' filters members to the current user's team; 'all' shows every active employee. */
  scope: 'team' | 'all';
}

/** Map an empId to a readable display name from the employee roster. */
function nameFor(empId: string, employees: User[]): string {
  const u = employees.find((e) => e.empId === empId);
  return u ? `${u.firstName} ${u.lastName}`.trim() : empId;
}

function Avatar({ id, name, size = 28 }: { id: string; name: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: avatarColor(id),
        color: '#fff',
        fontWeight: 700,
        fontSize: size * 0.4,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </div>
  );
}

// ─── DDR review section ───────────────────────────────────────────
function DdrCard({ ddr, employees, entityName }: { ddr: DueDateRequest; employees: User[]; entityName: string }) {
  const approve = useApproveDdr();
  const reject = useRejectDdr();
  const busy = approve.isPending || reject.isPending;

  async function onApprove() {
    try {
      await approve.mutateAsync(ddr.ddrId);
      toast('Due date change approved', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to approve'), 'error');
    }
  }

  async function onReject() {
    try {
      await reject.mutateAsync({ ddrId: ddr.ddrId });
      toast('Due date change rejected', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Unable to reject'), 'error');
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 14, background: 'var(--surface)' }}>
      <div style={{ color: 'var(--p)', fontSize: 14, fontWeight: 700 }}>{entityName}</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
        {ddr.entityType}: {ddr.entityId} | New due {fmtDate(ddr.newDueDate)} | By {nameFor(ddr.requestedBy, employees)} | {fmtDate(ddr.createdAt)}
      </div>
      {ddr.reason && (
        <div style={{ fontSize: 12, fontStyle: 'italic', color: 'var(--muted)', marginTop: 6 }}>&ldquo;{ddr.reason}&rdquo;</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
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

function DdrSection({ employees }: { employees: User[] }) {
  const { tasks, projects, functions } = useAuth();
  const { data: ddrs, isError } = useDdrs('Pending');
  const pending = useMemo(() => (ddrs ?? []).filter((d) => d.status === 'Pending'), [ddrs]);

  // Resolve a friendly entity name from the cached payload; fall back to the ID.
  // The /ddr list endpoint returns only entityId (no joined name).
  const entityName = (ddr: DueDateRequest): string => {
    if (ddr.entityType === 'Task') return tasks.find((t) => t.taskId === ddr.entityId)?.title ?? ddr.entityId;
    if (ddr.entityType === 'Project') return projects.find((p) => p.projId === ddr.entityId)?.name ?? ddr.entityId;
    return functions.find((f) => f.functionId === ddr.entityId)?.name ?? ddr.entityId;
  };

  // Render nothing if the list failed to load or there are no pending requests.
  if (isError || pending.length === 0) return null;

  return (
    <div style={{ border: '2px solid var(--p)', borderRadius: 8, padding: 16, background: 'var(--surface)', marginBottom: 20 }}>
      <div style={{ color: 'var(--p)', fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
        Pending Due Date Change Requests ({pending.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pending.map((d) => (
          <DdrCard key={d.ddrId} ddr={d} employees={employees} entityName={entityName(d)} />
        ))}
      </div>
    </div>
  );
}

// ─── Member table ─────────────────────────────────────────────────
export function MembersView({ title, subtitle, scope }: MembersViewProps) {
  const { currentUser, employees, tasks } = useAuth();

  const canChangeRole = currentUser ? isManager(currentUser.role) : false;

  // Open-task counts per assignee (excludes Done/Cancelled).
  const openTaskCount = useMemo(() => {
    const counts = new Map<string, number>();
    const open = tasks.filter((t) => t.status !== 'Done' && t.status !== 'Cancelled');
    open.forEach((t) => {
      t.assigneeIds.forEach((id) => counts.set(id, (counts.get(id) ?? 0) + 1));
    });
    return counts;
  }, [tasks]);

  const members = useMemo(() => {
    const active = employees.filter((e) => e.isActive);
    const scoped =
      scope === 'team' && currentUser?.team
        ? active.filter((e) => e.team === currentUser.team)
        : active;
    return [...scoped].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  }, [employees, scope, currentUser]);

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">{title}</div>
          <div className="ph-sub">{subtitle}</div>
        </div>
      </div>

      <DdrSection employees={employees} />

      {members.length === 0 ? (
        <div className="empty-state">
          <Icon name="groups" size={40} className="ei" />
          <p>No members to show</p>
        </div>
      ) : (
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>EMPLOYEE</th>
                <th>ROLE</th>
                <th>TEAM</th>
                <th>REPORTS TO</th>
                <th>OPEN TASKS</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const name = `${m.firstName} ${m.lastName}`.trim();
                const open = openTaskCount.get(m.empId) ?? 0;
                return (
                  <tr key={m.empId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar id={m.empId} name={name} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{name}</div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={rolePillClass(m.role)}>{m.role}</span>
                    </td>
                    <td>
                      <div style={{ fontSize: 13, color: 'var(--text)' }}>{m.team ?? '—'}</div>
                      {m.subDepartment && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{m.subDepartment}</div>}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text)' }}>
                      {m.managerId ? nameFor(m.managerId, employees) : '—'}
                    </td>
                    <td>
                      <span style={{ fontWeight: open > 0 ? 700 : 400, color: open > 0 ? 'var(--p)' : 'var(--muted)' }}>{open}</span>
                    </td>
                    <td>
                      {canChangeRole ? (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => toast('Role change coming soon', 'info')}
                        >
                          Change Role
                        </button>
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MembersView;
