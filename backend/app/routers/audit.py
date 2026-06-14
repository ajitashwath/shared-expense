from typing import Optional
from fastapi import APIRouter, Depends
from prisma import Prisma
from app.database import get_db
from app.auth.service import get_current_user
from app.events.store import EventStore
router = APIRouter(prefix='/audit', tags=['Audit'])

@router.get('/events')
async def get_audit_events(aggregate_id: Optional[str]=None, aggregate_type: Optional[str]=None, event_type: Optional[str]=None, limit: int=100, offset: int=0, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    where = {}
    if aggregate_id:
        where['aggregateId'] = aggregate_id
    if aggregate_type:
        where['aggregateType'] = aggregate_type
    if event_type:
        where['eventType'] = event_type
    events = await db.eventstore.find_many(where=where, order={'createdAt': 'desc'}, take=limit, skip=offset)
    return [{'id': e.id, 'aggregate_id': e.aggregateId, 'aggregate_type': e.aggregateType, 'event_type': e.eventType, 'event_version': e.eventVersion, 'payload': e.eventPayload, 'created_at': e.createdAt.isoformat(), 'created_by': e.createdBy} for e in events]

@router.get('/events/count')
async def get_event_count(db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    total = await db.eventstore.count()
    return {'total_events': total}

@router.get('/aggregate/{aggregate_id}')
async def get_aggregate_history(aggregate_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    event_store = EventStore(db)
    events = await event_store.get_audit_trail(aggregate_id)
    return events

@router.get('/dashboard-summary')
async def get_dashboard_summary(db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    total_events = await db.eventstore.count()
    total_expenses = await db.projectionexpense.count(where={'isSettlement': False})
    total_settlements = await db.projectionexpense.count(where={'isSettlement': True})
    pending_anomalies = await db.anomaly.count(where={'userDecision': None})
    total_users = await db.projectionuser.count()
    total_groups = await db.projectiongroup.count()
    recent_events = await db.eventstore.find_many(order={'createdAt': 'desc'}, take=10)
    return {'total_events': total_events, 'total_expenses': total_expenses, 'total_settlements': total_settlements, 'pending_anomalies': pending_anomalies, 'total_users': total_users, 'total_groups': total_groups, 'recent_events': [{'event_type': e.eventType, 'aggregate_type': e.aggregateType, 'created_at': e.createdAt.isoformat()} for e in recent_events]}