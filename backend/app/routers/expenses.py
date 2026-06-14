import cuid
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from prisma import Prisma
from app.database import get_db
from app.auth.service import get_current_user, require_member_or_admin
from app.events.store import EventStore
from app.events.types import DomainEvent, EventType, AggregateType
from app.services.currency import convert_to_inr
from app.services.balance_calculator import BalanceCalculator
router = APIRouter(prefix='/expenses', tags=['Expenses'])

class SplitDetail(BaseModel):
    user_id: str
    amount: Optional[float] = None
    percentage: Optional[float] = None
    shares: Optional[int] = None

class CreateExpenseRequest(BaseModel):
    group_id: str
    description: str
    amount: float
    currency: str = 'INR'
    paid_by_id: str
    split_type: str
    expense_date: str
    splits: list[SplitDetail]
    notes: Optional[str] = None

@router.post('/', status_code=201)
async def create_expense(body: CreateExpenseRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    group = await db.projectiongroup.find_unique(where={'id': body.group_id})
    if not group:
        raise HTTPException(status_code=404, detail='Group not found')
    payer = await db.projectionuser.find_unique(where={'id': body.paid_by_id})
    if not payer:
        raise HTTPException(status_code=404, detail='Payer not found')
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail='Amount must be positive')
    expense_date = datetime.strptime(body.expense_date, '%Y-%m-%d')
    converted_amount = body.amount
    rate_used = 1.0
    if body.currency != 'INR':
        converted_amount, rate_used = convert_to_inr(body.amount, body.currency, expense_date.date())
    splits = _calculate_splits(body.split_type, body.splits, converted_amount)
    if not splits:
        raise HTTPException(status_code=400, detail='No valid splits provided')
    expense_id = cuid.cuid()
    event_store = EventStore(db)
    await event_store.append(DomainEvent(aggregate_id=expense_id, aggregate_type=AggregateType.EXPENSE, event_type=EventType.EXPENSE_CREATED, payload={'group_id': body.group_id, 'description': body.description, 'amount': converted_amount, 'currency': 'INR', 'original_amount': body.amount if body.currency != 'INR' else None, 'original_currency': body.currency if body.currency != 'INR' else None, 'conversion_rate': rate_used if body.currency != 'INR' else None, 'paid_by_id': body.paid_by_id, 'paid_by_name': payer.name, 'split_type': body.split_type, 'expense_date': body.expense_date, 'notes': body.notes}, created_by=current_user.id))
    if body.currency != 'INR':
        await event_store.append(DomainEvent(aggregate_id=expense_id, aggregate_type=AggregateType.EXPENSE, event_type=EventType.CURRENCY_CONVERSION_APPLIED, payload={'expense_id': expense_id, 'original_amount': body.amount, 'original_currency': body.currency, 'conversion_rate': rate_used, 'converted_amount': converted_amount, 'conversion_date': body.expense_date}, created_by=current_user.id))
    expense = await db.projectionexpense.create(data={'id': expense_id, 'groupId': body.group_id, 'description': body.description, 'amount': converted_amount, 'currency': 'INR', 'originalAmount': body.amount if body.currency != 'INR' else None, 'originalCurrency': body.currency if body.currency != 'INR' else None, 'conversionRate': rate_used if body.currency != 'INR' else None, 'paidById': body.paid_by_id, 'splitType': body.split_type, 'expenseDate': expense_date})
    for user_id, split_amount, pct, sh in splits:
        await event_store.append(DomainEvent(aggregate_id=expense_id, aggregate_type=AggregateType.EXPENSE, event_type=EventType.EXPENSE_SPLIT_ASSIGNED, payload={'expense_id': expense_id, 'user_id': user_id, 'amount': split_amount, 'percentage': pct, 'shares': sh}, created_by=current_user.id))
        await db.projectionexpensesplit.create(data={'expenseId': expense_id, 'userId': user_id, 'amount': split_amount, 'percentage': pct, 'shares': sh})
        await _update_balance(db, body.group_id, user_id, -split_amount)
    await _update_balance(db, body.group_id, body.paid_by_id, converted_amount)
    return {'id': expense_id, 'amount': converted_amount, 'message': 'Expense created'}

