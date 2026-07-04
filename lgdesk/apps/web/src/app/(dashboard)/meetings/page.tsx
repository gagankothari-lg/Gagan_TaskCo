'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { Icon } from '../../../components/ui/icon';
import { useAuth } from '../../../hooks/use-auth';
import { isAdmin, isManager } from '../../../lib/auth';
import { useUpcomingMeetings, useCancelMeeting } from '../../../lib/api/meetings';
import { apiErrorMessage } from '../../../lib/api/client';
import { toast } from '../../../lib/toast';
import { MeetingCard } from '../../../components/modules/meetings/meeting-card';
import { ScheduleMeetingModal } from '../../../components/modules/meetings/schedule-meeting-modal';
import { Spinner } from '../../../components/ui/spinner';

const cardStyle: React.CSSProperties = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  padding: '20px 20px 16px',
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
};

const sectionLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  margin: '28px 0 12px',
};

const upcomingHeaderStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
  margin: '24px 0 12px',
};

const cardTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--p)' };
const cardSubStyle: React.CSSProperties = { fontSize: 12, color: 'var(--muted)' };

export default function MeetingsPage() {
  return (
    <Suspense fallback={<div className="empty-state"><Spinner size={20} /><p>Loading…</p></div>}>
      <MeetingsPageInner />
    </Suspense>
  );
}

function MeetingsPageInner() {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const { data: upcoming, isLoading } = useUpcomingMeetings();
  const cancel = useCancelMeeting();
  const highlightRef = useRef<HTMLDivElement>(null);

  const [joinCode, setJoinCode] = useState('');
  const [modalType, setModalType] = useState<string | null>(null);

  const admin = !!currentUser && isAdmin(currentUser.role);
  const manager = !!currentUser && isManager(currentUser.role);

  useEffect(() => {
    if (highlightId && highlightRef.current) {
      highlightRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, upcoming]);

  const refresh = () => qc.invalidateQueries({ queryKey: ['meetings'] });

  const join = () => {
    const v = joinCode.trim();
    if (!v) { toast('Enter a meeting code or link', 'error'); return; }
    const url = v.startsWith('http') ? v : `https://meet.google.com/${v}`;
    window.open(url, '_blank');
  };

  const canCancel = (organizerId: string) =>
    !!currentUser && (organizerId === currentUser.empId || admin || manager);

  async function onCancel(meetingId: string) {
    if (!confirm('Cancel this meeting?')) return;
    try {
      await cancel.mutateAsync(meetingId);
      toast('Meeting cancelled', 'success');
    } catch (err) {
      toast(apiErrorMessage(err, 'Not authorized to cancel this meeting.'), 'error');
    }
  }

  return (
    <div>
      <div className="ph">
        <div className="ph-left">
          <div className="ph-title">Meetings</div>
          <div className="ph-sub">Start, join or schedule Google Meet calls</div>
        </div>
        <div className="ph-actions">
          <button className="btn btn-ghost btn-sm" onClick={refresh} title="Refresh" aria-label="Refresh">
            <Icon name="refresh" size={15} />
          </button>
        </div>
      </div>

      {/* ── Three action cards ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Start Instant Meeting */}
        <div style={cardStyle}>
          <Icon name="video_call" size={32} style={{ color: 'var(--ok)' }} />
          <div style={cardTitleStyle}>Start Instant Meeting</div>
          <div style={{ ...cardSubStyle, flex: 1 }}>Open a new Google Meet right now</div>
          <button className="btn btn-accent btn-full" onClick={() => window.open('https://meet.google.com/new', '_blank')}>
            Start Now
          </button>
        </div>

        {/* Join a Meeting */}
        <div style={cardStyle}>
          <Icon name="meeting_room" size={32} style={{ color: 'var(--p)' }} />
          <div style={cardTitleStyle}>Join a Meeting</div>
          <div style={{ ...cardSubStyle, flex: 1 }}>Enter a meeting code or link</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
            <input
              className="fc"
              placeholder="abc-defg-hij or full link"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button className="btn btn-primary" onClick={join}>Join</button>
          </div>
        </div>

        {/* Custom Meeting */}
        <div style={cardStyle}>
          <Icon name="event" size={32} style={{ color: 'var(--warn)' }} />
          <div style={cardTitleStyle}>Custom Meeting</div>
          <div style={{ ...cardSubStyle, flex: 1 }}>Schedule a Google Meet with hand-picked invites</div>
          <button className="btn btn-primary btn-full" onClick={() => setModalType('custom')}>
            Schedule
          </button>
        </div>
      </div>

      {/* ── Meeting templates — Company: admin/SA only; Team: managers only. ── */}
      {(admin || manager) && (
        <>
          <div style={sectionLabelStyle}>
            <Icon name="auto_awesome" size={15} /> MEETING TEMPLATES
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: admin && manager ? 'repeat(2, 1fr)' : '1fr', gap: 16 }}>
            {admin && (
              <button
                onClick={() => setModalType('company')}
                style={{ textAlign: 'left', background: '#e3f2fd', border: '2px solid #90caf9', borderRadius: 12, padding: 20, cursor: 'pointer' }}
              >
                <Icon name="corporate_fare" size={28} style={{ color: '#1565c0' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#0d47a1', marginTop: 8 }}>Company Meeting</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Invite the entire company — all active employees are auto-added.
                </div>
                <span style={{ display: 'inline-block', marginTop: 12, background: '#1565c0', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999 }}>
                  Admin &amp; Founders only
                </span>
              </button>
            )}

            {manager && (
              <button
                onClick={() => setModalType('team')}
                style={{ textAlign: 'left', background: '#e8f5e9', border: '2px solid #a5d6a7', borderRadius: 12, padding: 20, cursor: 'pointer' }}
              >
                <Icon name="groups" size={28} style={{ color: 'var(--ok)' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: '#1b5e20', marginTop: 8 }}>Team Meeting</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Invite your team members — select a team and all its members are auto-added.
                </div>
                <span style={{ display: 'inline-block', marginTop: 12, background: 'var(--ok)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999 }}>
                  Managers &amp; above
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {modalType && (
        <ScheduleMeetingModal
          key={modalType}
          initialMeetType={modalType}
          onClose={() => setModalType(null)}
        />
      )}

      {/* ── Upcoming meetings ──────────────────────────── */}
      <div style={upcomingHeaderStyle}>
        <Icon name="upcoming" size={18} style={{ color: 'var(--p)' }} /> Upcoming Meetings
      </div>
      {isLoading ? (
        <div className="empty-state">
          <Spinner size={20} />
          <p>Loading…</p>
        </div>
      ) : (upcoming?.length ?? 0) === 0 ? (
        <div className="empty-state">
          <Icon name="calendar_month" size={40} className="ei" />
          <p>No upcoming meetings.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {upcoming!.map((m) => (
            <MeetingCard
              key={m.meetingId}
              ref={m.meetingId === highlightId ? highlightRef : undefined}
              meeting={m}
              canCancel={canCancel(m.organizerId)}
              onCancel={() => onCancel(m.meetingId)}
              highlighted={m.meetingId === highlightId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
