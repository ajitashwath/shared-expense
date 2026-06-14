from typing import Optional
from prisma import Prisma

class BalanceCalculator:

    def __init__(self, db: Prisma):
        self.db = db

    async def get_group_balances(self, group_id: str) -> list[dict]:
        balances = await self.db.projectionbalance.find_many(where={'groupId': group_id})
        users = await self.db.projectionuser.find_many(where={'id': {'in': [b.userId for b in balances]}})
        user_map = {u.id: u.name for u in users}
        return [{'user_id': b.userId, 'user_name': user_map.get(b.userId, 'Unknown'), 'net_balance': round(b.netBalance, 2), 'direction': 'owed' if b.netBalance > 0 else 'owes'} for b in balances]

    async def get_balance_breakdown(self, user_id: str, group_id: str) -> dict:
        splits = await self.db.projectionexpensesplit.find_many(where={'userId': user_id, 'isActive': True}, include={'expense': True})
        expense_lines = []
        total_owed = 0.0
        for split in splits:
            expense = split.expense
            if expense.groupId != group_id:
                continue
            owed = split.amount
            total_owed += owed
            line = {'type': 'expense', 'id': expense.id, 'description': expense.description, 'expense_date': expense.expenseDate.isoformat(), 'split_type': expense.splitType, 'amount_owed': round(owed, 2), 'paid_by': expense.paidById, 'currency': expense.currency, 'original_amount': expense.originalAmount, 'original_currency': expense.originalCurrency}
            if expense.paidById == user_id:
                line['is_payer'] = True
                line['total_expense'] = expense.amount
            else:
                line['is_payer'] = False
            expense_lines.append(line)
        settlements_paid = await self.db.projectionexpense.find_many(where={'groupId': group_id, 'isSettlement': True, 'paidById': user_id})
        settlements_received = await self.db.projectionexpense.find_many(where={'groupId': group_id, 'isSettlement': True, 'splits': {'some': {'userId': user_id}}}, include={'splits': True})
        settlement_lines = []
        for s in settlements_paid:
            settlement_lines.append({'type': 'settlement_paid', 'id': s.id, 'description': s.description, 'date': s.expenseDate.isoformat(), 'amount': -s.amount})
            total_owed -= s.amount
        for s in settlements_received:
            for split in s.splits:
                if split.userId == user_id:
                    settlement_lines.append({'type': 'settlement_received', 'id': s.id, 'description': s.description, 'date': s.expenseDate.isoformat(), 'amount': split.amount})
                    total_owed += split.amount
        all_lines = expense_lines + settlement_lines
        all_lines.sort(key=lambda x: x.get('expense_date') or x.get('date') or '')
        return {'user_id': user_id, 'group_id': group_id, 'net_balance': round(total_owed, 2), 'breakdown': all_lines, 'total_expense_lines': len(expense_lines), 'total_settlement_lines': len(settlement_lines)}

    async def compute_who_owes_whom(self, group_id: str) -> list[dict]:
        balances = await self.db.projectionbalance.find_many(where={'groupId': group_id})
        users = await self.db.projectionuser.find_many(where={'id': {'in': [b.userId for b in balances]}})
        user_map = {u.id: u.name for u in users}
        debts = {b.userId: b.netBalance for b in balances}
        creditors = sorted([(uid, amt) for uid, amt in debts.items() if amt > 0.01], key=lambda x: -x[1])
        debtors = sorted([(uid, -amt) for uid, amt in debts.items() if amt < -0.01], key=lambda x: -x[1])
        transactions = []
        i, j = (0, 0)
        while i < len(creditors) and j < len(debtors):
            creditor_id, credit = creditors[i]
            debtor_id, debt = debtors[j]
            amount = min(credit, debt)
            transactions.append({'from_user_id': debtor_id, 'from_user_name': user_map.get(debtor_id, 'Unknown'), 'to_user_id': creditor_id, 'to_user_name': user_map.get(creditor_id, 'Unknown'), 'amount': round(amount, 2)})
            creditors[i] = (creditor_id, credit - amount)
            debtors[j] = (debtor_id, debt - amount)
            if creditors[i][1] < 0.01:
                i += 1
            if debtors[j][1] < 0.01:
                j += 1
        return transactions

    async def rebuild_balances_for_group(self, group_id: str, db: Prisma, user_id: str = 'system'):
        from datetime import datetime
        from app.events.store import EventStore
        from app.events.types import DomainEvent, EventType, AggregateType

        event_store = EventStore(db)
        await event_store.append(
            DomainEvent(
                aggregate_id=group_id,
                aggregate_type=AggregateType.GROUP,
                event_type=EventType.PROJECTION_REBUILT,
                payload={
                    'group_id': group_id,
                    'rebuilt_by': user_id,
                    'rebuilt_at': datetime.utcnow().isoformat(),
                    'scope': 'balances'
                },
                created_by=user_id
            )
        )

        await db.projectionbalance.delete_many(where={'groupId': group_id})
        expenses = await db.projectionexpense.find_many(where={'groupId': group_id}, include={'splits': True})
        balances: dict[str, float] = {}
        for expense in expenses:
            if expense.isSettlement:
                continue
            payer_id = expense.paidById
            if payer_id not in balances:
                balances[payer_id] = 0.0
            balances[payer_id] += expense.amount
            for split in expense.splits:
                if not split.isActive:
                    continue
                uid = split.userId
                if uid not in balances:
                    balances[uid] = 0.0
                balances[uid] -= split.amount
        settlements = await db.projectionexpense.find_many(where={'groupId': group_id, 'isSettlement': True}, include={'splits': True})
        for s in settlements:
            payer_id = s.paidById
            if payer_id not in balances:
                balances[payer_id] = 0.0
            balances[payer_id] -= s.amount
            for split in s.splits:
                uid = split.userId
                if uid not in balances:
                    balances[uid] = 0.0
                balances[uid] += split.amount
        for user_id, net_balance in balances.items():
            existing = await db.projectionbalance.find_first(where={'userId': user_id, 'groupId': group_id})
            if existing:
                await db.projectionbalance.update(where={'id': existing.id}, data={'netBalance': net_balance})
            else:
                await db.projectionbalance.create(data={'userId': user_id, 'groupId': group_id, 'netBalance': net_balance})

        active_memberships = await db.projectionmembership.find_many(where={'groupId': group_id, 'isActive': True})
        await event_store.append(
            DomainEvent(
                aggregate_id=group_id,
                aggregate_type=AggregateType.GROUP,
                event_type=EventType.BALANCE_RECOMPUTED,
                payload={
                    'group_id': group_id,
                    'recomputed_by': user_id,
                    'recomputed_at': datetime.utcnow().isoformat(),
                    'active_member_count': len(active_memberships)
                },
                created_by=user_id
            )
        )