'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest, apiUpload } from '@/lib/api';
import { Upload, Loader2, FileCode, CheckCircle2, Rocket, Check, Sparkles } from 'lucide-react';

type Stage = 'upload' | 'detecting' | 'review' | 'commit' | 'done';

export default function ImportPage() {
  const [stage, setStage] = useState<Stage>('upload');
  const [batchId, setBatchId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [detectResult, setDetectResult] = useState<any>(null);
  const [usdRate, setUsdRate] = useState(83.50);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiRequest<any[]>('/groups/').then(g => { setGroups(g); if (g.length > 0) setSelectedGroup(g[0].id); }).catch(() => {});
  }, []);

  const doUpload = async (file: File) => {
    if (!selectedGroup) return alert('Please select a group first');
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('group_id', selectedGroup);
      const res = await apiUpload<any>('/imports/upload', fd);
      setBatchId(res.batch_id);
      setResult(res);
      setStage('detecting');
      
      const d = await apiRequest<any>(`/imports/${res.batch_id}/detect-anomalies`, { method: 'POST' });
      setDetectResult(d);
      setStage('review');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const doCommit = async () => {
    if (!batchId) return;
    setLoading(true);
    try {
      const r = await apiRequest<any>(`/imports/${batchId}/commit`, { method: 'POST', body: JSON.stringify({ usd_to_inr_rate: usdRate }) });
      setResult(r);
      setStage('done');
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.csv')) doUpload(file);
  }, [selectedGroup]);

  const STAGES = ['upload', 'detecting', 'review', 'commit', 'done'];
  const stageIdx = STAGES.indexOf(stage);
  const STAGE_LABELS = ['1. Upload', '2. Detect', '3. Review', '4. Commit', '5. Done'];

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
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
          <Upload size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Import CSV</h1>
          <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>5-stage import pipeline with anomaly review</p>
        </div>
      </div>

      {}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 40 }}>
        {STAGE_LABELS.map((label, i) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
                background: i < stageIdx ? '#ffffff' : i === stageIdx ? '#ffffff' : 'rgba(255,255,255,0.08)',
                color: i <= stageIdx ? '#000000' : 'rgba(255,255,255,0.4)',
                boxShadow: i === stageIdx ? '0 0 20px rgba(255,255,255,0.2)' : 'none',
                transition: 'all 0.3s',
              }}>{i < stageIdx ? '✓' : i + 1}</div>
              <span style={{ fontSize: 11, color: i === stageIdx ? '#ffffff' : 'rgba(255,255,255,0.4)', fontWeight: i === stageIdx ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</span>
            </div>
            {i < 4 && <div style={{ flex: 1, height: 2, background: i < stageIdx ? '#ffffff' : 'rgba(255,255,255,0.08)', margin: '0 8px', marginBottom: 20, borderRadius: 1, transition: 'all 0.3s' }} />}
          </div>
        ))}
      </div>

      {}
      {(stage === 'upload' || stage === 'detecting') && (
        <div className="glass" style={{ padding: 32 }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Target Group</label>
            <select className="input-dark" style={{ maxWidth: 320 }} value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div
            className={`dropzone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) doUpload(f); }} />
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              {loading ? (
                <Loader2 size={48} style={{ animation: 'spin-slow 0.8s linear infinite', color: 'rgba(255,255,255,0.5)' }} />
              ) : (
                <FileCode size={48} style={{ color: 'rgba(255,255,255,0.2)' }} />
              )}
            </div>
            <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>
              {loading ? 'Processing…' : 'Drop your CSV here'}
            </p>
            <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.4)' }}>
              {loading ? 'Detecting anomalies…' : 'or click to browse · expenses_export.csv'}
            </p>
          </div>
          {stage === 'detecting' && (
            <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#ffffff', animation: 'spin-slow 0.8s linear infinite' }} />
              <span style={{ fontSize: 13, color: '#ffffff' }}>Running 16 anomaly detection rules…</span>
            </div>
          )}
        </div>
      )}

      {}
      {stage === 'review' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
            {[
              { label: 'Total Rows', value: result?.total_rows, color: '#ffffff' },
              { label: 'Anomalies Found', value: detectResult?.anomaly_count, color: '#ffffff' },
              { label: 'Pending Review', value: detectResult?.anomaly_count, color: '#a1a1aa' },
            ].map(s => (
              <div key={s.label} className="stat-card">
                <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value ?? '—'}</p>
              </div>
            ))}
          </div>
          <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 15, fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle2 size={18} style={{ color: '#4ade80' }} />
              <span>Detection Complete</span>
            </p>
            <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)', lineHeight: 1.6 }}>
              Found <strong>{detectResult?.anomaly_count} anomalies</strong> in {result?.total_rows} rows.
              Go to <a href="/anomalies" style={{ color: '#ffffff', textDecoration: 'underline' }}>Anomaly Review</a> to approve or reject each one, then come back to commit.
            </p>
          </div>
          <div className="glass" style={{ padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>USD → INR Rate Override</p>
            <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)', marginBottom: 12 }}>
              The system fetches live historical rates from Frankfurter.app for each USD expense's date.
              Override here if needed (affects only expenses with no valid historical rate).
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13, color: 'rgba(241,245,249,0.6)' }}>Fallback rate: 1 USD =</span>
              <input type="number" className="input-dark" style={{ width: 120 }} value={usdRate} step={0.01} onChange={e => setUsdRate(parseFloat(e.target.value))} />
              <span style={{ fontSize: 13, color: 'rgba(241,245,249,0.6)' }}>INR</span>
            </div>
          </div>
          <button className="btn-primary" onClick={() => setStage('commit')} style={{ padding: '12px 28px', fontSize: 15 }}>
            Proceed to Commit →
          </button>
          <a href="/anomalies" className="btn-secondary" style={{ marginLeft: 12, textDecoration: 'none', display: 'inline-block' }}>
            Review Anomalies First
          </a>
        </div>
      )}

      {/* Commit stage */}
      {stage === 'commit' && (
        <div className="glass" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Rocket size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Ready to Commit?</h2>
          <p style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)', lineHeight: 1.6, maxWidth: 500, margin: '0 auto 24px' }}>
            All approved rows will be imported as immutable events into the event store.
            Rejected rows are preserved in raw_import_rows but excluded.
            USD amounts will use live historical rates from Frankfurter.app.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-primary" onClick={doCommit} disabled={loading} style={{ padding: '14px 32px', fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
              {loading ? (
                <>
                  <Loader2 size={16} style={{ animation: 'spin-slow 0.8s linear infinite' }} />
                  <span>Committing…</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Commit Import</span>
                </>
              )}
            </button>
            <button className="btn-secondary" onClick={() => setStage('review')}>← Back</button>
          </div>
        </div>
      )}

      {/* Done */}
      {stage === 'done' && (
        <div className="glass" style={{ padding: 48, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Sparkles size={48} style={{ color: 'rgba(255,255,255,0.3)' }} />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>Import Complete!</h2>
          <p style={{ fontSize: 14, color: 'rgba(241,245,249,0.5)', marginBottom: 24 }}>
            {result?.imported_rows} expenses imported · {result?.skipped_rows} skipped
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <a href="/balances" className="btn-primary" style={{ padding: '12px 24px', textDecoration: 'none', display: 'inline-block', borderRadius: 10 }}>View Balances →</a>
            <a href="/anomalies" className="btn-secondary" style={{ padding: '12px 24px', textDecoration: 'none', display: 'inline-block', borderRadius: 10 }}>Review Anomalies</a>
          </div>
        </div>
      )}
    </div>
  );
}
