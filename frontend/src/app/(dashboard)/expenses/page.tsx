'use client';
import { useEffect, useState } from 'react';
import { apiRequest, formatDate, formatINR } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { Coins, Plus, Receipt } from 'lucide-react';

interface Group {
  id: string;
  name: string;
  membership_policy: string;
  members: Array<{
    user_id: string;
    user_name: string;
    joined_at: string;
    left_at: string | null;
    is_active: boolean;
  }>;
}

interface Expense {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  original_amount: number | null;
  original_currency: string | null;
  conversion_rate: number | null;
  paid_by_id: string;
  paid_by_name: string;
  split_type: string;
  expense_date: string;
  is_settlement: boolean;
  splits: Array<{
    user_id: string;
    user_name?: string;
    amount: number;
    percentage: number | null;
    shares: number | null;
  }>;
}

export default function ExpensesPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState('ALL');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [formData, setFormData] = useState({
    group_id: '',
    description: '',
    amount: '',
    currency: 'INR',
    paid_by_id: user?.id || '',
    split_type: 'EQUAL',
    expense_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  
  
  const [splitSelections, setSplitSelections] = useState<Record<string, {
    checked: boolean;
    amount: string;
    percentage: string;
    shares: string;
  }>>({});

  const [formError, setFormError] = useState('');
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

  const loadExpenses = async () => {
    setLoading(true);
    try {
      const path = selectedGroupFilter === 'ALL' ? '/expenses/' : `/expenses/?group_id=${selectedGroupFilter}`;
      const data = await apiRequest<Expense[]>(path);
      
      setExpenses(data.filter(e => !e.is_settlement));
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
    loadExpenses();
  }, [selectedGroupFilter]);

  
  useEffect(() => {
    if (!formData.group_id) return;
    const selectedGroupObj = groups.find(g => g.id === formData.group_id);
    if (selectedGroupObj) {
      
      const members = selectedGroupObj.members || [];
      setGroupMembers(members);

      
      const initialSplits: Record<string, any> = {};
      members.forEach(m => {
        initialSplits[m.user_id] = {
          checked: true,
          amount: '',
          percentage: (100 / members.length).toFixed(1),
          shares: '1',
        };
      });
      setSplitSelections(initialSplits);
    }
  }, [formData.group_id, groups]);

  
  useEffect(() => {
    if (user && !formData.paid_by_id) {
      setFormData(p => ({ ...p, paid_by_id: user.id }));
    }
  }, [user]);

  const handleCheckboxChange = (userId: string) => {
    setSplitSelections(prev => {
      const updated = { ...prev };
      updated[userId] = {
        ...updated[userId],
        checked: !updated[userId].checked
      };

      
      const checkedUsers = Object.keys(updated).filter(uid => updated[uid].checked);
      if (checkedUsers.length > 0) {
        checkedUsers.forEach(uid => {
          updated[uid].percentage = (100 / checkedUsers.length).toFixed(1);
        });
      }

      return updated;
    });
  };

  const handleSplitValueChange = (userId: string, field: 'amount' | 'percentage' | 'shares', value: string) => {
    setSplitSelections(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  };

  const handleAddExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const totalAmt = parseFloat(formData.amount);
    if (isNaN(totalAmt) || totalAmt <= 0) {
      setFormError('Please enter a valid positive amount.');
      return;
    }

    const participants = Object.keys(splitSelections).filter(uid => splitSelections[uid].checked);
    if (participants.length === 0) {
      setFormError('Please select at least one participant for the split.');
      return;
    }

    
    const splitsPayload: any[] = [];

    if (formData.split_type === 'EQUAL') {
      participants.forEach(uid => {
        splitsPayload.push({ user_id: uid });
      });
    } else if (formData.split_type === 'PERCENTAGE') {
      let sumPct = 0;
      for (const uid of participants) {
        const pct = parseFloat(splitSelections[uid].percentage);
        if (isNaN(pct) || pct < 0) {
          setFormError('Percentage values must be positive numbers.');
          return;
        }
        sumPct += pct;
        splitsPayload.push({ user_id: uid, percentage: pct });
      }
      if (Math.abs(sumPct - 100) > 0.1) {
        setFormError(`Percentages must sum to exactly 100%. Current sum: ${sumPct}%`);
        return;
      }
    } else if (formData.split_type === 'EXACT') {
      let sumAmt = 0;
      for (const uid of participants) {
        const amt = parseFloat(splitSelections[uid].amount);
        if (isNaN(amt) || amt < 0) {
          setFormError('Exact split values must be positive numbers.');
          return;
        }
        sumAmt += amt;
        splitsPayload.push({ user_id: uid, amount: amt });
      }
      if (Math.abs(sumAmt - totalAmt) > 0.02) {
        setFormError(`Exact split amounts must sum to the total expense amount (₹${totalAmt}). Current sum: ₹${sumAmt}`);
        return;
      }
    } else if (formData.split_type === 'SHARES') {
      let sumShares = 0;
      for (const uid of participants) {
        const sh = parseInt(splitSelections[uid].shares, 10);
        if (isNaN(sh) || sh <= 0) {
          setFormError('Shares must be positive integers.');
          return;
        }
        sumShares += sh;
        splitsPayload.push({ user_id: uid, shares: sh });
      }
      if (sumShares <= 0) {
        setFormError('Total shares must be greater than zero.');
        return;
      }
    }

    setSubmitting(true);
    try {
      await apiRequest('/expenses/', {
        method: 'POST',
        body: JSON.stringify({
          group_id: formData.group_id,
          description: formData.description,
          amount: totalAmt,
          currency: formData.currency,
          paid_by_id: formData.paid_by_id,
          split_type: formData.split_type,
          expense_date: formData.expense_date,
          splits: splitsPayload,
          notes: formData.notes || null,
        }),
      });
      setShowAddExpense(false);
      setFormData(prev => ({
        ...prev,
        description: '',
        amount: '',
        notes: '',
      }));
      loadExpenses();
    } catch (err: any) {
      setFormError(err.message || 'Failed to record expense');
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
            <Coins size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          </div>
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 2, letterSpacing: '-0.03em' }}>Expenses</h1>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 14 }}>
              Record expenses and split them among members
            </p>
          </div>
        </div>
        <button onClick={() => setShowAddExpense(true)} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Plus size={16} />
          <span>Add Expense</span>
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
        <div className="shimmer" style={{ height: 300, borderRadius: 16 }} />
      ) : expenses.length === 0 ? (
        <div className="glass" style={{ padding: 48, textAlign: 'center', color: 'rgba(241,245,249,0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <Receipt size={48} style={{ color: 'rgba(255,255,255,0.2)' }} />
          </div>
          <h3>No expenses found</h3>
          <p style={{ fontSize: 14, margin: '8px 0 24px' }}>Click "Add Expense" to record a new transaction.</p>
        </div>
      ) : (
        <div className="glass" style={{ overflow: 'hidden' }}>
          <table className="table-dark">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Group</th>
                <th>Paid By</th>
                <th>Split Type</th>
                <th>INR Amount</th>
                <th>Original</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map(e => {
                const groupName = groups.find(g => g.id === e.group_id)?.name || 'Unknown';
                return (
                  <tr key={e.id}>
                    <td style={{ color: 'rgba(241,245,249,0.4)', fontSize: 12 }}>
                      {formatDate(e.expense_date)}
                    </td>
                    <td>
                      <div>
                        <p style={{ fontWeight: 600 }}>{e.description}</p>
                        <p style={{ fontSize: 11, color: 'rgba(241,245,249,0.4)', marginTop: 2 }}>
                          Splits: {e.splits.map(s => {
                            const name = groups.find(g => g.id === e.group_id)?.members.find(m => m.user_id === s.user_id)?.user_name || 'User';
                            return `${name} (₹${s.amount.toFixed(0)})`;
                          }).join(', ')}
                        </p>
                      </div>
                    </td>
                    <td style={{ fontSize: 13, color: 'rgba(241,245,249,0.7)' }}>{groupName}</td>
                    <td>{e.paid_by_name}</td>
                    <td>
                      <span className="badge badge-low">{e.split_type}</span>
                    </td>
                    <td style={{ fontWeight: 700, fontSize: 15, color: '#ffffff' }}>
                      {formatINR(e.amount)}
                    </td>
                    <td style={{ fontSize: 12, color: 'rgba(241,245,249,0.4)' }}>
                      {e.original_currency && e.original_amount ? (
                        <span>
                          {e.original_amount} {e.original_currency} <br />
                          <small>@ {e.conversion_rate?.toFixed(2)}</small>
                        </span>
                      ) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {}
      {showAddExpense && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          overflowY: 'auto', padding: '40px 0',
        }}>
          <div className="glass-strong animate-fade-in-up" style={{ width: '100%', maxWidth: 540, padding: 32, margin: 'auto' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Record Expense</h2>
            <p style={{ color: 'rgba(241,245,249,0.5)', fontSize: 13, marginBottom: 24 }}>Add an expense and calculate splits</p>

            {formError && (
              <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 20, color: '#ffffff', fontSize: 13 }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Group</label>
                <select required className="input-dark" value={formData.group_id} onChange={e => setFormData(p => ({ ...p, group_id: e.target.value }))}>
                  {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
              </div>

              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Description</label>
                <input type="text" required className="input-dark" placeholder="e.g. Flat Groceries or Thalassa Dinner" value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} />
              </div>

              {}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Amount</label>
                  <input type="number" step="any" required className="input-dark" placeholder="0.00" value={formData.amount} onChange={e => setFormData(p => ({ ...p, amount: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Currency</label>
                  <select className="input-dark" value={formData.currency} onChange={e => setFormData(p => ({ ...p, currency: e.target.value }))}>
                    <option value="INR">INR (₹)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
              </div>

              {}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Paid By</label>
                  <select required className="input-dark" value={formData.paid_by_id} onChange={e => setFormData(p => ({ ...p, paid_by_id: e.target.value }))}>
                    {groupMembers.map(m => (
                      <option key={m.user_id} value={m.user_id}>{m.user_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Date</label>
                  <input type="date" required className="input-dark" value={formData.expense_date} onChange={e => setFormData(p => ({ ...p, expense_date: e.target.value }))} />
                </div>
              </div>

              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Split Method</label>
                <select className="input-dark" value={formData.split_type} onChange={e => setFormData(p => ({ ...p, split_type: e.target.value }))}>
                  <option value="EQUAL">Split Equally</option>
                  <option value="PERCENTAGE">Split by Percentage</option>
                  <option value="EXACT">Split by Exact Amount</option>
                  <option value="SHARES">Split by Shares</option>
                </select>
              </div>

              {}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: 16, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: 'rgba(241,245,249,0.5)', textTransform: 'uppercase', marginBottom: 12 }}>Participants</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {groupMembers.map(m => {
                    const sel = splitSelections[m.user_id] || { checked: false, amount: '', percentage: '', shares: '' };
                    return (
                      <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                          <input type="checkbox" checked={sel.checked} onChange={() => handleCheckboxChange(m.user_id)} style={{ cursor: 'pointer' }} />
                          <span style={{ opacity: sel.checked ? 1 : 0.5 }}>{m.user_name}</span>
                        </label>

                        {sel.checked && (
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            {formData.split_type === 'PERCENTAGE' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" step="any" className="input-dark" style={{ width: 80, padding: '6px 10px', fontSize: 13 }} value={sel.percentage} onChange={e => handleSplitValueChange(m.user_id, 'percentage', e.target.value)} />
                                <span style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)' }}>%</span>
                              </div>
                            )}
                            {formData.split_type === 'EXACT' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <span style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)' }}>₹</span>
                                <input type="number" step="any" className="input-dark" style={{ width: 90, padding: '6px 10px', fontSize: 13 }} value={sel.amount} onChange={e => handleSplitValueChange(m.user_id, 'amount', e.target.value)} />
                              </div>
                            )}
                            {formData.split_type === 'SHARES' && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <input type="number" className="input-dark" style={{ width: 70, padding: '6px 10px', fontSize: 13 }} value={sel.shares} onChange={e => handleSplitValueChange(m.user_id, 'shares', e.target.value)} />
                                <span style={{ fontSize: 13, color: 'rgba(241,245,249,0.5)' }}>share(s)</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'rgba(241,245,249,0.7)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Notes (optional)</label>
                <input type="text" className="input-dark" placeholder="e.g. Paid by cash, to be settled by Rohan" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} />
              </div>

              {}
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <button type="button" onClick={() => setShowAddExpense(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</button>
                <button type="submit" className="btn-primary" disabled={submitting} style={{ flex: 1 }}>
                  {submitting ? 'Recording…' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
