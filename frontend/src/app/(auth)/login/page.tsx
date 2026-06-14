'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';

import { Zap } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || 'Invalid credentials');
      }
      const data = await res.json();
      const me = await apiRequest('/auth/me', {
        headers: { Authorization: `Bearer ${data.access_token}` }
      }) as any;
      login(data.access_token, me);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Login failed');
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
          <div style={{
            width: 72, height: 72, borderRadius: '20px', margin: '0 auto 16px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 40px rgba(255,255,255,0.05)',
          }}>
            <Zap size={32} style={{ color: 'white' }} />
          </div>
          <h1 className="gradient-text" style={{ fontSize: 28, fontWeight: 800, marginBottom: 6, letterSpacing: '-0.03em' }}>FlatMates</h1>
          <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>Event-sourced shared expense tracking</p>
        </div>
        <div className="glass-strong" style={{ padding: 40 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.01em' }}>Welcome back</h2>
          <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13, marginBottom: 28 }}>Sign in to your account</p>
          {error && (
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ffffff', fontSize: 13 }}>
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Email</label>
              <input type="email" required autoComplete="email" className="input-dark" placeholder="aisha@flat.com" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Password</label>
              <input type="password" required className="input-dark" placeholder="••••••••" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: 8, padding: '14px', fontSize: 15 }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
          </form>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 28, paddingTop: 20, textAlign: 'center' }}>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13 }}>
              No account?{' '}<Link href="/register" style={{ color: '#ffffff', textDecoration: 'none', fontWeight: 600 }}>Register here</Link>
            </p>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '12px 16px', marginTop: 16 }}>
            <p style={{ fontSize: 12, color: '#ffffff', fontWeight: 600, marginBottom: 6 }}>Demo accounts (password: password123)</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {['aisha@flat.com (Admin)', 'rohan@flat.com', 'priya@flat.com', 'meera@flat.com', 'sam@flat.com', 'dev@flat.com'].map(u => (
                <p key={u} style={{ fontSize: 11, color: 'rgba(241,245,249,0.5)', fontFamily: 'monospace' }}>{u}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
