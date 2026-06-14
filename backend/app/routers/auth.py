import cuid
from fastapi import APIRouter, Depends, HTTPException, status
from prisma import Prisma
from app.database import get_db
from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse, UserOut
from app.auth.service import hash_password, verify_password, create_access_token, get_current_user
from app.events.store import EventStore
from app.events.types import DomainEvent, EventType, AggregateType
router = APIRouter(prefix='/auth', tags=['Authentication'])

@router.post('/register', response_model=TokenResponse, status_code=201)
async def register(body: RegisterRequest, db: Prisma=Depends(get_db)):
    existing = await db.projectionuser.find_unique(where={'email': body.email})
    if existing:
        raise HTTPException(status_code=400, detail='Email already registered')
    if body.role not in ['MEMBER', 'ADMIN', 'VIEWER']:
        raise HTTPException(status_code=400, detail='Invalid role')
    user_id = cuid.cuid()
    hashed = hash_password(body.password)
    user = await db.projectionuser.create(data={'id': user_id, 'email': body.email, 'name': body.name, 'passwordHash': hashed, 'role': body.role})
    event_store = EventStore(db)
    await event_store.append(DomainEvent(aggregate_id=user_id, aggregate_type=AggregateType.USER, event_type=EventType.USER_REGISTERED, payload={'name': body.name, 'email': body.email, 'role': body.role}, created_by=user_id))
    token = create_access_token({'sub': user_id, 'email': body.email, 'role': body.role})
    return {'access_token': token, 'token_type': 'bearer', 'user': UserOut(id=user.id, name=user.name, email=user.email, role=user.role, is_active=user.isActive)}

@router.post('/login', response_model=TokenResponse)
async def login(body: LoginRequest, db: Prisma=Depends(get_db)):
    user = await db.projectionuser.find_unique(where={'email': body.email})
    if not user or not verify_password(body.password, user.passwordHash):
        raise HTTPException(status_code=401, detail='Invalid email or password')
    if not user.isActive:
        raise HTTPException(status_code=403, detail='Account is deactivated')
    token = create_access_token({'sub': user.id, 'email': user.email, 'role': user.role})
    return {'access_token': token, 'token_type': 'bearer', 'user': UserOut(id=user.id, name=user.name, email=user.email, role=user.role, is_active=user.isActive)}

@router.get('/me', response_model=UserOut)
async def get_me(current_user=Depends(get_current_user)):
    return UserOut(id=current_user.id, name=current_user.name, email=current_user.email, role=current_user.role, is_active=current_user.isActive)

@router.get('/users', response_model=list[UserOut])
async def list_users(db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    users = await db.projectionuser.find_many(where={'isActive': True}, order={'name': 'asc'})
    return [UserOut(id=u.id, name=u.name, email=u.email, role=u.role, is_active=u.isActive) for u in users]