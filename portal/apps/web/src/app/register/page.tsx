'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '../../lib/api';
import { takePendingGoogleIdToken, decodeJwtPayloadUnsafe } from '../../lib/session';

// Same taxonomy as LGDesk's registration-modal.schema.ts TEAM_HIERARCHY -- duplicated
// deliberately, not imported: Portal and LGDesk are separate frontend codebases with no
// shared package (per the architecture doc, each pillar is its own top-level monorepo).
const TEAM_HIERARCHY: Record<string, string[]> = {
  "1. Founder's Office": ['1a. MIS, Data & Strategy', '1b. Innovation (R&D)'],
  '2. Student Success': ['2a. Student Counselling (Sales)', '2b. Student Support (Customer Support)', '2c. Partnerships & Outreach'],
  '3. Knowledge': [],
  '4. Growth (Marketing)': ['4a. Vision & Voice', '4b. Creative Hub'],
  '5. Tech': ['5a. Product', '5b. Development', '5c. Maintenance'],
  '6. Consulting': ['6a. Client Delivery', '6b. Research'],
  '7. Operations - PP & Admin': ['7a. People & Performance (HR)', '7b. Admin'],
  '8. Operations - FP&A': ['8a. Financial Planning & Analysis'],
};
const DIVISIONS = Object.keys(TEAM_HIERARCHY);
const ALL_ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator', 'Team Member', 'Intern'];
// Same as apps/api/src/common/constants.ts's MANUAL_MANAGER_ROLES -- these roles type in
// who they report to; everyone else gets it auto-resolved via the team-captain lookup.
const MANUAL_MANAGER_ROLES = new Set(['Super Admin', 'Admin', 'Team Captain']);

export default function RegisterPage() {
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Team Member');
  const [team, setTeam] = useState('');
  const [subDepartment, setSubDepartment] = useState('');
  const [designation, setDesignation] = useState('');
  const [dob, setDob] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [resolvedManager, setResolvedManager] = useState<{ email: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const manualManager = MANUAL_MANAGER_ROLES.has(role);

  // Google-assisted path (Phase 6 Part 2): pick up the already-verified ID token exactly
  // once and prefill name/email -- the person shouldn't need to notice a difference beyond
  // "continue filling in your details."
  useEffect(() => {
    const token = takePendingGoogleIdToken();
    if (!token) return;
    setGoogleIdToken(token);
    const payload = decodeJwtPayloadUnsafe(token);
    if (payload) {
      if (typeof payload.given_name === 'string') setFirstName(payload.given_name);
      if (typeof payload.family_name === 'string') setLastName(payload.family_name);
      if (typeof payload.email === 'string') setEmail(payload.email);
    }
  }, []);

  // Manager/Team-Captain auto-fill lookup (Phase 4a) for every role except the manual ones.
  useEffect(() => {
    if (manualManager || !team) {
      setResolvedManager(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const qs = new URLSearchParams({ team, ...(subDepartment ? { subDept: subDepartment } : {}) });
        const tc = await apiFetch<{ email: string; name: string } | null>(`/registration/team-captain?${qs.toString()}`);
        if (!cancelled) setResolvedManager(tc);
      } catch {
        if (!cancelled) setResolvedManager(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [team, subDepartment, manualManager]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch('/registration', {
        method: 'POST',
        body: {
          firstName,
          lastName,
          email,
          password,
          role,
          team: team || undefined,
          subDepartment: subDepartment || undefined,
          designation: designation || undefined,
          dob: dob || undefined,
          managerEmail: manualManager && managerEmail ? managerEmail : undefined,
          googleIdToken: googleIdToken ?? undefined,
        },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to submit registration');
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 360, padding: 24, border: '1px solid #ddd', borderRadius: 8, textAlign: 'center' }}>
          <h1 style={{ fontSize: 18, marginBottom: 8, color: '#2e7d32' }}>Request submitted</h1>
          <p style={{ fontSize: 14, color: '#666' }}>Your registration is pending approval from your manager or an admin. You&apos;ll be able to sign in once it&apos;s approved.</p>
          <a href="/" style={{ display: 'inline-block', marginTop: 16, color: '#1a237e', fontSize: 13 }}>← Back to sign in</a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={onSubmit} style={{ width: 400, padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
        <h1 style={{ fontSize: 20, marginBottom: 4, color: '#1a237e' }}>Register</h1>
        <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
          {googleIdToken ? 'Continue setting up your account.' : 'Create your account.'}
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <input placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required style={inputStyle} />
          <input placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} required style={inputStyle} />
        </div>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ ...inputStyle, marginBottom: 8 }} />
        <input
          type="password"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={6}
          required
          style={{ ...inputStyle, marginBottom: 8 }}
        />

        <label style={labelStyle}>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
          {ALL_ROLES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <label style={labelStyle}>Team</label>
        <select
          value={team}
          onChange={(e) => {
            setTeam(e.target.value);
            setSubDepartment('');
          }}
          style={{ ...inputStyle, marginBottom: 8 }}
        >
          <option value="">— Select a division —</option>
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>

        {team && TEAM_HIERARCHY[team]?.length > 0 && (
          <>
            <label style={labelStyle}>Sub-department</label>
            <select value={subDepartment} onChange={(e) => setSubDepartment(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }}>
              <option value="">— Select —</option>
              {TEAM_HIERARCHY[team].map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </>
        )}

        <input placeholder="Designation (optional)" value={designation} onChange={(e) => setDesignation(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />
        <input type="date" value={dob} onChange={(e) => setDob(e.target.value)} style={{ ...inputStyle, marginBottom: 8 }} />

        <label style={labelStyle}>Reports to</label>
        {manualManager ? (
          <input
            type="email"
            placeholder={role === 'Super Admin' ? "Manager's email (optional)" : "Manager's email"}
            value={managerEmail}
            onChange={(e) => setManagerEmail(e.target.value)}
            required={role !== 'Super Admin'}
            style={{ ...inputStyle, marginBottom: 8 }}
          />
        ) : (
          <input
            readOnly
            value={resolvedManager ? `${resolvedManager.name} (${resolvedManager.email})` : team ? 'Resolving…' : 'Select a team first'}
            style={{ ...inputStyle, marginBottom: 8, background: '#f5f5f5', color: '#666' }}
          />
        )}

        {error && <p style={{ color: '#c62828', fontSize: 13, marginTop: 4, marginBottom: 8 }}>{error}</p>}

        <button type="submit" disabled={busy} style={{ width: '100%', padding: 9, background: '#1a237e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', marginTop: 8 }}>
          {busy ? 'Submitting…' : 'Submit registration'}
        </button>
        <p style={{ fontSize: 13, color: '#666', marginTop: 12, textAlign: 'center' }}>
          <a href="/" style={{ color: '#1a237e' }}>← Back to sign in</a>
        </p>
      </form>
    </main>
  );
}

const inputStyle: React.CSSProperties = { width: '100%', padding: 8, boxSizing: 'border-box' };
const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#666', marginBottom: 2 };
