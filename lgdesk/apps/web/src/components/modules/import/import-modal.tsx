'use client';

import { useState } from 'react';
import { Icon } from '../../ui/icon';
import { Spinner } from '../../ui/spinner';
import { useAuth } from '../../../hooks/use-auth';
import { apiErrorMessage } from '../../../lib/api';
import { avatarColor, initials } from '../../../lib/utils';
import { statusPillStyle } from '../../../lib/status-styles';
import { toast } from '../../../lib/toast';
import {
  useExecuteImport,
  usePreviewCsv,
  usePreviewSheet,
  type ImportRow,
  type PreviewResult,
} from '../../../hooks/use-import';
import { useQueryClient } from '@tanstack/react-query';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

type Stage = 'form' | 'preview';
type Tab = 'sheet' | 'csv';

const TYPE_PILL: Record<ImportRow['type'], { bg: string; color: string }> = {
  Function: { bg: '#e3f2fd', color: '#1565c0' },
  'Sub-Fn': { bg: '#e0f2f1', color: '#00695c' },
  Task: { bg: '#f5f5f5', color: '#757575' },
};

const PRIORITY_COLOR: Record<string, string> = {
  High: '#e65100',
  Medium: '#1a237e',
  Critical: '#c62828',
  Low: '#757575',
};

function typePillStyle(type: ImportRow['type']): React.CSSProperties {
  const p = TYPE_PILL[type];
  return {
    background: p.bg,
    color: p.color,
    fontSize: 11,
    fontWeight: 600,
    borderRadius: 10,
    padding: '2px 8px',
    display: 'inline-block',
    whiteSpace: 'nowrap',
  };
}

function PersonCell({ name }: { name: string }) {
  if (!name) return <span style={{ color: 'var(--muted2)' }}>—</span>;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 24,
          height: 24,
          borderRadius: '50%',
          background: avatarColor(name),
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {initials(name)}
      </span>
      <span style={{ whiteSpace: 'nowrap' }}>{name}</span>
    </span>
  );
}

