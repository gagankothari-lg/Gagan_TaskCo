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
  borderRadius: 8,
  boxShadow: 'var(--sh)',
  padding: 20,
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

const cardTitleStyle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: 'var(--p)' };
const cardSubStyle: React.CSSProperties = { fontSize: 12, color: 'var(--muted)', marginTop: 2 };

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
          <button className="btn btn-ghost btn-sm" onClick={refresh}>
            <Icon name="refresh" size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* ── Three action cards ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {/* Start Instant Meeting */}
        <div style={cardStyle}>
          <Icon name="video_camera_front" size={28} style={{ color: '#00897b' }} />
          <div style={{ ...cardTitleStyle, marginTop: 8 }}>Start Instant Meeting</div>
          <div style={cardSubStyle}>Open a new Google Meet right now</div>
          <button
            onClick={() => window.open('https://meet.google.com/new', '_blank')}
            style={{ marginTop: 14, width: '100%', background: '#00897b', color: '#fff', padding: 10, borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Start Now
          </button>
        </div>

        {/* Join a Meeting */}
        <div style={cardStyle}>
          <Icon name="login" size={28} style={{ color: 'var(--p)' }} />
          <div style={{ ...cardTitleStyle, marginTop: 8 }}>Join a Meeting</div>
          <div style={cardSubStyle}>Enter a meeting code or link</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              className="fc"
              placeholder="abc-defg-hij or full link"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && join()}
              style={{ flex: 1, minWidth: 0 }}
            />
            <button
              onClick={join}
              style={{ background: 'var(--p)', color: '#fff', padding: '0 16px', borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer' }}
            >
              Join
            </button>
          </div>
        </div>

        {/* Custom Meeting */}
        <div style={cardStyle}>
          <Icon name="event" size={28} style={{ color: '#e64d3d' }} />
          <div style={{ ...cardTitleStyle, marginTop: 8 }}>Custom Meeting</div>
          <div style={cardSubStyle}>Schedule a Google Meet with hand-picked invites</div>
          <button
            onClick={() => setModalType('custom')}
            style={{ marginTop: 14, width: '100%', background: 'var(--p)', color: '#fff', padding: 10, borderRadius: 8, fontWeight: 600, border: 'none', cursor: 'pointer' }}
          >
            Schedule
          </button>
        </div>
      </div>

      {/* ── Meeting templates — Company: admin/SA only; Team: managers only. ── */}
      {(admin || manager) && (
        <>
          <div style={sectionLabelStyle}>
            <Icon name="account_tree" size={15} /> MEETING TEMPLATES
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: admin && manager ? 'repeat(2, 1fr)' : '1fr', gap: 16 }}>
            {admin && (
              <button
                onClick={() => setModalType('company')}
                style={{ textAlign: 'left', background: '#e3f2fd', borderRadius: 8, padding: 20, border: 'none', cursor: 'pointer' }}
              >
                <Icon name="corporate_fare" size={28} style={{ color: 'var(--accent)' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--p)', marginTop: 8 }}>Company Meeting</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Invite your entire company — all active employees are auto-added.
                </div>
                <span style={{ display: 'inline-block', marginTop: 12, background: 'var(--p)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999 }}>
                  Admin &amp; Founders only
                </span>
              </button>
            )}

            {manager && (
              <button
                onClick={() => setModalType('team')}
                style={{ textAlign: 'left', background: '#e8f5e9', borderRadius: 8, padding: 20, border: 'none', cursor: 'pointer' }}
              >
                <Icon name="groups" size={28} style={{ color: 'var(--ok)' }} />
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--p)', marginTop: 8 }}>Team Meeting</div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  Invite your team members for a focused sync.
                </div>
                <span style={{ display: 'inline-block', marginTop: 12, background: 'var(--ok)', color: '#fff', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 9999 }}>
                  Managers &amp; above
                </span>
              </button>
            )}
          </div>
        </>
      )}

      {/* ── Upcoming meetings ──────────────────────────── */}
      <div style={sectionLabelStyle}>
        <Icon name="event" size={15} /> UPCOMING MEETINGS
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

      {modalType && (
        <ScheduleMeetingModal
          key={modalType}
          open
          initialMeetType={modalType}
          onClose={() => setModalType(null)}
        />
      )}
    </div>
  );
}
