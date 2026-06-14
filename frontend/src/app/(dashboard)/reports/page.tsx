'use client';
import { useEffect, useState } from 'react';
import { apiRequest, formatINR } from '@/lib/api';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart as RechartsPieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { BarChart3, TrendingUp, Home, CreditCard, PieChart } from 'lucide-react';

interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  paid_by_name: string;
  expense_date: string;
}

interface Group {
  id: string;
  name: string;
}

const COLORS = ['#ffffff', '#e4e4e7', '#a1a1aa', '#71717a', '#3f3f46', '#27272a'];

export default function ReportsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [expList, gList] = await Promise.all([
          apiRequest<Expense[]>('/expenses/'),
          apiRequest<Group[]>('/groups/'),
        ]);
        
        const actualExpenses = (expList as any[]).filter(e => !e.is_settlement);
        setExpenses(actualExpenses);
        setGroups(gList);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div style={{ padding: 32 }}><div className="shimmer" style={{ height: 400, borderRadius: 16 }} /></div>;

  if (expenses.length === 0) {
    return (
      <div style={{ padding: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
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
            <BarChart3 size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Reports & Insights</h1>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14, marginBottom: 0 }}>
              Financial breakdown and metrics
            </p>
          </div>
        </div>
        <div className="glass" style={{ padding: 48, textAlign: 'center', color: 'rgba(241,245,249,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <BarChart3 size={48} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
          <h3>No expense data to analyze</h3>
          <p style={{ fontSize: 14, margin: '8px 0 24px' }}>Add some expenses to generate charts and insights.</p>
        </div>
      </div>
    );
  }

  
  const spendingByGroup = groups.map(g => {
    const total = expenses
      .filter(e => e.group_id === g.id)
      .reduce((sum, e) => sum + e.amount, 0);
    return { name: g.name, amount: total };
  }).filter(item => item.amount > 0);

  
  const payersMap: Record<string, number> = {};
  expenses.forEach(e => {
    payersMap[e.paid_by_name] = (payersMap[e.paid_by_name] || 0) + e.amount;
  });
  const spendingByPayer = Object.keys(payersMap).map(name => ({
    name,
    amount: payersMap[name],
  }));

  
  
  const sortedExpenses = [...expenses].sort(
    (a, b) => new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
  );

  const timelineMap: Record<string, number> = {};
  sortedExpenses.forEach(e => {
    
    const date = new Date(e.expense_date);
    const label = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    timelineMap[label] = (timelineMap[label] || 0) + e.amount;
  });
  const spendingTimeline = Object.keys(timelineMap).map(label => ({
    date: label,
    amount: timelineMap[label],
  }));

  const totalExpenseVolume = expenses.reduce((sum, e) => sum + e.amount, 0);
  const averageExpenseAmount = totalExpenseVolume / expenses.length;

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
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
          <BarChart3 size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
        </div>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Reports & Insights</h1>
          <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>
            Visual analysis of shared flatmate expenses
          </p>
        </div>
      </div>

      {}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <div className="stat-card">
          <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.5)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Total Spent</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#ffffff' }}>{formatINR(totalExpenseVolume)}</p>
          <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginTop: 4 }}>Across all groups</p>
        </div>
        <div className="stat-card">
          <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.5)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Expense Count</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#fafafa' }}>{expenses.length}</p>
          <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginTop: 4 }}>Transactions recorded</p>
        </div>
        <div className="stat-card">
          <p style={{ fontSize: 12, color: 'rgba(241,245,249,0.5)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Average Expense</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: '#ffffff' }}>{formatINR(averageExpenseAmount)}</p>
          <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginTop: 4 }}>Per transaction</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {}
        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <TrendingUp size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
            <span>Spending Over Time</span>
          </h2>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={spendingTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" stroke="rgba(241,245,249,0.4)" fontSize={11} />
                <YAxis stroke="rgba(241,245,249,0.4)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                  labelStyle={{ color: 'rgba(241,245,249,0.7)', fontWeight: 600 }}
                />
                <Line type="monotone" dataKey="amount" stroke="#ffffff" strokeWidth={3} dot={{ fill: '#ffffff', r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {}
        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Home size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
            <span>Spending by Group</span>
          </h2>
          {spendingByGroup.length === 0 ? (
            <div style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(241,245,249,0.3)' }}>No data available</div>
          ) : (
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <BarChart data={spendingByGroup}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="name" stroke="rgba(241,245,249,0.4)" fontSize={11} />
                  <YAxis stroke="rgba(241,245,249,0.4)" fontSize={11} />
                  <Tooltip
                    contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                  />
                  <Bar dataKey="amount" fill="#ffffff" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 24 }}>
        {}
        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
            <span>Who Paid What?</span>
          </h2>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={spendingByPayer} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis type="number" stroke="rgba(241,245,249,0.4)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="rgba(241,245,249,0.4)" fontSize={11} />
                <Tooltip
                  contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                />
                <Bar dataKey="amount" fill="#ffffff" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {}
        <div className="glass" style={{ padding: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <PieChart size={18} style={{ color: 'rgba(255,255,255,0.6)' }} />
            <span>Share of Total Outlays</span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <RechartsPieChart>
                <Pie
                  data={spendingByPayer}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="amount"
                >
                  {spendingByPayer.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#09090b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10 }}
                />
              </RechartsPieChart>
            </ResponsiveContainer>
            {}
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              {spendingByPayer.map((item, idx) => (
                <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[idx % COLORS.length] }} />
                  <span style={{ color: 'rgba(241,245,249,0.7)' }}>{item.name}:</span>
                  <strong style={{ color: '#f1f5f9' }}>{((item.amount / totalExpenseVolume) * 100).toFixed(0)}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
