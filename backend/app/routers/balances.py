from fastapi import APIRouter, Depends, HTTPException
from prisma import Prisma
from app.database import get_db
from app.auth.service import get_current_user, require_member_or_admin
from app.services.balance_calculator import BalanceCalculator
router = APIRouter(prefix='/balances', tags=['Balances'])

@router.get('/group/{group_id}')
async def get_group_balances(group_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    group = await db.projectiongroup.find_unique(where={'id': group_id})
    if not group:
        raise HTTPException(status_code=404, detail='Group not found')
    calculator = BalanceCalculator(db)
    balances = await calculator.get_group_balances(group_id)
    transactions = await calculator.compute_who_owes_whom(group_id)
    return {'group_id': group_id, 'group_name': group.name, 'member_balances': balances, 'who_owes_whom': transactions, 'currency': 'INR'}

@router.get('/breakdown/{group_id}/{user_id}')
async def get_balance_breakdown(group_id: str, user_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    calculator = BalanceCalculator(db)
    breakdown = await calculator.get_balance_breakdown(user_id, group_id)
    return breakdown

@router.post('/rebuild/{group_id}')
async def rebuild_balances(group_id: str, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    calculator = BalanceCalculator(db)
    await calculator.rebuild_balances_for_group(group_id, db, user_id=current_user.id)
    return {'message': f'Balances rebuilt for group {group_id}'}