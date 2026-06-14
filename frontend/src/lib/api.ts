const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function apiRequest<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData
): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}



export function formatINR(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}



export const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'badge-critical',
  HIGH: 'badge-high',
  MEDIUM: 'badge-medium',
  LOW: 'badge-low',
};

export const ANOMALY_COLORS: Record<string, string> = {
  DUPLICATE_EXPENSE: 'badge-high',
  NEGATIVE_AMOUNT: 'badge-medium',
  INVALID_DATE: 'badge-critical',
  UNKNOWN_MEMBER: 'badge-critical',
  SETTLEMENT_AS_EXPENSE: 'badge-purple',
  CURRENCY_MISMATCH: 'badge-low',
  MEMBER_NOT_ACTIVE: 'badge-high',
  EMPTY_DESCRIPTION: 'badge-low',
  SPLIT_MISMATCH: 'badge-critical',
  CONFLICTING_DUPLICATES: 'badge-high',
  ZERO_AMOUNT: 'badge-medium',
  MISSING_PAYER: 'badge-critical',
  AMOUNT_FORMAT: 'badge-medium',
  NONSTANDARD_SPLIT_TYPE: 'badge-low',
  MISSING_CURRENCY: 'badge-high',
  NAME_CASE_MISMATCH: 'badge-low',
};

export const EVENT_ICONS: Record<string, string> = {
  USER_REGISTERED: 'U',
  GROUP_CREATED: 'G',
  MEMBER_JOINED_GROUP: '+',
  MEMBER_LEFT_GROUP: '-',
  EXPENSE_CREATED: 'E',
  EXPENSE_SPLIT_ASSIGNED: 'S',
  SETTLEMENT_RECORDED: 'S',
  IMPORT_STARTED: 'I',
  ANOMALY_DETECTED: 'A',
  ANOMALY_RESOLVED: 'R',
  IMPORT_COMPLETED: 'C',
  CURRENCY_CONVERSION_APPLIED: 'X',
};
