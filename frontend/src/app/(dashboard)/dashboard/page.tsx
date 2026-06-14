'use client';
import { useEffect, useState } from 'react';
import { apiRequest, formatINR, formatDateTime, timeAgo } from '@/lib/api';
import {
  CreditCard,
  Check,
  AlertTriangle,
  Database,
  Scale,
  Sparkles,
  Activity,
  Inbox,
  User,
  Home,
  UserPlus,
  UserMinus,
  Scissors,
  Upload,
  Wrench,
  CheckCircle,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface Summary {
  total_events: number;
  total_expenses: number;
  total_settlements: number;
  pending_anomalies: number;
  total_users: number;
  total_groups: number;
  recent_events: Array<{ event_type: string; aggregate_type: string; created_at: string }>;
}

function EventIcon({ type }: { type: string }) {
  const props = { size: 14, style: { color: 'rgba(255,255,255,0.7)' } };
  switch (type) {
    case 'USER_REGISTERED': return <User {...props} />;
    case 'GROUP_CREATED': return <Home {...props} />;
    case 'MEMBER_JOINED_GROUP': return <UserPlus {...props} />;
    case 'MEMBER_LEFT_GROUP': return <UserMinus {...props} />;
    case 'EXPENSE_CREATED': return <CreditCard {...props} />;
    case 'EXPENSE_SPLIT_ASSIGNED': return <Scissors {...props} />;
    case 'SETTLEMENT_RECORDED': return <Check {...props} />;
    case 'IMPORT_STARTED': return <Upload {...props} />;
    case 'ANOMALY_DETECTED': return <AlertTriangle {...props} />;
    case 'ANOMALY_RESOLVED': return <Wrench {...props} />;
    case 'IMPORT_COMPLETED': return <CheckCircle {...props} />;
    case 'CURRENCY_CONVERSION_APPLIED': return <RefreshCw {...props} />;
    default: return <HelpCircle {...props} />;
  }
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [balances, setBalances] = useState<any>(null);
  const [groupId, setGroupId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const [s, groups] = await Promise.all([
        apiRequest<Summary>('/audit/dashboard-summary').catch(() => null),
        apiRequest<any[]>('/groups/').catch(() => []),
      ]);
      setSummary(s);
      if (groups && groups.length > 0) {
        setGroupId(groups[0].id);
        const bal = await apiRequest<any>(`/balances/group/${groups[0].id}`).catch(() => null);
        setBalances(bal);
      }
      setLoading(false);
    };
    init();
  }, []);

  const stats = [
    { label: 'Total Expenses', value: summary?.total_expenses ?? '—', icon: <CreditCard size={20} style={{ color: 'rgba(255,255,255,0.7)' }} />, color: '#ffffff' },
    { label: 'Settlements', value: summary?.total_settlements ?? '—', icon: <Check size={20} style={{ color: 'rgba(255,255,255,0.7)' }} />, color: '#ffffff' },
    { label: 'Pending Anomalies', value: summary?.pending_anomalies ?? '—', icon: <AlertTriangle size={20} style={{ color: 'rgba(255,255,255,0.7)' }} />, color: '#ffffff' },
    { label: 'Event Store', value: summary?.total_events ?? '—', icon: <Database size={20} style={{ color: 'rgba(255,255,255,0.7)' }} />, color: '#ffffff' },
  ];

  if (loading) return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[1, 2, 3, 4].map(i => <div key={i} className="stat-card shimmer" style={{ height: 100 }} />)}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 32 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.03em' }}>Dashboard</h1>
        <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>
          {summary?.total_groups ?? 0} group{(summary?.total_groups ?? 0) !== 1 ? 's' : ''} · {summary?.total_users ?? 0} members
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <div key={s.label} className="stat-card animate-fade-in-up" style={{ animationDelay: `${i * 80}ms` }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.5)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{s.label}</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</p>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}>
                {s.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
            <Scale size={18} style={{ color: 'rgba(255,255,255,0.6)' }} /> Who Owes Whom
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)', marginBottom: 20 }}>Current settlement summary</p>
          {balances?.who_owes_whom?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {balances.who_owes_whom.map((t: any, i: number) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                      {t.from_user?.charAt(0)}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{t.from_user}</span>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>→ owes →</span>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#ffffff' }}>
                      {t.to_user?.charAt(0)}
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 500 }}>{t.to_user}</span>
                  </div>
                  <span style={{ fontWeight: 700, color: '#ffffff', fontSize: 15 }}>{formatINR(t.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(241,245,249,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Sparkles size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p style={{ fontSize: 14 }}>{groupId ? 'All settled up!' : 'No group found — seed the database first'}</p>
            </div>
          )}
        </div>

        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, letterSpacing: '-0.01em' }}>
            <Activity size={18} style={{ color: 'rgba(255,255,255,0.6)' }} /> Recent Events
          </h2>
          <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)', marginBottom: 20 }}>Latest activity in the event store</p>
          {summary?.recent_events?.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {summary.recent_events.map((ev, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, paddingBottom: 16, position: 'relative' }}>
                  {i < summary.recent_events.length - 1 && (
                    <div style={{ position: 'absolute', left: 15, top: 28, bottom: 0, width: 1, background: 'rgba(255,255,255,0.06)' }} />
                  )}
                  <div style={{
                    width: 30, height: 30, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <EventIcon type={ev.event_type} />
                  </div>
                  <div style={{ paddingTop: 4 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>
                      {ev.event_type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())}
                    </p>
                    <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)' }}>{timeAgo(ev.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'rgba(241,245,249,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
                <Inbox size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
              </div>
              <p style={{ fontSize: 14 }}>No events yet. Import CSV to get started.</p>
            </div>
          )}
        </div>
      </div>

      {(summary?.pending_anomalies ?? 0) > 0 && (
        <div style={{
          marginTop: 24, padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <AlertTriangle size={20} style={{ color: '#eab308' }} />
            <div>
              <p style={{ fontWeight: 600, color: '#ffffff', fontSize: 14 }}>{summary?.pending_anomalies} anomalies need review</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Review and approve or reject them before committing the import</p>
            </div>
          </div>
          <a href="/anomalies" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#ffffff', padding: '8px 16px', borderRadius: 8, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
            Review Now →
          </a>
        </div>
      )}
    </div>
  );
}
