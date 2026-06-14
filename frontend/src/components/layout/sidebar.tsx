'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import {
  LayoutDashboard,
  Users,
  Receipt,
  ArrowLeftRight,
  Upload,
  AlertTriangle,
  Scale,
  History,
  FileText,
  LogOut,
  Zap,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  anomalyBadge?: boolean;
}

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/groups', label: 'Groups', icon: Users },
  { href: '/expenses', label: 'Expenses', icon: Receipt },
  { href: '/settlements', label: 'Settlements', icon: ArrowLeftRight },
  { href: '/import', label: 'Import CSV', icon: Upload, anomalyBadge: true },
  { href: '/anomalies', label: 'Anomaly Review', icon: AlertTriangle, anomalyBadge: true },
  { href: '/balances', label: 'Balances', icon: Scale },
  { href: '/audit', label: 'Audit History', icon: History },
  { href: '/reports', label: 'Import Reports', icon: FileText },
];

export default function Sidebar({ pendingAnomalies = 0 }: { pendingAnomalies?: number }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside
      style={{
        width: 260,
        minHeight: '100vh',
        background: 'rgba(10,10,15,0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 12px',
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
        overflowY: 'auto',
      }}
    >
      {}
      <div style={{ marginBottom: 32, paddingLeft: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(255,255,255,0.05)',
            }}
          >
            <Zap size={18} color="white" />
          </div>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: '#f1f5f9',
                letterSpacing: '-0.02em',
              }}
            >
              SplitWise
            </div>
            <div style={{ fontSize: 10, color: 'rgba(241,245,249,0.35)', marginTop: -1 }}>
              Event-Sourced
            </div>
          </div>
        </div>
      </div>

      {}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + '/');
          const showBadge = item.anomalyBadge && pendingAnomalies > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="sidebar-link"
              style={
                isActive
                  ? {
                      background: 'rgba(255,255,255,0.06)',
                      color: '#ffffff',
                      borderColor: 'rgba(255,255,255,0.12)',
                    }
                  : {}
              }
            >
              <item.icon size={17} />
              <span style={{ flex: 1 }}>{item.label}</span>
              {showBadge && (
                <span
                  style={{
                    background: '#ffffff',
                    color: 'black',
                    borderRadius: 999,
                    padding: '1px 7px',
                    fontSize: 10,
                    fontWeight: 700,
                    minWidth: 20,
                    textAlign: 'center',
                  }}
                >
                  {pendingAnomalies}
                </span>
              )}
              {isActive && (
                <ChevronRight size={13} style={{ opacity: 0.5 }} />
              )}
            </Link>
          );
        })}
      </nav>

      {}
      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
            paddingLeft: 8,
          }}
        >
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 700,
              color: 'white',
              flexShrink: 0,
            }}
          >
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: '#f1f5f9',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.name || 'User'}
            </div>
            <div
              style={{
                fontSize: 11,
                color: 'rgba(241,245,249,0.4)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.email || ''}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="sidebar-link"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          <LogOut size={16} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