@router.get('/')
async def list_expenses(group_id: Optional[str]=None, limit: int=50, offset: int=0, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    where = {}
    if group_id:
        where['groupId'] = group_id
    expenses = await db.projectionexpense.find_many(where=where, include={'paidBy': True, 'splits': True}, order={'expenseDate': 'desc'}, take=limit, skip=offset)
    return [_format_expense(e) for e in expenses]

@router.get('/{expense_id}')
async def get_expense(expense_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    expense = await db.projectionexpense.find_unique(where={'id': expense_id}, include={'paidBy': True, 'splits': True})
    if not expense:
        raise HTTPException(status_code=404, detail='Expense not found')
    return _format_expense(expense)

@router.get('/{expense_id}/events')
async def get_expense_events(expense_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    event_store = EventStore(db)
    events = await event_store.get_events_for_aggregate(expense_id)
    return [event_store._format_for_audit(e) for e in events]

def _calculate_splits(split_type: str, splits: list[SplitDetail], total_amount: float) -> list[tuple]:
    results = []
    split_type = split_type.upper()
    if split_type == 'EQUAL':
        n = len(splits)
        per_person = round(total_amount / n, 2)
        remainder = round(total_amount - per_person * n, 2)
        for i, s in enumerate(splits):
            amt = per_person + (remainder if i == 0 else 0)
            results.append((s.user_id, amt, None, None))
    elif split_type == 'PERCENTAGE':
        total_pct = sum((s.percentage or 0 for s in splits))
        if abs(total_pct - 100.0) > 0.01:
            raise HTTPException(400, f'Percentages must sum to 100% (got {total_pct}%)')
        for s in splits:
            amt = round(total_amount * (s.percentage or 0) / 100, 2)
            results.append((s.user_id, amt, s.percentage, None))
    elif split_type == 'EXACT':
        total_exact = sum((s.amount or 0 for s in splits))
        if abs(total_exact - total_amount) > 0.01:
            raise HTTPException(400, f'Exact amounts must sum to {total_amount} (got {total_exact})')
        for s in splits:
            results.append((s.user_id, s.amount or 0, None, None))
    elif split_type == 'SHARES':
        total_shares = sum((s.shares or 0 for s in splits))
        if total_shares == 0:
            raise HTTPException(400, 'Total shares cannot be zero')
        for s in splits:
            amt = round(total_amount * (s.shares or 0) / total_shares, 2)
            results.append((s.user_id, amt, None, s.shares))
    else:
        for s in splits:
            results.append((s.user_id, s.amount or 0, None, None))
    return results

async def _update_balance(db: Prisma, group_id: str, user_id: str, delta: float):
    existing = await db.projectionbalance.find_first(where={'userId': user_id, 'groupId': group_id})
    if existing:
        await db.projectionbalance.update(where={'id': existing.id}, data={'netBalance': existing.netBalance + delta})
    else:
        await db.projectionbalance.create(data={'userId': user_id, 'groupId': group_id, 'netBalance': delta})

def _format_expense(e) -> dict:
    splits = []
    if hasattr(e, 'splits') and e.splits:
        splits = [{'user_id': s.userId, 'amount': s.amount, 'percentage': s.percentage, 'shares': s.shares} for s in e.splits]
    return {'id': e.id, 'group_id': e.groupId, 'description': e.description, 'amount': e.amount, 'currency': e.currency, 'original_amount': e.originalAmount, 'original_currency': e.originalCurrency, 'conversion_rate': e.conversionRate, 'paid_by_id': e.paidById, 'paid_by_name': e.paidBy.name if hasattr(e, 'paidBy') and e.paidBy else None, 'split_type': e.splitType, 'expense_date': e.expenseDate.isoformat(), 'is_imported': e.isImported, 'is_settlement': e.isSettlement, 'splits': splits, 'created_at': e.createdAt.isoformat()}