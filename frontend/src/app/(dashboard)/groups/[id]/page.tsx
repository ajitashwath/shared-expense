'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiRequest, formatDate, formatDateTime } from '@/lib/api';
import { Scale, Plus, History, Coins, Users } from 'lucide-react';

interface Member {
  user_id: string;
  user_name: string;
  joined_at: string;
  left_at: string | null;
  is_active: boolean;
}

interface Group {
  id: string;
  name: string;
  description: string;
  membership_policy: string;
  is_active: boolean;
  created_at: string;
  members: Member[];
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  paid_by_name: string;
  expense_date: string;
  is_settlement: boolean;
}

export default function GroupDetailPage() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;

  const [group, setGroup] = useState<Group | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  
  const [showAddMember, setShowAddMember] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [joinedAt, setJoinedAt] = useState(new Date().toISOString().split('T')[0]);
  const [addingError, setAddingError] = useState('');
  const [adding, setAdding] = useState(false);

  const [showRemoveMember, setShowRemoveMember] = useState<Member | null>(null);
  const [leftAt, setLeftAt] = useState(new Date().toISOString().split('T')[0]);
  const [removingError, setRemovingError] = useState('');
  const [removing, setRemoving] = useState(false);

  const fetchData = async () => {
    try {
      const [gData, expData, usersData] = await Promise.all([
        apiRequest<Group>(`/groups/${groupId}`),
        apiRequest<Expense[]>(`/expenses/?group_id=${groupId}`),
        apiRequest<User[]>('/auth/users'),
      ]);
      setGroup(gData);
      setExpenses(expData);
      setAllUsers(usersData);
    } catch (err) {
      console.error(err);
      router.push('/groups');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (groupId) fetchData();
  }, [groupId]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingError('');
    setAdding(true);
    try {
      await apiRequest(`/groups/${groupId}/members`, {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUserId,
          joined_at: new Date(joinedAt).toISOString(),
        }),
      });
      setShowAddMember(false);
      setSelectedUserId('');
      fetchData();
    } catch (err: any) {
      setAddingError(err.message || 'Failed to add member');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRemoveMember) return;
    setRemovingError('');
    setRemoving(true);
    try {
      await apiRequest(`/groups/${groupId}/members/${showRemoveMember.user_id}`, {
        method: 'DELETE',
        body: JSON.stringify({
          user_id: showRemoveMember.user_id,
          left_at: new Date(leftAt).toISOString(),
        }),
      });
      setShowRemoveMember(null);
      fetchData();
    } catch (err: any) {
      setRemovingError(err.message || 'Failed to remove member');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return <div style={{ padding: 32 }}><div className="shimmer" style={{ height: 400, borderRadius: 16 }} /></div>;
  if (!group) return <div style={{ padding: 32 }}>Group not found.</div>;

  
  const nonGroupUsers = allUsers.filter(
    u => !group.members.some(m => m.user_id === u.id && m.is_active)
  );

  return (
    <div style={{ padding: 32 }}>
      {}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <button onClick={() => router.push('/groups')} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, marginBottom: 16 }}>
            ← Back to Groups
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 28, fontWeight: 800 }}>{group.name}</h1>
            <span className={`badge ${group.membership_policy === 'STRICT' ? 'badge-critical' : 'badge-teal'}`}>
              {group.membership_policy} Policy
            </span>
          </div>
          <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14, marginTop: 6 }}>
            {group.description || 'No description provided.'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => router.push(`/balances?group_id=${group.id}`)} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Scale size={14} />
            <span>Balances</span>
          </button>
          <button onClick={() => setShowAddMember(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={14} />
            <span>Add Member</span>
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
        {}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {}
          <div className="glass" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <History size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
              <span>Temporal Membership Timeline</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {group.members.map((m, idx) => (
                <div key={idx} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderRadius: 10,
                  background: m.is_active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)',
                  border: m.is_active ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(255,255,255,0.06)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: m.is_active ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                      color: m.is_active ? '#ffffff' : 'rgba(241,245,249,0.4)',
                    }}>
                      {m.user_name.charAt(0)}
                    </div>
                    <div>
                      <p style={{ fontSize: 14, fontWeight: 600 }}>{m.user_name}</p>
                      <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)' }}>
                        Joined: {formatDate(m.joined_at)} {m.left_at ? `· Left: ${formatDate(m.left_at)}` : ''}
                      </p>
                    </div>
                  </div>
                  <div>
                    {m.is_active ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span className="badge badge-success">Active</span>
                        <button onClick={() => setShowRemoveMember(m)} className="btn-danger" style={{ padding: '4px 8px', fontSize: 11 }}>
                          Remove
                        </button>
                      </div>
                    ) : (
                      <span className="badge badge-low">Inactive</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {}
          <div className="glass" style={{ padding: 24 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Coins size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
              <span>Recent Expenses & Settlements</span>
            </h2>
            {expenses.length === 0 ? (
              <p style={{ color: 'rgba(241,245,249,0.3)', textAlign: 'center', padding: '24px 0' }}>
                No expenses or settlements recorded in this group.
              </p>
            ) : (
              <table className="table-dark">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Paid By</th>
                    <th>Amount</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: 'rgba(241,245,249,0.4)', fontSize: 12 }}>{formatDate(e.expense_date)}</td>
                      <td style={{ fontWeight: 600 }}>{e.description}</td>
                      <td>{e.paid_by_name}</td>
                      <td style={{ fontWeight: 700, color: '#ffffff' }}>
                        ₹{e.amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <span className={`badge ${e.is_settlement ? 'badge-teal' : 'badge-purple'}`}>
                          {e.is_settlement ? 'Settlement' : 'Expense'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {}
        <div>
          <div className="glass" style={{ padding: 24, position: 'sticky', top: 24 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Users size={16} style={{ color: 'rgba(255,255,255,0.6)' }} />
              <span>Active Roster</span>
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {group.members.filter(m => m.is_active).map(m => (
                <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.08)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#ffffff'
                  }}>
                    {m.user_name.charAt(0)}
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{m.user_name}</span>
                </div>
              ))}
              {group.members.filter(m => m.is_active).length === 0 && (
                <p style={{ color: 'rgba(241,245,249,0.3)', fontSize: 13 }}>No active members.</p>
              )}
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 20, paddingTop: 16 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: 'rgba(241,245,249,0.5)', marginBottom: 8 }}>Policy Guidelines</h3>
              <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)', lineHeight: 1.4 }}>
                {group.membership_policy === 'STRICT'
                  ? 'STRICT: Expenses on any date can only split between users whose membership timeline covers that date. Non-members are auto-excluded from calculations.'
                  : 'INCLUSIVE: Anyone can split, but mismatched dates will create high/low warnings on ingestion.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {}
      {showAddMember && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-strong animate-fade-in-up" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Add Member</h2>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13, marginBottom: 24 }}>Add a flatmate to this group's membership timeline</p>
            {addingError && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ffffff', fontSize: 13 }}>
                {addingError}
              </div>
            )}
            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Select User</label>
                <select required className="input-dark" value={selectedUserId} onChange={e => setSelectedUserId(e.target.value)}>
                  <option value="">-- Choose User --</option>
                  {nonGroupUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Joined Date</label>
                <input type="date" required className="input-dark" value={joinedAt} onChange={e => setJoinedAt(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowAddMember(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={adding || !selectedUserId} style={{ flex: 1 }}>
                  {adding ? 'Adding…' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Remove Member Modal */}
      {showRemoveMember && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-strong animate-fade-in-up" style={{ width: '100%', maxWidth: 440, padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Remove Member</h2>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13, marginBottom: 24 }}>
              Set leave date for <strong>{showRemoveMember.user_name}</strong>
            </p>
            {removingError && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ffffff', fontSize: 13 }}>
                {removingError}
              </div>
            )}
            <form onSubmit={handleRemoveMember} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Left Date</label>
                <input type="date" required className="input-dark" value={leftAt} onChange={e => setLeftAt(e.target.value)} />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowRemoveMember(null)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-danger" disabled={removing} style={{ flex: 1 }}>
                  {removing ? 'Removing…' : 'Remove Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
