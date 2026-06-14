import asyncio
import cuid
from datetime import datetime, date
from prisma import Prisma
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from app.auth.service import hash_password
from app.events.store import EventStore
from app.events.types import DomainEvent, EventType, AggregateType
USERS = [{'name': 'Aisha', 'email': 'aisha@flat.com', 'role': 'ADMIN'}, {'name': 'Rohan', 'email': 'rohan@flat.com', 'role': 'MEMBER'}, {'name': 'Priya', 'email': 'priya@flat.com', 'role': 'MEMBER'}, {'name': 'Meera', 'email': 'meera@flat.com', 'role': 'MEMBER'}, {'name': 'Sam', 'email': 'sam@flat.com', 'role': 'MEMBER'}, {'name': 'Dev', 'email': 'dev@flat.com', 'role': 'MEMBER'}]
DEFAULT_PASSWORD = 'password123'
MEMBERSHIP_TIMELINE = [{'name': 'Aisha', 'joined': '2026-02-01', 'left': None}, {'name': 'Rohan', 'joined': '2026-02-01', 'left': None}, {'name': 'Priya', 'joined': '2026-02-01', 'left': None}, {'name': 'Meera', 'joined': '2026-02-01', 'left': '2026-03-31'}, {'name': 'Sam', 'joined': '2026-04-15', 'left': None}, {'name': 'Dev', 'joined': '2026-05-01', 'left': '2026-05-05'}]

async def seed():
    db = Prisma()
    await db.connect()
    event_store = EventStore(db)
    print('🌱 Seeding database...')
    group_id = cuid.cuid()
    existing_group = await db.projectiongroup.find_first(where={'name': 'Flatmates'})
    if not existing_group:
        await db.projectiongroup.create(data={'id': group_id, 'name': 'Flatmates', 'description': 'Shared flat expenses tracker', 'membershipPolicy': 'STRICT', 'createdBy': 'system'})
        await event_store.append(DomainEvent(aggregate_id=group_id, aggregate_type=AggregateType.GROUP, event_type=EventType.GROUP_CREATED, payload={'name': 'Flatmates', 'membership_policy': 'STRICT', 'created_by': 'system'}))
        print(f'✅ Created group: Flatmates ({group_id})')
    else:
        group_id = existing_group.id
        print(f'ℹ️  Group already exists: {group_id}')
    user_map = {}
    for u in USERS:
        existing = await db.projectionuser.find_unique(where={'email': u['email']})
        if existing:
            user_map[u['name'].lower()] = existing.id
            print(f"ℹ️  User already exists: {u['name']}")
            continue
        user_id = cuid.cuid()
        await db.projectionuser.create(data={'id': user_id, 'email': u['email'], 'name': u['name'], 'passwordHash': hash_password(DEFAULT_PASSWORD), 'role': u['role']})
        await event_store.append(DomainEvent(aggregate_id=user_id, aggregate_type=AggregateType.USER, event_type=EventType.USER_REGISTERED, payload={'name': u['name'], 'email': u['email'], 'role': u['role']}))
        user_map[u['name'].lower()] = user_id
        print(f"✅ Created user: {u['name']} ({user_id})")
    for m in MEMBERSHIP_TIMELINE:
        name_lower = m['name'].lower()
        user_id = user_map.get(name_lower)
        if not user_id:
            print(f"⚠️  No user ID for {m['name']}, skipping membership")
            continue
        joined_at = datetime.strptime(m['joined'], '%Y-%m-%d')
        left_at = datetime.strptime(m['left'], '%Y-%m-%d') if m['left'] else None
        existing_membership = await db.projectionmembership.find_first(where={'userId': user_id, 'groupId': group_id, 'joinedAt': joined_at})
        if existing_membership:
            print(f"ℹ️  Membership already exists for {m['name']}")
            continue
        await db.projectionmembership.create(data={'userId': user_id, 'groupId': group_id, 'joinedAt': joined_at, 'leftAt': left_at, 'isActive': left_at is None, 'addedBy': 'system'})
        await event_store.append(DomainEvent(aggregate_id=group_id, aggregate_type=AggregateType.GROUP, event_type=EventType.MEMBER_JOINED_GROUP, payload={'user_id': user_id, 'user_name': m['name'], 'group_id': group_id, 'joined_at': m['joined']}))
        if m['left']:
            await event_store.append(DomainEvent(aggregate_id=group_id, aggregate_type=AggregateType.GROUP, event_type=EventType.MEMBER_LEFT_GROUP, payload={'user_id': user_id, 'user_name': m['name'], 'group_id': group_id, 'left_at': m['left']}))
        print(f"✅ Created membership: {m['name']} joined {m['joined']}" + (f", left {m['left']}" if m['left'] else ''))
    print('\n✅ Seed complete!')
    print(f'\n📋 Login credentials (password: {DEFAULT_PASSWORD}):')
    for u in USERS:
        print(f"   {u['name']:8} → {u['email']} ({u['role']})")
    print(f'\n📦 Group ID: {group_id}')
    print('   Use this when uploading the CSV import.\n')
    await db.disconnect()
if __name__ == '__main__':
    asyncio.run(seed())