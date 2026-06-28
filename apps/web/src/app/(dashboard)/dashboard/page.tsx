'use client';

import { useMemo } from 'react';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../lib/auth';
import { useDashboard } from '../../../hooks/use-dashboard';
import { useWorkDurationStatus, hmsFromMin } from '../../../hooks/use-work-duration';
import { NoticeBoard } from '../../../components/modules/dashboard/notice-board';
import { ScoreboardWidget } from '../../../components/modules/dashboard/scoreboard-widget';
import { UpcomingTasksWidget } from '../../../components/modules/dashboard/upcoming-tasks-widget';
import { OnLeaveWidget } from '../../../components/modules/dashboard/on-leave-widget';
import { AnnouncementForm } from '../../../components/modules/dashboard/announcement-form';
import { TeamClockStatus } from '../../../components/modules/work-duration/team-clock-status';

function Metric({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
      <div className="flex h-10 w-10 items-center justify-center rounded-[8px]" style={{ backgroundColor: `${color}1a` }}>{icon}</div>
      <div>
        <p className="text-2xl font-semibold text-[var(--text)]">{value}</p>
        <p className="text-xs text-[var(--muted)]">{label}</p>
      </div>
    </div>
  );
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[8px] bg-[var(--p3)] ${className}`} />;
}

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { data, isLoading } = useDashboard();
  const { data: clock } = useWorkDurationStatus();

  const myRow = useMemo(() => data?.scoreboard.find((r) => r.empId === currentUser?.empId), [data, currentUser]);
  const manager = currentUser ? isManager(currentUser.role) : false;
  const admin = currentUser ? isAdmin(currentUser.role) : false;

  if (isLoading || !data) {
    return (
      <div className="space-y-4 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-56" />)}</div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric icon={<Icon name="check_circle" size={20} className="text-[var(--ok)]" />} label="Tasks Done" value={myRow?.done ?? 0} color="#2e7d32" />
        <Metric icon={<Icon name="warning" size={20} className="text-[var(--danger)]" />} label="Overdue" value={myRow?.overdue ?? 0} color="#c62828" />
        <Metric icon={<Icon name="schedule" size={20} className="text-[var(--p)]" />} label="Today Worked" value={hmsFromMin(clock?.session?.netMinutes ?? 0)} color="#1a237e" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingTasksWidget buckets={data.upcomingTasks} />
        <NoticeBoard notices={data.notices} />
        <ScoreboardWidget rows={data.scoreboard} />
        {manager ? (
          <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-card">
            <h3 className="mb-3 text-sm font-medium text-[var(--text)]">Team Clock Status</h3>
            <TeamClockStatus />
          </div>
        ) : (
          <OnLeaveWidget onLeave={data.onLeaveToday} />
        )}
      </div>

      {admin && <AnnouncementForm />}
    </div>
  );
}
