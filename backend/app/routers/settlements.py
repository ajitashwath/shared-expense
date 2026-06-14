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
router = APIRouter(prefix='/settlements', tags=['Settlements'])

class RecordSettlementRequest(BaseModel):
    group_id: str
    from_user_id: str
    to_user_id: str
    amount: float
    settlement_date: str
    notes: Optional[str] = None

@router.post('/', status_code=201)
async def record_settlement(body: RecordSettlementRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    if body.amount <= 0:
        raise HTTPException(status_code=400, detail='Settlement amount must be positive')
    if body.from_user_id == body.to_user_id:
        raise HTTPException(status_code=400, detail='Cannot settle with yourself')
    from_user = await db.projectionuser.find_unique(where={'id': body.from_user_id})
    to_user = await db.projectionuser.find_unique(where={'id': body.to_user_id})
    if not from_user or not to_user:
        raise HTTPException(status_code=404, detail='User not found')
    group = await db.projectiongroup.find_unique(where={'id': body.group_id})
    if not group:
        raise HTTPException(status_code=404, detail='Group not found')
    settlement_id = cuid.cuid()
    settlement_date = datetime.strptime(body.settlement_date, '%Y-%m-%d')
    event_store = EventStore(db)
    await event_store.append(DomainEvent(aggregate_id=settlement_id, aggregate_type=AggregateType.SETTLEMENT, event_type=EventType.SETTLEMENT_RECORDED, payload={'group_id': body.group_id, 'from_user_id': body.from_user_id, 'from_user_name': from_user.name, 'to_user_id': body.to_user_id, 'to_user_name': to_user.name, 'amount': body.amount, 'settlement_date': body.settlement_date, 'notes': body.notes}, created_by=current_user.id))
    description = f'{from_user.name} paid {to_user.name}'
    settlement_expense = await db.projectionexpense.create(data={'id': settlement_id, 'groupId': body.group_id, 'description': description, 'amount': body.amount, 'currency': 'INR', 'paidById': body.from_user_id, 'splitType': 'EXACT', 'expenseDate': settlement_date, 'isSettlement': True})
    await db.projectionexpensesplit.create(data={'expenseId': settlement_id, 'userId': body.to_user_id, 'amount': body.amount})
    await _update_balance(db, body.group_id, body.from_user_id, body.amount)
    await _update_balance(db, body.group_id, body.to_user_id, -body.amount)
    return {'id': settlement_id, 'from_user': from_user.name, 'to_user': to_user.name, 'amount': body.amount, 'settlement_date': body.settlement_date, 'message': f'Settlement recorded: {from_user.name} paid {to_user.name} ₹{body.amount}'}

@router.get('/')
async def list_settlements(group_id: Optional[str]=None, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    where = {'isSettlement': True}
    if group_id:
        where['groupId'] = group_id
    settlements = await db.projectionexpense.find_many(where=where, include={'paidBy': True, 'splits': True}, order={'expenseDate': 'desc'})
    return [{'id': s.id, 'group_id': s.groupId, 'description': s.description, 'from_user_id': s.paidById, 'from_user_name': s.paidBy.name if s.paidBy else None, 'to_user_id': s.splits[0].userId if s.splits else None, 'amount': s.amount, 'date': s.expenseDate.isoformat()} for s in settlements]

async def _update_balance(db: Prisma, group_id: str, user_id: str, delta: float):
    existing = await db.projectionbalance.find_first(where={'userId': user_id, 'groupId': group_id})
    if existing:
        await db.projectionbalance.update(where={'id': existing.id}, data={'netBalance': existing.netBalance + delta})
    else:
        await db.projectionbalance.create(data={'userId': user_id, 'groupId': group_id, 'netBalance': delta})