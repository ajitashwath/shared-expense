'use client';
import { useEffect, useState } from 'react';
import { apiRequest, formatINR } from '@/lib/api';
import { Scale, LayoutDashboard, Search, Sparkles, List } from 'lucide-react';

export default function BalancesPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [breakdown, setBreakdown] = useState<any>(null);
  const [selectedUser, setSelectedUser] = useState('');
  const [view, setView] = useState<'summary' | 'breakdown'>('summary');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<any[]>('/groups/').then(g => {
      setGroups(g);
      if (g.length > 0) setSelectedGroup(g[0].id);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedGroup) return;
    setSummary(null);
    apiRequest<any>(`/balances/group/${selectedGroup}`).then(setSummary).catch(() => {});
  }, [selectedGroup]);

  const loadBreakdown = async (uid: string) => {
    setSelectedUser(uid);
    setView('breakdown');
    const data = await apiRequest<any>(`/balances/breakdown/${selectedGroup}/${uid}`).catch(() => null);
    setBreakdown(data);
  };

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
            <Scale size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Balances</h1>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>
              Aisha's view: who pays whom · Rohan's view: expense breakdown
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['summary', 'breakdown'].map(v => (
            <button key={v} onClick={() => setView(v as any)} style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
              background: view === v ? '#ffffff' : 'rgba(255,255,255,0.06)',
              border: view === v ? '1px solid #ffffff' : '1px solid rgba(255,255,255,0.1)',
              color: view === v ? '#09090b' : 'rgba(241,245,249,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              {v === 'summary' ? (
                <>
                  <LayoutDashboard size={14} />
                  <span>Summary</span>
                </>
              ) : (
                <>
                  <Search size={14} />
                  <span>Breakdown</span>
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {}
      <div className="glass" style={{ padding: '12px 16px', marginBottom: 24, display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.6)' }}>Group:</label>
        <select className="input-dark" style={{ maxWidth: 300 }} value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {view === 'summary' && summary && (
        <div>
          {}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            {summary.member_balances?.map((b: any, i: number) => (
              <button key={b.user_id} onClick={() => loadBreakdown(b.user_id)} className="stat-card animate-fade-in-up"
                style={{ animationDelay: `${i * 60}ms`, textAlign: 'left', cursor: 'pointer', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14 }}>
                    {b.user_name?.charAt(0)}
                  </div>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{b.user_name}</span>
                </div>
                <p style={{ fontSize: 22, fontWeight: 800, color: '#ffffff' }}>
                  {b.net_balance >= 0 ? '+' : ''}{formatINR(b.net_balance)}
                </p>
                <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginTop: 4 }}>
                  {b.net_balance >= 0 ? '← owed to them' : '→ they owe'}
                </p>
                <p style={{ fontSize: 11, color: '#ffffff', marginTop: 8 }}>Click for breakdown →</p>
              </button>
            ))}
          </div>

          {}
          <div className="glass" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Settlement Plan</h2>
            <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)', marginBottom: 20 }}>Minimum transactions to settle all debts</p>
            {summary.who_owes_whom?.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {summary.who_owes_whom.map((t: any, i: number) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#ffffff' }}>{t.from_user?.charAt(0)}</div>
                    <span style={{ fontWeight: 600 }}>{t.from_user}</span>
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
                      <span style={{ fontSize: 16, fontWeight: 800, color: '#ffffff' }}>{formatINR(t.amount)}</span>
                      <div style={{ flex: 1, height: 2, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
                    </div>
                    <span style={{ fontWeight: 600 }}>{t.to_user}</span>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#ffffff' }}>{t.to_user?.charAt(0)}</div>
                    <a href="/settlements" className="btn-primary" style={{ padding: '6px 12px', borderRadius: 8, textDecoration: 'none', fontSize: 12, fontWeight: 600 }}>
                      Record ✓
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'rgba(241,245,249,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                  <Sparkles size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <p>All settled up!</p>
              </div>
            )}
          </div>
        </div>
      )}

      {view === 'breakdown' && (
        <div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <button onClick={() => setView('summary')} className="btn-secondary" style={{ fontSize: 13 }}>← Back</button>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.6)' }}>Member:</label>
            <select className="input-dark" style={{ maxWidth: 200 }} value={selectedUser} onChange={e => loadBreakdown(e.target.value)}>
              {summary?.member_balances?.map((b: any) => <option key={b.user_id} value={b.user_id}>{b.user_name}</option>)}
            </select>
          </div>

          {breakdown ? (
            <div>
              {}
              <div className="glass-strong" style={{ padding: 24, marginBottom: 24, display: 'flex', gap: 24 }}>
                <div>
                  <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Net Balance</p>
                  <p style={{ fontSize: 32, fontWeight: 800, color: '#ffffff' }}>
                    {(breakdown.net_balance ?? 0) >= 0 ? '+' : ''}{formatINR(breakdown.net_balance ?? 0)}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Paid</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: '#ffffff' }}>{formatINR(breakdown.total_paid ?? 0)}</p>
                </div>
                <div>
                  <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Total Share</p>
                  <p style={{ fontSize: 28, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>{formatINR(breakdown.total_share ?? 0)}</p>
                </div>
              </div>

              {}
              <div className="glass" style={{ padding: 24 }}>
                <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <List size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
                  <span>If {breakdown.user_name} asks "why do I owe this?" — here's every expense:</span>
                </h2>
                {breakdown.expenses?.length > 0 ? (
                  <table className="table-dark">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Paid By</th>
                        <th>Total</th>
                        <th>Your Share</th>
                        <th>Paid?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.expenses.map((e: any) => (
                        <tr key={e.expense_id}>
                          <td style={{ color: 'rgba(241,245,249,0.5)', fontSize: 12 }}>{new Date(e.expense_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}</td>
                          <td style={{ fontWeight: 500 }}>{e.description}</td>
                          <td>{e.paid_by}</td>
                          <td>{formatINR(e.total_amount)}</td>
                          <td style={{ fontWeight: 700, color: '#ffffff' }}>
                            {e.paid_by === breakdown.user_name ? `+${formatINR(e.total_amount - e.your_share)}` : `-${formatINR(e.your_share)}`}
                          </td>
                          <td><span className={`badge ${e.paid_by === breakdown.user_name ? 'badge-success' : 'badge-low'}`}>{e.paid_by === breakdown.user_name ? 'PAID' : 'OWES'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p style={{ color: 'rgba(241,245,249,0.4)', textAlign: 'center', padding: '24px 0' }}>No expense data available</p>
                )}
              </div>
            </div>
          ) : (
            <div className="shimmer" style={{ height: 300, borderRadius: 16 }} />
          )}
        </div>
      )}
    </div>
  );
}
