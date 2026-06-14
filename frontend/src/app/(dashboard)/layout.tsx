'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { apiRequest } from '@/lib/api';
import {
  LayoutDashboard,
  Users,
  Receipt,
  ArrowLeftRight,
  Scale,
  Upload,
  AlertTriangle,
  History,
  FileText,
  Zap,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const NAV = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/groups', icon: Users, label: 'Groups' },
  { href: '/expenses', icon: Receipt, label: 'Expenses' },
  { href: '/settlements', icon: ArrowLeftRight, label: 'Settlements' },
  { href: '/balances', icon: Scale, label: 'Balances' },
  { href: '/import', icon: Upload, label: 'Import CSV' },
  { href: '/anomalies', icon: AlertTriangle, label: 'Anomalies', badge: true },
  { href: '/audit', icon: History, label: 'Audit Trail' },
  { href: '/reports', icon: FileText, label: 'Reports' },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [pendingAnomalies, setPendingAnomalies] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) { router.push('/login'); return; }
    
    apiRequest<any>('/audit/dashboard-summary').then(d => {
      setPendingAnomalies(d.pending_anomalies || 0);
    }).catch(() => {});
  }, [user, isLoading]);

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#ffffff', animation: 'spin-slow 0.8s linear infinite' }} />
    </div>
  );

  const sidebarW = collapsed ? 64 : 240;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f' }}>
      <aside style={{
        width: sidebarW, minHeight: '100vh', flexShrink: 0,
        background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex', flexDirection: 'column',
        transition: 'width 0.25s ease', overflow: 'hidden',
        position: 'sticky', top: 0, height: '100vh',
      }}>
        <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={18} style={{ color: '#ffffff' }} />
          </div>
          {!collapsed && <span style={{ fontWeight: 800, fontSize: 16, color: '#ffffff', letterSpacing: '-0.03em' }}>FlatMates</span>}
          <button onClick={() => setCollapsed(c => !c)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, flexShrink: 0 }}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav style={{ flex: 1, padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className={`sidebar-link ${active ? 'active' : ''}`}
                style={{ justifyContent: collapsed ? 'center' : 'flex-start', padding: collapsed ? '10px' : '10px 16px', display: 'flex', alignItems: 'center', gap: collapsed ? 0 : 12, position: 'relative' }}>
                <item.icon size={16} style={{ flexShrink: 0, color: active ? '#ffffff' : 'rgba(255,255,255,0.5)' }} />
                {!collapsed && <span style={{ fontSize: 13.5, fontWeight: 500 }}>{item.label}</span>}
                {item.badge && pendingAnomalies > 0 && (
                  <span style={{
                    position: 'absolute', top: 6, right: collapsed ? 6 : 8,
                    background: '#ffffff', borderRadius: '999px', fontSize: 10, fontWeight: 700,
                    padding: '1px 5px', color: '#000000', lineHeight: 1.4,
                  }}>{pendingAnomalies}</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ padding: collapsed ? '8px' : '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>
              {user?.name?.charAt(0) || '?'}
            </div>
            {!collapsed && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user?.name}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', textTransform: 'capitalize' }}>{user?.role?.toLowerCase()}</div>
              </div>
            )}
            {!collapsed && (
              <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgba(241,245,249,0.35)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4 }} title="Logout">
                <LogOut size={14} />
              </button>
            )}
          </div>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto' }}>
        {children}
      </main>
    </div>
  );
}