export function ImportModal({ open, onClose }: ImportModalProps) {
  const { projects } = useAuth();
  const qc = useQueryClient();
  const previewSheet = usePreviewSheet();
  const previewCsv = usePreviewCsv();
  const execute = useExecuteImport();

  const [stage, setStage] = useState<Stage>('form');
  const [tab, setTab] = useState<Tab>('sheet');

  // form state
  const [sheetUrl, setSheetUrl] = useState('');
  const [tabName, setTabName] = useState('');
  const [projectId, setProjectId] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  // preview state
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [stats, setStats] = useState<PreviewResult['stats']>({
    functions: 0,
    subFunctions: 0,
    tasks: 0,
    total: 0,
  });

  if (!open) return null;

  function reset() {
    setStage('form');
    setTab('sheet');
    setSheetUrl('');
    setTabName('');
    setProjectId('');
    setCsvFile(null);
    setError(null);
    setRows([]);
    setStats({ functions: 0, subFunctions: 0, tasks: 0, total: 0 });
  }

  function close() {
    reset();
    onClose();
  }

  function applyPreview(result: PreviewResult) {
    setRows(result.rows);
    setStats(result.stats);
    setStage('preview');
  }

  async function onPreviewSheet() {
    setError(null);
    if (!sheetUrl.trim()) {
      setError('Enter a Google Sheet URL or ID.');
      return;
    }
    try {
      const result = await previewSheet.mutateAsync({
        sheetUrl: sheetUrl.trim(),
        tabName: tabName.trim() || undefined,
        projectId: projectId || undefined,
      });
      applyPreview(result);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to read that sheet.'));
    }
  }

  async function onPreviewCsv() {
    setError(null);
    if (!csvFile) {
      setError('Choose a CSV file first.');
      return;
    }
    try {
      const result = await previewCsv.mutateAsync({ file: csvFile, projectId: projectId || undefined });
      applyPreview(result);
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to read that CSV.'));
    }
  }

  function toggleRow(index: number) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, selected: !r.selected } : r)));
  }

  function setAll(selected: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected })));
  }

  async function onExecute() {
    setError(null);
    const chosen = rows.filter((r) => r.selected);
    if (chosen.length === 0) {
      setError('Select at least one row to import.');
      return;
    }
    try {
      const result = await execute.mutateAsync({ rows: chosen, projectId: projectId || undefined });
      let message = `Imported ${result.created} item(s)`;
      if (result.errors.length > 0) message += ` — ${result.errors.length} row(s) failed`;
      toast(message, result.errors.length > 0 ? 'warn' : 'success');
      qc.invalidateQueries({ queryKey: ['tasks'] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      qc.invalidateQueries({ queryKey: ['functions'] });
      close();
    } catch (err) {
      setError(apiErrorMessage(err, 'Import failed.'));
    }
  }

  const previewing = previewSheet.isPending || previewCsv.isPending;

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="modal modal-lg">
        <div className="modal-hd">
          <Icon name="description" size={20} style={{ color: 'var(--p)' }} />
          <span className="modal-hd-title">Import Functions, Sub-Functions &amp; Tasks</span>
          <button className="modal-x" onClick={close} aria-label="Close"><Icon name="close" size={18} /></button>
        </div>

        {stage === 'form' ? (
          <div className="modal-bd">
            <div style={{ display: 'flex', gap: 18, borderBottom: '1px solid var(--border)', marginBottom: 18 }}>
              <button
                onClick={() => setTab('sheet')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 2px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: tab === 'sheet' ? 'var(--p)' : 'var(--muted)',
                  borderBottom: tab === 'sheet' ? '2px solid var(--p)' : '2px solid transparent',
                }}
              >
                Via Google Sheet URL
              </button>
              <button
                onClick={() => setTab('csv')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px 2px',
                  fontSize: 13,
                  fontWeight: 600,
                  color: tab === 'csv' ? 'var(--p)' : 'var(--muted)',
                  borderBottom: tab === 'csv' ? '2px solid var(--p)' : '2px solid transparent',
                }}
              >
                Upload CSV
              </button>
            </div>

            {tab === 'sheet' ? (
              <div>
                <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#1565c0', marginBottom: 16, lineHeight: 1.5 }}>
                  Make sure the sheet is shared with{' '}
                  <strong style={{ color: '#3949ab' }}>info@aswinibajaj.com</strong> (Viewer), or set it to
                  &ldquo;anyone with the link (Viewer)&rdquo;. If you can&apos;t share it, use the{' '}
                  <button
                    onClick={() => setTab('csv')}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#3949ab', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    Upload CSV
                  </button>{' '}
                  tab instead.
                </div>

                <div className="fg">
                  <label>Google Sheet URL or ID *</label>
                  <input
                    className="fc"
                    value={sheetUrl}
                    onChange={(e) => setSheetUrl(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/…"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div className="fg">
                    <label>Worksheet / Tab Name</label>
                    <input
                      className="fc"
                      value={tabName}
                      onChange={(e) => setTabName(e.target.value)}
                      placeholder="Optional (first tab if blank)"
                    />
                  </div>
                  <div className="fg">
                    <label>Import into Project</label>
                    <select className="fc" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                      <option value="">No project</option>
                      {projects.map((p) => (
                        <option key={p.projId} value={p.projId}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {error && (
                  <div style={{ background: '#fce8e8', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>
                )}

                <button className="btn btn-primary btn-full" onClick={onPreviewSheet} disabled={previewing}>
                  {previewing && <Spinner size={14} />} Preview Import →
                </button>
              </div>
            ) : (
              <div>
                <div style={{ background: '#e3f2fd', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#1565c0', marginBottom: 16, lineHeight: 1.5 }}>
                  Download your sheet as CSV: <strong>File → Download → Comma-separated values (.csv)</strong>, then upload it here.
                </div>

                <div className="fg">
                  <label>CSV File *</label>
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      border: '1px dashed var(--border)',
                      borderRadius: 8,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      color: csvFile ? 'var(--text)' : 'var(--muted)',
                      fontSize: 13,
                    }}
                  >
                    <Icon name="attach_file" size={18} style={{ color: 'var(--p)' }} />
                    {csvFile ? csvFile.name : 'Choose CSV File'}
                    <input
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={(e) => setCsvFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                    />
                  </label>
                </div>

                <div className="fg">
                  <label>Import into Project</label>
                  <select className="fc" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                    <option value="">No project</option>
                    {projects.map((p) => (
                      <option key={p.projId} value={p.projId}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {error && (
                  <div style={{ background: '#fce8e8', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>
                )}

                <button className="btn btn-primary btn-full" onClick={onPreviewCsv} disabled={previewing}>
                  {previewing && <Spinner size={14} />} Preview CSV →
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="modal-bd" style={{ paddingBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: 'var(--muted)' }}>
                  {stats.total} rows: {stats.functions} functions, {stats.subFunctions} sub-functions, {stats.tasks} tasks
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-ghost" onClick={() => setAll(true)}>Select All</button>
                  <button className="btn btn-ghost" onClick={() => setAll(false)}>Deselect All</button>
                </div>
              </div>

              {error && (
                <div style={{ background: '#fce8e8', color: 'var(--danger)', borderRadius: 8, padding: '9px 12px', fontSize: 13, marginBottom: 12 }}>{error}</div>
              )}

              <div style={{ maxHeight: 420, overflow: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ background: '#3949ab', color: '#fff', position: 'sticky', top: 0 }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}></th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>TYPE</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>FUNCTION</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>SUB-FUNCTION</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>TASK TITLE</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>ASSIGNER</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>ASSIGNEES</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>STATUS</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>PRIORITY</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left' }}>DATE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const isStructure = row.type !== 'Task';
                      const pStyle = statusPillStyle(row.status ?? '');
                      const priorityColor = row.priority ? (PRIORITY_COLOR[row.priority] ?? '#757575') : '#757575';
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--border)', background: row.selected ? 'transparent' : 'rgba(0,0,0,0.02)' }}>
                          <td style={{ padding: '8px 10px' }}>
                            <input type="checkbox" checked={row.selected} onChange={() => toggleRow(i)} style={{ accentColor: 'var(--p)' }} />
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            <span style={typePillStyle(row.type)}>{row.type}</span>
                          </td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{row.function || '—'}</td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{row.subFunction || '—'}</td>
                          <td style={{ padding: '8px 10px' }}>
                            {row.taskTitle ? (
                              <span style={{ fontWeight: 600 }}>{row.taskTitle}</span>
                            ) : (
                              <span style={{ color: 'var(--muted2)', fontStyle: 'italic' }}>structure only</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {isStructure && !row.assigner ? <span style={{ color: 'var(--muted2)' }}>—</span> : <PersonCell name={row.assigner ?? ''} />}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {row.assignees && row.assignees.length > 0 ? (
                              <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
                                {row.assignees.map((a, ai) => <PersonCell key={ai} name={a} />)}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--muted2)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px' }}>
                            {row.status ? (
                              <span style={{ background: pStyle.bg, color: pStyle.color, fontSize: 11, fontWeight: 600, borderRadius: 10, padding: '2px 8px', whiteSpace: 'nowrap' }}>{row.status}</span>
                            ) : (
                              <span style={{ color: 'var(--muted2)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                            {row.priority ? <span style={{ color: priorityColor, fontWeight: 600 }}>{row.priority}</span> : <span style={{ color: 'var(--muted2)' }}>—</span>}
                          </td>
                          <td style={{ padding: '8px 10px', color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>{row.dueDate || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="modal-ft">
              <button className="btn btn-ghost" onClick={() => { setError(null); setStage('form'); }}>← Back</button>
              <button className="btn btn-primary" onClick={onExecute} disabled={execute.isPending}>
                {execute.isPending && <Spinner size={14} />} Import Selected →
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ImportModal;
