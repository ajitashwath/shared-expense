from typing import Any, Optional
from prisma import Prisma, Json
from app.events.types import DomainEvent, EventType, AggregateType
import json

class EventStore:

    def __init__(self, db: Prisma):
        self.db = db

    async def append(self, event: DomainEvent) -> dict:
        record = await self.db.eventstore.create(data={'aggregateId': event.aggregate_id, 'aggregateType': event.aggregate_type, 'eventType': event.event_type, 'eventPayload': Json(event.payload), 'createdBy': event.created_by})
        return record

    async def append_many(self, events: list[DomainEvent]) -> int:
        data = []
        for event in events:
            data.append({
                'aggregateId': event.aggregate_id,
                'aggregateType': event.aggregate_type,
                'eventType': event.event_type,
                'eventPayload': Json(event.payload),
                'createdBy': event.created_by
            })
        if data:
            return await self.db.eventstore.create_many(data=data)
        return 0

    async def get_events_for_aggregate(self, aggregate_id: str, event_type: Optional[str]=None) -> list[dict]:
        where = {'aggregateId': aggregate_id}
        if event_type:
            where['eventType'] = event_type
        events = await self.db.eventstore.find_many(where=where, order={'createdAt': 'asc'})
        return events

    async def get_events_by_type(self, event_type: str, limit: int=100, offset: int=0) -> list[dict]:
        events = await self.db.eventstore.find_many(where={'eventType': event_type}, order={'createdAt': 'asc'}, take=limit, skip=offset)
        return events

    async def get_all_events(self, aggregate_type: Optional[str]=None, limit: int=200, offset: int=0) -> list[dict]:
        where = {}
        if aggregate_type:
            where['aggregateType'] = aggregate_type
        events = await self.db.eventstore.find_many(where=where, order={'createdAt': 'asc'}, take=limit, skip=offset)
        return events

    async def get_audit_trail(self, aggregate_id: Optional[str]=None, limit: int=50, offset: int=0) -> list[dict]:
        where = {}
        if aggregate_id:
            where['aggregateId'] = aggregate_id
        events = await self.db.eventstore.find_many(where=where, order={'createdAt': 'desc'}, take=limit, skip=offset)
        return [self._format_for_audit(e) for e in events]

    def _format_for_audit(self, event) -> dict:
        return {'id': event.id, 'aggregate_id': event.aggregateId, 'aggregate_type': event.aggregateType, 'event_type': event.eventType, 'payload': event.eventPayload, 'created_at': event.createdAt.isoformat(), 'created_by': event.createdBy}