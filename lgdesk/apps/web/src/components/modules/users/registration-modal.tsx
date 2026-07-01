'use client';

import { useState, type FormEvent } from 'react';
import { Icon } from '../../ui/icon';
import { apiErrorMessage } from '../../../lib/api/client';
import { registerRequest } from '../../../lib/api/auth';
import { Spinner } from '../../ui/spinner';

interface RegistrationModalProps {
  open: boolean;
  onClose: () => void;
}

const ROLES = ['Super Admin', 'Admin', 'Team Captain', 'Team Facilitator', 'Team Member', 'Intern'];
const TEAM_HIERARCHY: Record<string, string[]> = {
  "1. Founder's Office": [],
  '2. Student Success': ['CFA L1', 'CFA L2', 'CFA L3', 'FRM', 'CA', 'CMA', 'CFA Scholarships', 'CUET'],
  '3. Knowledge': [],
  '4. Growth (Marketing)': ['Digital Marketing', 'Brand & Design', 'Social Media', 'Content', 'Events', 'Partnerships'],
  '5. Tech': ['Product', 'Development', 'Maintenance'],
  '6. Consulting': [],
  '7. Operations - PP & Admin': ['HR', 'Finance', 'Admin', 'IT Infrastructure'],
  '8. Operations - FP&A': ['FP&A', 'MIS', 'Procurement'],
};
const DIVISIONS = Object.keys(TEAM_HIERARCHY);
// Roles that enter their reporting manager manually; others are auto-resolved server-side.
const MANUAL_MANAGER_ROLES = ['Super Admin', 'Admin', 'Team Captain'];

export function RegistrationModal({ open, onClose }: RegistrationModalProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Team Member');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [designation, setDesignation] = useState('');
  const [dob, setDob] = useState('');
  const [team, setTeam] = useState('');
  const [subDepartment, setSubDepartment] = useState('');
  const [managerEmail, setManagerEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const managerManual = MANUAL_MANAGER_ROLES.includes(role);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError('First and last name are required.');
    if (!email.trim()) return setError('Email is required.');
    if (!dob) return setError('Date of birth is required.');
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      // Only the API-whitelisted fields are persisted; role/dob/manager/message are
      // collected for parity with the GAS form (the backend strips unknown keys).
      await registerRequest({
        firstName, lastName, email, password,
        team: team || undefined,
        subDepartment: subDepartment || undefined,
        designation: designation || undefined,
      });
      setSubmitted(true);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to submit registration'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg">
        <div className="modal-hd">
          <span className="modal-hd-title">Request Access — Register</span>
          <button className="modal-x" onClick={onClose} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        {submitted ? (
          <div className="modal-bd">
            <div className="empty-state">
              <Icon name="check_circle" size={40} className="ei" style={{ color: 'var(--ok)', opacity: 1 }} />
              <p><strong>Registration submitted!</strong><br />Your manager will review your request. You can sign in once it&apos;s approved.</p>
            </div>
            <button className="btn btn-primary btn-full" onClick={onClose}>Done</button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="modal-bd" noValidate>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="fg"><label>First Name</label><input className="fc" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
              <div className="fg"><label>Last Name</label><input className="fc" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
            </div>
            <div className="fg"><label>Work Email</label><input className="fc" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="fg"><label>Role</label>
                <select className="fc" value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
              </div>
              <div className="fg"><label>Date of Birth</label><input className="fc" type="date" value={dob} onChange={(e) => setDob(e.target.value)} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="fg"><label>Password</label><input className="fc" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" /></div>
              <div className="fg"><label>Confirm Password</label><input className="fc" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /></div>
            </div>
            <div className="fg"><label>Designation (optional)</label><input className="fc" maxLength={100} value={designation} onChange={(e) => setDesignation(e.target.value)} /></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="fg"><label>Team Division</label>
                <select className="fc" value={team} onChange={(e) => { setTeam(e.target.value); setSubDepartment(''); }}>
                  <option value="">— Select Division —</option>{DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              {team && TEAM_HIERARCHY[team]?.length > 0 ? (
                <div className="fg"><label>Sub-Department</label>
                  <select className="fc" value={subDepartment} onChange={(e) => setSubDepartment(e.target.value)}>
                    <option value="">— Select Sub-department —</option>
                    {TEAM_HIERARCHY[team].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              ) : (
                <div className="fg" style={{ opacity: team ? 0.4 : 1 }}><label>Sub-Department</label>
                  <select className="fc" disabled value=""><option value="">N/A for this division</option></select>
                </div>
              )}
            </div>
            <div className="fg">
              <label>{role === 'Super Admin' ? 'Reports-to Email (optional)' : managerManual ? 'Reports-to Email' : "Manager's Email"}</label>
              <input className="fc" type="email" value={managerEmail} onChange={(e) => setManagerEmail(e.target.value)} placeholder={managerManual ? 'manager@company.com' : 'Auto-resolved on approval'} />
            </div>
            <div className="fg"><label>Message (optional)</label><textarea className="fc" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} style={{ resize: 'none' }} /></div>

            {error && <div style={{ background: '#fce8e8', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>}

            <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
              {loading && <Spinner size={14} />}{loading ? 'Submitting…' : 'Submit Registration'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default RegistrationModal;
