'use client';
import { useEffect, useState } from 'react';
import { apiRequest, formatDate, formatINR } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeftRight, Plus } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  members: Array<{
    user_id: string;
    user_name: string;
  }>;
}

interface Settlement {
  id: string;
  group_id: string;
  description: string;
  from_user_id: string;
  from_user_name: string;
  to_user_id: string;
  to_user_name: string;
  amount: number;
  date: string;
}

export default function SettlementsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [formData, setFormData] = useState({
    group_id: '',
    from_user_id: '',
    to_user_id: '',
    amount: '',
    settlement_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadInitialData = async () => {
    try {
      const gList = await apiRequest<Group[]>('/groups/');
      setGroups(gList);
      if (gList.length > 0 && !formData.group_id) {
        setFormData(p => ({ ...p, group_id: gList[0].id }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadSettlements = async () => {
    setLoading(true);
    try {
      const path = selectedGroupFilter === 'ALL' ? '/settlements/' : `/settlements/?group_id=${selectedGroupFilter}`;
      const data = await apiRequest<Settlement[]>(path);
      setSettlements(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadSettlements();
  }, [selectedGroupFilter]);

  
  useEffect(() => {
    if (!formData.group_id) return;
    const selectedGroupObj = groups.find(g => g.id === formData.group_id);
    if (selectedGroupObj) {
      const members = selectedGroupObj.members || [];
      setGroupMembers(members);
      if (members.length > 0) {
        
        const defaultFrom = user ? (members.find(m => m.user_id === user.id)?.user_id || members[0].user_id) : members[0].user_id;
        const defaultTo = members.find(m => m.user_id !== defaultFrom)?.user_id || '';
        setFormData(p => ({
          ...p,
          from_user_id: defaultFrom,
          to_user_id: defaultTo,
        }));
      }
    }
  }, [formData.group_id, groups]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amt = parseFloat(formData.amount);
    if (isNaN(amt) || amt <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    if (formData.from_user_id === formData.to_user_id) {
      setError('A member cannot settle debt with themselves.');
      return;
    }

    setSubmitting(true);
    try {
      await apiRequest('/settlements/', {
        method: 'POST',
        body: JSON.stringify({
          group_id: formData.group_id,
          from_user_id: formData.from_user_id,
          to_user_id: formData.to_user_id,
          amount: amt,
          settlement_date: formData.settlement_date,
          notes: formData.notes || null,
        }),
      });
      setShowRecordModal(false);
      setFormData(prev => ({
        ...prev,
        amount: '',
        notes: '',
      }));
      loadSettlements();
    } catch (err: any) {
      setError(err.message || 'Failed to record settlement');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
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
            <ArrowLeftRight size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Settlements</h1>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>
              Record payments to settle outstanding debts
            </p>
          </div>
        </div>
        <button onClick={() => setShowRecordModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} />
          <span>Record Settlement</span>
        </button>
      </div>

      {}
      <div className="glass" style={{ padding: '16px 20px', marginBottom: 24, display: 'flex', gap: 16, alignItems: 'center' }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.6)' }}>Filter Group:</label>
        <select className="input-dark" style={{ maxWidth: 240 }} value={selectedGroupFilter} onChange={e => setSelectedGroupFilter(e.target.value)}>
          <option value="ALL">All Groups</option>
          {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      {}
      {loading ? (
        <div className="shimmer" style={{ height: 250, borderRadius: 16 }} />
      ) : settlements.length === 0 ? (
        <div className="glass" style={{ padding: 48, textAlign: 'center', color: 'rgba(241,245,249,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <ArrowLeftRight size={48} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
          <h3>No settlements found</h3>
          <p style={{ fontSize: 14, margin: '8px 0 24px' }}>All settled up! No transactions to display.</p>
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="table-dark">
            <thead>
              <tr>
                <th>Date</th>
                <th>Group</th>
                <th>Sender</th>
                <th>Recipient</th>
                <th>Description</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map(s => {
                const groupName = groups.find(g => g.id === s.group_id)?.name || 'Unknown';
                return (
                  <tr key={s.id}>
                    <td style={{ color: 'rgba(241,245,249,0.4)', fontSize: 12 }}>
                      {formatDate(s.date)}
                    </td>
                    <td style={{ fontSize: 13, color: 'rgba(241,245,249,0.7)' }}>{groupName}</td>
                    <td style={{ fontWeight: 500 }}>{s.from_user_name}</td>
                    <td style={{ fontWeight: 500 }}>{s.to_user_name}</td>
                    <td style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)' }}>{s.description}</td>
                    <td style={{ fontWeight: 700, fontSize: 15, color: '#ffffff' }}>
                      {formatINR(s.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {}
      {showRecordModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-strong animate-fade-in-up" style={{ width: '100%', maxWidth: 460, padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Record Settlement</h2>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13, marginBottom: 24 }}>Document a direct payment between flatmates</p>

            {error && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ffffff', fontSize: 13 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Group</label>
                <select required className="input-dark" value={formData.group_id} onChange={e => setFormData(p => ({ ...p, group_id: e.target.value }))}>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Who Paid (Sender)</label>
                <select required className="input-dark" value={formData.from_user_id} onChange={e => setFormData(p => ({ ...p, from_user_id: e.target.value }))}>
                  {groupMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                  ))}
                </select>
              </div>

              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Who Received (Recipient)</label>
                <select required className="input-dark" value={formData.to_user_id} onChange={e => setFormData(p => ({ ...p, to_user_id: e.target.value }))}>
                  {groupMembers.map(m => (
                    <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                  ))}
                </select>
              </div>

              {}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Amount (₹)</label>
                  <input type="number" step="any" required className="input-dark" placeholder="0.00" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Date</label>
                  <input type="date" required className="input-dark" value={formData.settlement_date} onChange={e => setFormData(p => ({ ...p, settlement_date: e.target.value }))} />
                </div>
              </div>

              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Notes (optional)</label>
                <input type="text" className="input-dark" placeholder="e.g. Paid via GPay" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowRecordModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? 'Recording…' : 'Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
