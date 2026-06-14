'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiRequest } from '@/lib/api';

import { Sparkles } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'MEMBER' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await apiRequest('/auth/register', { method: 'POST', body: JSON.stringify(form) });
      router.push('/login?registered=true');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', background: '#09090b',
      backgroundImage: 'none',
    }}>
      <div className="animate-fade-in-up" style={{ width: '100%', maxWidth: 440 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ width: 72, height: 72, borderRadius: '20px', margin: '0 auto 16px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 40px rgba(255,255,255,0.05)' }}>
            <Sparkles size={32} style={{ color: 'white' }} />
          </div>
          <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.03em' }}>Join FlatMates</h1>
          <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>Create your account</p>
        </div>
        <div className="glass-strong" style={{ padding: 40 }}>
          {error && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ffffff', fontSize: 13 }}>{error}</div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[
              { label: 'Full Name', key: 'name', type: 'text', placeholder: 'Aisha Kapoor' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'aisha@flat.com' },
              { label: 'Password', key: 'password', type: 'password', placeholder: '••••••••' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{f.label}</label>
                <input type={f.type} required className="input-dark" placeholder={f.placeholder}
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Role</label>
              <select className="input-dark" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                <option value="MEMBER">Member</option>
                <option value="ADMIN">Admin</option>
              </select>
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8, padding: '14px', fontSize: 15 }}>
              {loading ? 'Creating account…' : 'Create Account →'}
            </button>
          </form>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 28, paddingTop: 20, textAlign: 'center' }}>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13 }}>
              Already have an account?{' '}<Link href="/login" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
