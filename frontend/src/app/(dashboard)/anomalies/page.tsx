'use client';
import { useEffect, useState } from 'react';
import { apiRequest, ANOMALY_COLORS, SEVERITY_STYLES, formatDate } from '@/lib/api';
import {
  AlertTriangle,
  Check,
  X,
  RefreshCw,
  Zap,
  ArrowRight,
  Sparkles,
  ChevronUp,
  ChevronDown
} from 'lucide-react';

interface Anomaly {
  id: string;
  row_number: number;
  category: string;
  severity: string;
  raw_data: Record<string, any>;
  detected_rule: string;
  suggested_resolution: string;
  user_decision: string | null;
  decided_by?: string;
  decided_at?: string;
  notes?: string;
}

const DECISIONS = [
  { key: 'APPROVE', label: 'Approve', style: 'btn-success' },
  { key: 'REJECT', label: 'Reject', style: 'btn-danger' },
  { key: 'MERGE', label: 'Merge', style: 'btn-warning' },
  { key: 'OVERRIDE', label: 'Override', style: 'btn-primary' },
  { key: 'SKIP', label: 'Skip', style: 'btn-secondary' },
];

export default function AnomaliesPage() {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [filter, setFilter] = useState<string>('PENDING');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [deciding, setDeciding] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<any[]>('/imports/').then(b => {
      setBatches(b);
      if (b.length > 0) setSelectedBatch(b[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedBatch) return;
    const decided = filter === 'PENDING' ? false : filter === 'DECIDED' ? true : undefined;
    const params = decided !== undefined ? `?decided=${decided}` : '';
    apiRequest<Anomaly[]>(`/imports/${selectedBatch}/anomalies${params}`).then(setAnomalies).catch(() => setAnomalies([]));
  }, [selectedBatch, filter]);

  const resolve = async (anomalyId: string, decision: string) => {
    setDeciding(anomalyId);
    try {
      await apiRequest(`/imports/anomalies/${anomalyId}/resolve`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      setAnomalies(prev => prev.map(a => a.id === anomalyId ? { ...a, user_decision: decision } : a));
    } catch (e) {
      alert('Failed to resolve anomaly');
    } finally {
      setDeciding(null);
    }
  };

  const resolveAll = async (decision: string) => {
    if (!selectedBatch) return;
    if (!confirm(`Bulk ${decision.toLowerCase()} all undecided anomalies?`)) return;
    await apiRequest(`/imports/${selectedBatch}/resolve-all`, { method: 'POST', body: JSON.stringify({ decision }) });
    
    const decided = filter === 'PENDING' ? false : filter === 'DECIDED' ? true : undefined;
    const params = decided !== undefined ? `?decided=${decided}` : '';
    apiRequest<Anomaly[]>(`/imports/${selectedBatch}/anomalies${params}`).then(setAnomalies).catch(() => {});
  };

  const pending = anomalies.filter(a => !a.user_decision);
  const decided = anomalies.filter(a => a.user_decision);

  if (loading) return <div style={{ padding: 32 }}><div className="shimmer" style={{ height: 400, borderRadius: 16 }} /></div>;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 46,
            height: 46,
            borderRadius: 14,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)'
          }}>
            <AlertTriangle size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Anomaly Review</h1>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>Meera's rule: nothing gets deleted without your approval</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => resolveAll('APPROVE')} className="btn-success" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><Check size={14} /> Approve All</button>
          <button onClick={() => resolveAll('REJECT')} className="btn-danger" style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> Reject All</button>
        </div>
      </div>

      {batches.length > 0 && (
        <div className="glass" style={{ padding: 16, marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: 'rgba(241,245,249,0.6)', fontWeight: 600 }}>Import Batch:</label>
          <select className="input-dark" style={{ flex: 1, maxWidth: 400 }} value={selectedBatch} onChange={e => setSelectedBatch(e.target.value)}>
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.filename} — {b.anomaly_count} anomalies ({b.status})</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 8 }}>
            {['ALL', 'PENDING', 'DECIDED'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: filter === f ? '#ffffff' : 'rgba(255,255,255,0.06)',
                border: filter === f ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.1)',
                color: filter === f ? '#09090b' : 'rgba(241,245,249,0.6)',
              }}>{f}</button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div className="stat-card" style={{ flex: 1, padding: 16 }}>
          <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Pending Review</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>{pending.length}</p>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: 16 }}>
          <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Decided</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: 'rgba(255, 255, 255, 0.6)', letterSpacing: '-0.02em' }}>{decided.length}</p>
        </div>
        <div className="stat-card" style={{ flex: 1, padding: 16 }}>
          <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.02em' }}>{anomalies.length}</p>
        </div>
      </div>

      {anomalies.length === 0 ? (
        <div className="glass" style={{ padding: 48, textAlign: 'center', color: 'rgba(241,245,249,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <Sparkles size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 600 }}>No anomalies found</p>
          <p style={{ fontSize: 13 }}>Upload a CSV and run detection first</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {anomalies.map((a, i) => {
            const isExpanded = expanded.has(a.id);
            const decided = !!a.user_decision;
            return (
              <div key={a.id} className="glass animate-fade-in-up"
                style={{ padding: 0, animationDelay: `${i * 30}ms`, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
                  onClick={() => setExpanded(prev => { const n = new Set(prev); n.has(a.id) ? n.delete(a.id) : n.add(a.id); return n; })}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'rgba(241,245,249,0.4)', flexShrink: 0 }}>
                    R{a.row_number}
                  </div>
                  <span className={`badge ${SEVERITY_STYLES[a.severity] || 'badge-low'}`} style={{ flexShrink: 0 }}>{a.severity}</span>
                  <span className={`badge ${ANOMALY_COLORS[a.category] || 'badge-low'}`} style={{ flexShrink: 0, fontSize: 10 }}>{a.category.replace(/_/g, ' ')}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.raw_data?.description || '(no description)'}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.detected_rule}
                    </p>
                  </div>
                  {decided ? (
                    <span className={`badge ${a.user_decision === 'APPROVE' ? 'badge-success' : a.user_decision === 'REJECT' ? 'badge-critical' : 'badge-medium'}`}>
                      {a.user_decision}
                    </span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      {DECISIONS.map(d => (
                        <button key={d.key} className={d.style} disabled={deciding === a.id}
                          onClick={() => resolve(a.id, d.key)}
                          style={{ fontSize: 11, padding: '5px 10px' }}>
                          {d.label}
                        </button>
                      ))}
                    </div>
                  )}
                  <span style={{ color: 'rgba(241,245,249,0.3)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '16px 20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Raw CSV Row</p>
                      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, fontSize: 12, fontFamily: 'monospace', color: '#ffffff', lineHeight: 1.7 }}>
                        {Object.entries(a.raw_data || {}).map(([k, v]) => v && String(v).trim() && String(v).trim() !== 'nan' ? (
                          <div key={k}><span style={{ color: 'rgba(255,255,255,0.4)' }}>{k}:</span> {String(v)}</div>
                        ) : null)}
                      </div>
                    </div>
                    <div>
                      <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suggested Resolution</p>
                      <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, fontSize: 12, color: '#ffffff', lineHeight: 1.6 }}>
                        {a.suggested_resolution}
                      </div>
                      {a.user_decision && (
                        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', fontSize: 12, color: '#ffffff', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Check size={14} style={{ color: '#4ade80' }} /> Decided: <strong>{a.user_decision}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
