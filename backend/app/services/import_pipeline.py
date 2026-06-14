import io
import cuid
import json
from datetime import datetime, date
from typing import Optional
import pandas as pd
from prisma import Prisma, Json
from app.services.anomaly_detector import AnomalyDetector, DetectedAnomaly, SPLIT_TYPE_ALIASES
from app.services.currency import convert_to_inr
from app.events.store import EventStore
from app.events.types import DomainEvent, EventType, AggregateType

class ImportPipeline:

    def __init__(self, db: Prisma, event_store: EventStore):
        self.db = db
        self.event_store = event_store

    async def ingest_csv(self, file_content: bytes, filename: str, uploaded_by: str, group_id: str) -> dict:
        batch = await self.db.importbatch.create(data={'filename': filename, 'uploadedBy': uploaded_by, 'status': 'PROCESSING', 'groupId': group_id})
        try:
            df = pd.read_csv(io.StringIO(file_content.decode('utf-8')))
        except Exception as e:
            await self.db.importbatch.update(where={'id': batch.id}, data={'status': 'FAILED'})
            raise ValueError(f'Failed to parse CSV: {e}')
        rows_data = df.to_dict(orient='records')
        raw_rows = []
        for i, row_data in enumerate(rows_data):
            cleaned = {k: None if pd.isna(v) else v for k, v in row_data.items()}
            raw_row = await self.db.rawimportrow.create(data={'batchId': batch.id, 'rowNumber': i + 2, 'rawData': Json(cleaned)})
            raw_rows.append((raw_row.id, cleaned))
        await self.db.importbatch.update(where={'id': batch.id}, data={'totalRows': len(rows_data)})
        return {'batch_id': batch.id, 'total_rows': len(rows_data)}

    async def run_anomaly_detection(self, batch_id: str) -> dict:
        batch = await self.db.importbatch.find_unique(where={'id': batch_id})
        if not batch:
            raise ValueError(f'Batch {batch_id} not found')
        raw_rows = await self.db.rawimportrow.find_many(where={'batchId': batch_id}, order={'rowNumber': 'asc'})
        members, timelines = await self._get_member_data(batch.groupId)
        all_row_dicts = [r.rawData for r in raw_rows]
        detector = AnomalyDetector(known_members=members, member_timelines=timelines, all_rows=all_row_dicts)
        total_anomalies = 0
        for raw_row in raw_rows:
            row_data = raw_row.rawData or {}
            anomalies = detector.detect_all(row_data, raw_row.rowNumber)
            for anomaly in anomalies:
                await self.db.anomaly.create(data={'batchId': batch_id, 'rawRowId': raw_row.id, 'rowNumber': anomaly.row_number, 'category': anomaly.category.value, 'severity': anomaly.severity.value, 'rawData': Json(anomaly.raw_data), 'detectedRule': anomaly.detected_rule, 'suggestedResolution': anomaly.suggested_resolution})
                await self.event_store.append(DomainEvent(aggregate_id=batch_id, aggregate_type=AggregateType.IMPORT, event_type=EventType.ANOMALY_DETECTED, payload={'batch_id': batch_id, 'row_number': anomaly.row_number, 'category': anomaly.category.value, 'severity': anomaly.severity.value, 'detected_rule': anomaly.detected_rule, 'raw_data': anomaly.raw_data, 'suggested_resolution': anomaly.suggested_resolution}))
                total_anomalies += 1
        await self.db.importbatch.update(where={'id': batch_id}, data={'status': 'REVIEW', 'anomalyCount': total_anomalies})
        return {'batch_id': batch_id, 'total_rows': len(raw_rows), 'anomaly_count': total_anomalies}

    async def resolve_anomaly(self, anomaly_id: str, decision: str, decided_by: str, notes: Optional[str]=None) -> dict:
        anomaly = await self.db.anomaly.find_unique(where={'id': anomaly_id})
        if not anomaly:
            raise ValueError(f'Anomaly {anomaly_id} not found')
        updated = await self.db.anomaly.update(where={'id': anomaly_id}, data={'userDecision': decision, 'decidedBy': decided_by, 'decidedAt': datetime.utcnow(), 'notes': notes})
        await self.event_store.append(DomainEvent(aggregate_id=anomaly.batchId, aggregate_type=AggregateType.IMPORT, event_type=EventType.ANOMALY_RESOLVED, payload={'anomaly_id': anomaly_id, 'batch_id': anomaly.batchId, 'row_number': anomaly.rowNumber, 'user_decision': decision, 'resolved_by': decided_by, 'notes': notes, 'category': anomaly.category}, created_by=decided_by))
        return {'anomaly_id': anomaly_id, 'decision': decision}

    async def commit_import(self, batch_id: str, committed_by: str, group_id: str, usd_to_inr_rate: float=83.5) -> dict:
        batch = await self.db.importbatch.find_unique(where={'id': batch_id})
        if not batch:
            raise ValueError(f'Batch {batch_id} not found')
        raw_rows = await self.db.rawimportrow.find_many(where={'batchId': batch_id, 'status': 'PENDING'}, order={'rowNumber': 'asc'})
        anomalies = await self.db.anomaly.find_many(where={'batchId': batch_id})
        anomaly_map: dict[str, list] = {}
        for a in anomalies:
            if a.rawRowId:
                anomaly_map.setdefault(a.rawRowId, []).append(a)
        members, timelines = await self._get_member_data(group_id)
        user_name_map = await self._get_user_name_map(group_id)
        imported = 0
        skipped = 0
        errors = []
        for raw_row in raw_rows:
            row_anomalies = anomaly_map.get(raw_row.id, [])
            unresolved = [a for a in row_anomalies if not a.userDecision or a.userDecision == 'SKIP']
            rejected = [a for a in row_anomalies if a.userDecision == 'REJECT']
            if rejected:
                await self.db.rawimportrow.update(where={'id': raw_row.id}, data={'status': 'REJECTED'})
                skipped += 1
                continue
            if unresolved:
                skipped += 1
                continue
            try:
                await self._import_row(raw_row=raw_row, group_id=group_id, batch_id=batch_id, committed_by=committed_by, user_name_map=user_name_map, usd_to_inr_rate=usd_to_inr_rate, member_timelines=timelines)
                imported += 1
                await self.db.rawimportrow.update(where={'id': raw_row.id}, data={'status': 'IMPORTED'})
            except Exception as e:
                errors.append({'row': raw_row.rowNumber, 'error': str(e)})
                skipped += 1
        await self.db.importbatch.update(where={'id': batch_id}, data={'status': 'COMPLETED', 'importedRows': imported, 'completedAt': datetime.utcnow()})
        await self.event_store.append(DomainEvent(aggregate_id=batch_id, aggregate_type=AggregateType.IMPORT, event_type=EventType.IMPORT_COMPLETED, payload={'batch_id': batch_id, 'filename': batch.filename, 'total_rows': batch.totalRows, 'imported_rows': imported, 'anomaly_count': batch.anomalyCount, 'resolved_count': len(anomalies), 'errors': errors}, created_by=committed_by))
        anomaly_summary = {}
        for a in anomalies:
            cat = a.category
            anomaly_summary[cat] = anomaly_summary.get(cat, 0) + 1
        await self.db.projectionimportreport.upsert(where={'batchId': batch_id}, data={'create': {'batchId': batch_id, 'filename': batch.filename, 'totalRows': batch.totalRows, 'importedRows': imported, 'anomalyCount': batch.anomalyCount, 'resolvedCount': len([a for a in anomalies if a.userDecision]), 'pendingCount': len([a for a in anomalies if not a.userDecision]), 'anomalySummary': Json(anomaly_summary)}, 'update': {'importedRows': imported, 'resolvedCount': len([a for a in anomalies if a.userDecision]), 'pendingCount': len([a for a in anomalies if not a.userDecision]), 'anomalySummary': Json(anomaly_summary)}})
        return {'batch_id': batch_id, 'imported_rows': imported, 'skipped_rows': skipped, 'errors': errors}

    async def reject_import(self, batch_id: str, rejected_by: str, reason: Optional[str] = None) -> dict:
        batch = await self.db.importbatch.find_unique(where={'id': batch_id})
        if not batch:
            raise ValueError(f'Batch {batch_id} not found')
        await self.db.importbatch.update(where={'id': batch_id}, data={'status': 'FAILED', 'completedAt': datetime.utcnow()})
        await self.db.rawimportrow.update_many(where={'batchId': batch_id}, data={'status': 'REJECTED'})
        await self.event_store.append(DomainEvent(aggregate_id=batch_id, aggregate_type=AggregateType.IMPORT, event_type=EventType.IMPORT_REJECTED, payload={'batch_id': batch_id, 'filename': batch.filename, 'rejected_by': rejected_by, 'reason': reason}, created_by=rejected_by))
        anomalies = await self.db.anomaly.find_many(where={'batchId': batch_id})
        anomaly_summary = {}
        for a in anomalies:
            cat = a.category
            anomaly_summary[cat] = anomaly_summary.get(cat, 0) + 1
        await self.db.projectionimportreport.upsert(where={'batchId': batch_id}, data={'create': {'batchId': batch_id, 'filename': batch.filename, 'totalRows': batch.totalRows, 'importedRows': 0, 'anomalyCount': batch.anomalyCount, 'resolvedCount': len([a for a in anomalies if a.userDecision]), 'pendingCount': len([a for a in anomalies if not a.userDecision]), 'anomalySummary': Json(anomaly_summary)}, 'update': {'importedRows': 0, 'resolvedCount': len([a for a in anomalies if a.userDecision]), 'pendingCount': len([a for a in anomalies if not a.userDecision]), 'anomalySummary': Json(anomaly_summary)}})
        return {'batch_id': batch_id, 'status': 'REJECTED', 'message': f'Import batch {batch_id} has been rejected.'}

    async def _import_row(self, raw_row, group_id: str, batch_id: str, committed_by: str, user_name_map: dict, usd_to_inr_rate: float, member_timelines: dict):
        row = raw_row.rawData or {}
        description = str(row.get('description', 'Imported Expense')).strip()
        raw_amount = str(row.get('amount', '0')).strip().replace(',', '')
        original_amount = float(raw_amount)
        currency = str(row.get('currency', 'INR') or 'INR').strip().upper()
        if not currency or currency in ['NAN', 'NONE', '']:
            currency = 'INR'
        paid_by_name = str(row.get('paid_by', '')).strip()
        paid_by_canonical = self._normalize_member_name(paid_by_name, user_name_map)
        split_type = str(row.get('split_type', 'equal') or 'equal').strip().lower()
        split_type = SPLIT_TYPE_ALIASES.get(split_type, split_type)
        split_with = str(row.get('split_with', '') or '').strip()
        split_details = str(row.get('split_details', '') or '').strip()
        date_str = str(row.get('date', '')).strip()
        notes = str(row.get('notes', '') or '').strip()
        expense_date = datetime.strptime(date_str, '%Y-%m-%d')
        converted_amount = original_amount
        rate_used = 1.0
        if currency != 'INR':
            converted_amount, rate_used = await convert_to_inr(original_amount, currency, expense_date.date())
        paid_by_id = user_name_map.get(paid_by_canonical.lower())
        if not paid_by_id:
            raise ValueError(f"Cannot find user ID for '{paid_by_name}' (normalized: '{paid_by_canonical}')")
        expense_id = cuid.cuid()
        await self.event_store.append(DomainEvent(aggregate_id=expense_id, aggregate_type=AggregateType.EXPENSE, event_type=EventType.EXPENSE_CREATED, payload={'group_id': group_id, 'description': description, 'amount': converted_amount, 'currency': 'INR', 'original_amount': original_amount if currency != 'INR' else None, 'original_currency': currency if currency != 'INR' else None, 'conversion_rate': rate_used if currency != 'INR' else None, 'paid_by_id': paid_by_id, 'paid_by_name': paid_by_name, 'split_type': split_type.upper(), 'expense_date': date_str, 'is_imported': True, 'import_batch_id': batch_id, 'raw_row_id': raw_row.id, 'notes': notes}, created_by=committed_by))
        splits = self._calculate_splits(split_type=split_type, split_details=split_details, total_amount=converted_amount, user_name_map=user_name_map, split_with=split_with)
        for user_id, split_amount, pct, shares in splits:
            await self.event_store.append(DomainEvent(aggregate_id=expense_id, aggregate_type=AggregateType.EXPENSE, event_type=EventType.EXPENSE_SPLIT_ASSIGNED, payload={'expense_id': expense_id, 'user_id': user_id, 'amount': split_amount, 'percentage': pct, 'shares': shares}, created_by=committed_by))
        if currency != 'INR':
            await self.event_store.append(DomainEvent(aggregate_id=expense_id, aggregate_type=AggregateType.EXPENSE, event_type=EventType.CURRENCY_CONVERSION_APPLIED, payload={'expense_id': expense_id, 'original_amount': original_amount, 'original_currency': currency, 'conversion_rate': rate_used, 'converted_amount': converted_amount, 'conversion_date': date_str}, created_by=committed_by))
        await self.db.projectionexpense.create(data={'id': expense_id, 'groupId': group_id, 'description': description, 'amount': converted_amount, 'currency': 'INR', 'originalAmount': original_amount if currency != 'INR' else None, 'originalCurrency': currency if currency != 'INR' else None, 'conversionRate': rate_used if currency != 'INR' else None, 'paidById': paid_by_id, 'splitType': split_type.upper(), 'expenseDate': expense_date, 'isImported': True, 'importBatchId': batch_id, 'rawRowId': raw_row.id})
        for user_id, split_amount, pct, shares in splits:
            await self.db.projectionexpensesplit.create(data={'expenseId': expense_id, 'userId': user_id, 'amount': split_amount, 'percentage': pct, 'shares': shares})
            await self._update_balance(group_id, user_id, -split_amount)
        await self._update_balance(group_id, paid_by_id, converted_amount)

    def _calculate_splits(self, split_type: str, split_details: str, total_amount: float, user_name_map: dict, split_with: str='') -> list[tuple]:
        results = []
        if split_type == 'equal':
            members = [m.strip() for m in split_with.split(';') if m.strip()]
            if not members:
                members = [m.strip() for m in split_with.split(',') if m.strip()]
            if not members:
                return results
            n = len(members)
            per_person = round(total_amount / n, 2)
            remainder = round(total_amount - per_person * n, 2)
            for i, name in enumerate(members):
                uid = user_name_map.get(name.lower())
                if uid:
                    amt = per_person + (remainder if i == 0 else 0)
                    results.append((uid, amt, None, None))
        elif split_type == 'percentage':
            parts = self._parse_value_parts(split_details)
            for name, value in parts:
                uid = user_name_map.get(name.lower())
                if uid:
                    amt = round(total_amount * value / 100, 2)
                    results.append((uid, amt, value, None))
        elif split_type == 'exact':
            parts = self._parse_value_parts(split_details)
            for name, value in parts:
                uid = user_name_map.get(name.lower())
                if uid:
                    results.append((uid, value, None, None))
        elif split_type == 'shares':
            parts = self._parse_value_parts(split_details)
            total_shares = sum((v for _, v in parts))
            if total_shares > 0:
                for name, sh in parts:
                    uid = user_name_map.get(name.lower())
                    if uid:
                        amt = round(total_amount * sh / total_shares, 2)
                        results.append((uid, amt, None, int(sh)))
        else:
            members = [m.strip() for m in split_with.split(';') if m.strip()]
            if members:
                per_person = round(total_amount / len(members), 2)
                for name in members:
                    uid = user_name_map.get(name.lower())
                    if uid:
                        results.append((uid, per_person, None, None))
        return results

    def _parse_value_parts(self, split_details: str) -> list[tuple[str, float]]:
        import re
        if not split_details or split_details.lower() in ['nan', 'none']:
            return []
        parts = []
        tokens = [t.strip() for t in re.split('[;,]', split_details) if t.strip()]
        for token in tokens:
            match = re.match('^([A-Za-z][A-Za-z\\s]*?)\\s*:?\\s*(\\d+(?:\\.\\d+)?)\\s*%?\\s*$', token)
            if match:
                name = match.group(1).strip()
                value = float(match.group(2))
                parts.append((name, value))
        return parts

    def _normalize_member_name(self, name: str, user_name_map: dict) -> str:
        if not name:
            return name
        lower = name.lower()
        for canonical_lower, uid in user_name_map.items():
            if canonical_lower == lower:
                for k in user_name_map.keys():
                    if k == lower:
                        return name
                break
        return name

    async def _update_balance(self, group_id: str, user_id: str, delta: float):
        existing = await self.db.projectionbalance.find_first(where={'userId': user_id, 'groupId': group_id})
        if existing:
            await self.db.projectionbalance.update(where={'id': existing.id}, data={'netBalance': existing.netBalance + delta})
        else:
            await self.db.projectionbalance.create(data={'userId': user_id, 'groupId': group_id, 'netBalance': delta})

    async def _get_member_data(self, group_id: Optional[str]) -> tuple[list[str], dict]:
        if not group_id:
            users = await self.db.projectionuser.find_many(where={'isActive': True})
            return ([u.name for u in users], {})
        memberships = await self.db.projectionmembership.find_many(where={'groupId': group_id}, include={'user': True})
        members = []
        timelines = {}
        for m in memberships:
            members.append(m.user.name)
            timelines[m.user.name.lower()] = {'joined': m.joinedAt.date() if m.joinedAt else None, 'left': m.leftAt.date() if m.leftAt else None}
        return (members, timelines)

    async def _get_user_name_map(self, group_id: Optional[str]) -> dict:
        users = await self.db.projectionuser.find_many()
        return {u.name.lower(): u.id for u in users}