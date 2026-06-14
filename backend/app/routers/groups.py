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
router = APIRouter(prefix='/groups', tags=['Groups'])

class CreateGroupRequest(BaseModel):
    name: str
    description: Optional[str] = None
    membership_policy: str = 'STRICT'

class AddMemberRequest(BaseModel):
    user_id: str
    joined_at: Optional[str] = None

class RemoveMemberRequest(BaseModel):
    user_id: str
    left_at: Optional[str] = None

@router.post('/', status_code=201)
async def create_group(body: CreateGroupRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    if body.membership_policy not in ['STRICT', 'INCLUSIVE']:
        raise HTTPException(status_code=400, detail='Invalid membership_policy')
    group_id = cuid.cuid()
    event_store = EventStore(db)
    group = await db.projectiongroup.create(data={'id': group_id, 'name': body.name, 'description': body.description, 'membershipPolicy': body.membership_policy, 'createdBy': current_user.id})
    await event_store.append(DomainEvent(aggregate_id=group_id, aggregate_type=AggregateType.GROUP, event_type=EventType.GROUP_CREATED, payload={'name': body.name, 'description': body.description, 'membership_policy': body.membership_policy, 'created_by': current_user.id}, created_by=current_user.id))
    return {'id': group.id, 'name': group.name, 'membership_policy': group.membershipPolicy}

@router.get('/')
async def list_groups(db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    groups = await db.projectiongroup.find_many(where={'isActive': True}, include={'memberships': {'include': {'user': True}}})
    return [_format_group(g) for g in groups]

@router.get('/{group_id}')
async def get_group(group_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    group = await db.projectiongroup.find_unique(where={'id': group_id}, include={'memberships': {'include': {'user': True}}})
    if not group:
        raise HTTPException(status_code=404, detail='Group not found')
    return _format_group(group)

@router.post('/{group_id}/members')
async def add_member(group_id: str, body: AddMemberRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    group = await db.projectiongroup.find_unique(where={'id': group_id})
    if not group:
        raise HTTPException(status_code=404, detail='Group not found')
    user = await db.projectionuser.find_unique(where={'id': body.user_id})
    if not user:
        raise HTTPException(status_code=404, detail='User not found')
    joined_at = datetime.fromisoformat(body.joined_at) if body.joined_at else datetime.utcnow()
    existing = await db.projectionmembership.find_first(where={'userId': body.user_id, 'groupId': group_id, 'isActive': True})
    if existing:
        raise HTTPException(status_code=400, detail='User is already an active member')
    event_store = EventStore(db)
    membership = await db.projectionmembership.create(data={'userId': body.user_id, 'groupId': group_id, 'joinedAt': joined_at, 'isActive': True, 'addedBy': current_user.id})
    await event_store.append(DomainEvent(aggregate_id=group_id, aggregate_type=AggregateType.GROUP, event_type=EventType.MEMBER_JOINED_GROUP, payload={'user_id': body.user_id, 'user_name': user.name, 'group_id': group_id, 'joined_at': joined_at.isoformat()}, created_by=current_user.id))
    return {'membership_id': membership.id, 'joined_at': joined_at.isoformat()}

@router.delete('/{group_id}/members/{user_id}')
async def remove_member(group_id: str, user_id: str, body: RemoveMemberRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    membership = await db.projectionmembership.find_first(where={'userId': user_id, 'groupId': group_id, 'isActive': True})
    if not membership:
        raise HTTPException(status_code=404, detail='Active membership not found')
    user = await db.projectionuser.find_unique(where={'id': user_id})
    left_at = datetime.fromisoformat(body.left_at) if body.left_at else datetime.utcnow()
    event_store = EventStore(db)
    await db.projectionmembership.update(where={'id': membership.id}, data={'isActive': False, 'leftAt': left_at})
    await event_store.append(DomainEvent(aggregate_id=group_id, aggregate_type=AggregateType.GROUP, event_type=EventType.MEMBER_LEFT_GROUP, payload={'user_id': user_id, 'user_name': user.name if user else 'Unknown', 'group_id': group_id, 'left_at': left_at.isoformat()}, created_by=current_user.id))
    return {'message': 'Member removed', 'left_at': left_at.isoformat()}

@router.get('/{group_id}/membership-timeline')
async def get_membership_timeline(group_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    memberships = await db.projectionmembership.find_many(where={'groupId': group_id}, include={'user': True}, order={'joinedAt': 'asc'})
    return [{'user_id': m.userId, 'user_name': m.user.name, 'joined_at': m.joinedAt.isoformat(), 'left_at': m.leftAt.isoformat() if m.leftAt else None, 'is_active': m.isActive} for m in memberships]

def _format_group(g) -> dict:
    members = []
    if hasattr(g, 'memberships') and g.memberships:
        members = [{'user_id': m.userId, 'user_name': m.user.name if m.user else 'Unknown', 'joined_at': m.joinedAt.isoformat(), 'left_at': m.leftAt.isoformat() if m.leftAt else None, 'is_active': m.isActive} for m in g.memberships]
    return {'id': g.id, 'name': g.name, 'description': g.description, 'membership_policy': g.membershipPolicy, 'is_active': g.isActive, 'created_at': g.createdAt.isoformat(), 'members': members}