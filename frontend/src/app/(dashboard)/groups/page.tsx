'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiRequest, formatDate } from '@/lib/api';
import { Home, Plus, Users } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  description: string;
  membership_policy: string;
  is_active: boolean;
  created_at: string;
  members: Array<{
    user_id: string;
    user_name: string;
    joined_at: string;
    left_at: string | null;
    is_active: boolean;
  }>;
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', membership_policy: 'STRICT' });
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchGroups = async () => {
    try {
      const data = await apiRequest<Group[]>('/groups/');
      setGroups(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      const res = await apiRequest<any>('/groups/', {
        method: 'POST',
        body: JSON.stringify(newGroup),
      });
      setShowCreateModal(false);
      setNewGroup({ name: '', description: '', membership_policy: 'STRICT' });
      fetchGroups();
      
      router.push(`/groups/${res.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  if (loading) return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div className="shimmer" style={{ height: 40, width: 200, borderRadius: 8 }} />
        <div className="shimmer" style={{ height: 40, width: 120, borderRadius: 8 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {[1, 2, 3].map(i => (
          <div key={i} className="shimmer" style={{ height: 180, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  );

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
            <Home size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Groups</h1>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>
              Manage expense groups and membership policies
            </p>
          </div>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} />
          <span>Create Group</span>
        </button>
      </div>

      {groups.length === 0 ? (
        <div className="glass" style={{ padding: 48, textAlign: 'center', color: 'rgba(241,245,249,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Users size={48} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
          <h3>No groups found</h3>
          <p style={{ fontSize: 14, margin: '8px 0 24px' }}>Create a new group to start sharing expenses with friends.</p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">Create Group</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 20 }}>
          {groups.map((g, idx) => {
            const activeMembers = g.members.filter(m => m.is_active);
            return (
              <div key={g.id} className="stat-card animate-fade-in-up" style={{ animationDelay: `${idx * 60}ms`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{g.name}</h3>
                    <span className={`badge ${g.membership_policy === 'STRICT' ? 'badge-critical' : 'badge-teal'}`}>
                      {g.membership_policy}
                    </span>
                  </div>
                  <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13, marginBottom: 16, minHeight: 40 }}>
                    {g.description || 'No description provided.'}
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
                    {activeMembers.map(m => (
                      <span key={m.user_id} className="badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(241,245,249,0.7)', textTransform: 'none' }}>
                        {m.user_name}
                      </span>
                    ))}
                    {activeMembers.length === 0 && (
                      <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.3)' }}>No active members</span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, marginTop: 12 }}>
                  <span style={{ fontSize: 12, color: 'rgba(241,245,249,0.3)' }}>
                    Created {formatDate(g.created_at)}
                  </span>
                  <button onClick={() => router.push(`/groups/${g.id}`)} className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12 }}>
                    Manage Group →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="glass-strong animate-fade-in-up" style={{ width: '100%', maxWidth: 500, padding: 32 }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Create Group</h2>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13, marginBottom: 24 }}>Set up a new shared expense space</p>
            {error && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ffffff', fontSize: 13 }}>
                {error}
              </div>
            )}
            <form onSubmit={handleCreateGroup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Group Name</label>
                <input type="text" required className="input-dark" placeholder="e.g. Goa Trip 2026" value={newGroup.name} onChange={e => setNewGroup(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description</label>
                <textarea className="input-dark" style={{ minHeight: 80, resize: 'vertical' }} placeholder="e.g. Shared expenses for flatmates in Goa" value={newGroup.description} onChange={e => setNewGroup(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Membership Policy</label>
                <select className="input-dark" value={newGroup.membership_policy} onChange={e => setNewGroup(p => ({ ...p, membership_policy: e.target.value }))}>
                  <option value="STRICT">STRICT (Exclude inactive members from expenses outside their membership period)</option>
                  <option value="INCLUSIVE">INCLUSIVE (Allow additions but flag temporal mismatch as low-severity anomaly)</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={creating} style={{ flex: 1 }}>
                  {creating ? 'Creating…' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
