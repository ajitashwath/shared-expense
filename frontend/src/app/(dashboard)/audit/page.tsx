'use client';
import { useEffect, useState } from 'react';
import { apiRequest, formatDateTime, SEVERITY_STYLES } from '@/lib/api';
import {
  History,
  Inbox,
  User,
  Home,
  UserPlus,
  UserMinus,
  CreditCard,
  Scissors,
  Check,
  Upload,
  AlertTriangle,
  Wrench,
  CheckCircle,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

function EventIcon({ type }: { type: string }) {
  const props = { size: 10, style: { color: 'rgba(255,255,255,0.7)' } };
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

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const load = async (offset: number, type?: string) => {
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
    if (type) params.set('event_type', type);
    const data = await apiRequest<any[]>(`/audit/events?${params}`).catch(() => []);
    const count = await apiRequest<any>('/audit/events/count').catch(() => ({ total_events: 0 }));
    setEvents(data);
    setTotal(count.total_events);
  };

  useEffect(() => { load(0); }, []);

  const EVENT_TYPES = [
    '', 'EXPENSE_CREATED', 'SETTLEMENT_RECORDED', 'ANOMALY_DETECTED', 'ANOMALY_RESOLVED',
    'MEMBER_JOINED_GROUP', 'MEMBER_LEFT_GROUP', 'IMPORT_COMPLETED', 'CURRENCY_CONVERSION_APPLIED',
  ];

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
            <History size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Audit Trail</h1>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>
              Append-only event store · <strong>{total}</strong> total events
            </p>
          </div>
        </div>
        <select className="input-dark" style={{ maxWidth: 280 }} value={filter}
          onChange={e => { setFilter(e.target.value); load(0, e.target.value || undefined); }}>
          <option value="">All event types</option>
          {EVENT_TYPES.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{ position: 'relative', paddingLeft: 40 }}>
        <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: 'rgba(255,255,255,0.06)' }} />

        {events.length === 0 ? (
          <div className="glass" style={{ padding: 48, textAlign: 'center', color: 'rgba(241,245,249,0.4)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Inbox size={32} style={{ color: 'rgba(255,255,255,0.2)' }} />
            </div>
            <p style={{ fontSize: 14 }}>No events yet</p>
          </div>
        ) : events.map((ev, i) => (
          <div key={ev.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 20}ms`, display: 'flex', gap: 0, marginBottom: 16 }}>
            <div style={{
              position: 'absolute', left: 6, width: 20, height: 20, borderRadius: '50%',
              background: '#09090b', border: '2px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginTop: 11, zIndex: 1
            }}>
              <EventIcon type={ev.event_type} />
            </div>

            <div className="glass" style={{ flex: 1, padding: '14px 18px', marginLeft: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#f1f5f9' }}>
                  {ev.event_type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase())}
                </span>
                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)' }}>
                  {ev.aggregate_type}
                </span>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(241,245,249,0.35)' }}>
                  {formatDateTime(ev.created_at)}
                </span>
              </div>
              <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'rgba(241,245,249,0.35)', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                {typeof ev.payload === 'object' ? JSON.stringify(ev.payload).slice(0, 180) : String(ev.payload)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24 }}>
        <button className="btn-secondary" disabled={page === 0} onClick={() => { setPage(p => p - 1); load((page - 1) * PAGE_SIZE, filter || undefined); }} style={{ fontSize: 13, padding: '8px 16px' }}>← Prev</button>
        <span style={{ padding: '8px 16px', fontSize: 13, color: 'rgba(241,245,249,0.5)' }}>
          Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
        </span>
        <button className="btn-secondary" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => { setPage(p => p + 1); load((page + 1) * PAGE_SIZE, filter || undefined); }} style={{ fontSize: 13, padding: '8px 16px' }}>Next →</button>
      </div>
    </div>
  );
}
