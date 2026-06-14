import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from prisma import Prisma
from app.database import get_db
from app.auth.service import get_current_user, require_member_or_admin
from app.events.store import EventStore
from app.services.import_pipeline import ImportPipeline
router = APIRouter(prefix='/imports', tags=['Imports'])

class ResolveAnomalyRequest(BaseModel):
    decision: str
    notes: Optional[str] = None

class CommitImportRequest(BaseModel):
    usd_to_inr_rate: float = 83.5

@router.post('/upload', status_code=201)
async def upload_csv(file: UploadFile=File(...), group_id: str=Form(...), db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail='Only CSV files are accepted')
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='File too large (max 10MB)')
    event_store = EventStore(db)
    pipeline = ImportPipeline(db, event_store)
    result = await pipeline.ingest_csv(file_content=content, filename=file.filename, uploaded_by=current_user.id, group_id=group_id)
    return {'batch_id': result['batch_id'], 'total_rows': result['total_rows'], 'message': f"CSV uploaded. {result['total_rows']} rows stored. Run anomaly detection next.", 'next_step': f"POST /imports/{result['batch_id']}/detect-anomalies"}

@router.post('/{batch_id}/detect-anomalies')
async def detect_anomalies(batch_id: str, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    event_store = EventStore(db)
    pipeline = ImportPipeline(db, event_store)
    result = await pipeline.run_anomaly_detection(batch_id)
    return {'batch_id': batch_id, 'total_rows': result['total_rows'], 'anomaly_count': result['anomaly_count'], 'message': f"Anomaly detection complete. {result['anomaly_count']} anomalies found.", 'next_step': f'Review anomalies at GET /imports/{batch_id}/anomalies, then POST /imports/{batch_id}/commit'}

@router.get('/{batch_id}/anomalies')
async def get_batch_anomalies(batch_id: str, severity: Optional[str]=None, category: Optional[str]=None, decided: Optional[bool]=None, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    where = {'batchId': batch_id}
    if severity:
        where['severity'] = severity
    if category:
        where['category'] = category
    if decided is True:
        where['userDecision'] = {'not': None}
    elif decided is False:
        where['userDecision'] = None
    anomalies = await db.anomaly.find_many(where=where, include={'rawRow': True}, order={'severity': 'asc'})
    return [{'id': a.id, 'row_number': a.rowNumber, 'category': a.category, 'severity': a.severity, 'raw_data': a.rawData, 'detected_rule': a.detectedRule, 'suggested_resolution': a.suggestedResolution, 'user_decision': a.userDecision, 'decided_by': a.decidedBy, 'decided_at': a.decidedAt.isoformat() if a.decidedAt else None, 'notes': a.notes} for a in anomalies]

@router.post('/anomalies/{anomaly_id}/resolve')
async def resolve_anomaly(anomaly_id: str, body: ResolveAnomalyRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    valid_decisions = ['APPROVE', 'REJECT', 'MERGE', 'OVERRIDE', 'SKIP']
    if body.decision not in valid_decisions:
        raise HTTPException(status_code=400, detail=f'Decision must be one of: {valid_decisions}')
    event_store = EventStore(db)
    pipeline = ImportPipeline(db, event_store)
    result = await pipeline.resolve_anomaly(anomaly_id=anomaly_id, decision=body.decision, decided_by=current_user.id, notes=body.notes)
    return result

@router.post('/{batch_id}/resolve-all')
async def resolve_all_anomalies(batch_id: str, body: ResolveAnomalyRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    event_store = EventStore(db)
    pipeline = ImportPipeline(db, event_store)
    result = await pipeline.resolve_all_anomalies(batch_id=batch_id, decision=body.decision, decided_by=current_user.id, notes=body.notes)
    return result

@router.post('/{batch_id}/commit')
async def commit_import(batch_id: str, body: CommitImportRequest, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    batch = await db.importbatch.find_unique(where={'id': batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    if batch.status == 'COMPLETED':
        raise HTTPException(status_code=400, detail='Batch already committed')
    event_store = EventStore(db)
    pipeline = ImportPipeline(db, event_store)
    result = await pipeline.commit_import(batch_id=batch_id, committed_by=current_user.id, group_id=batch.groupId, usd_to_inr_rate=body.usd_to_inr_rate)
    return result

@router.post('/{batch_id}/reject')
async def reject_import_batch(batch_id: str, db: Prisma=Depends(get_db), current_user=Depends(require_member_or_admin)):
    batch = await db.importbatch.find_unique(where={'id': batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    if batch.status in ['COMPLETED', 'FAILED']:
        raise HTTPException(status_code=400, detail=f'Cannot reject batch in status {batch.status}')
    event_store = EventStore(db)
    pipeline = ImportPipeline(db, event_store)
    result = await pipeline.reject_import(batch_id=batch_id, rejected_by=current_user.id)
    return result

@router.get('/')
async def list_import_batches(db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    batches = await db.importbatch.find_many(order={'startedAt': 'desc'})
    return [{'id': b.id, 'filename': b.filename, 'status': b.status, 'total_rows': b.totalRows, 'valid_rows': b.validRows, 'anomaly_count': b.anomalyCount, 'imported_rows': b.importedRows, 'started_at': b.startedAt.isoformat(), 'completed_at': b.completedAt.isoformat() if b.completedAt else None} for b in batches]

@router.get('/{batch_id}')
async def get_import_batch(batch_id: str, db: Prisma=Depends(get_db), current_user=Depends(get_current_user)):
    batch = await db.importbatch.find_unique(where={'id': batch_id})
    if not batch:
        raise HTTPException(status_code=404, detail='Batch not found')
    anomaly_summary = {}
    anomalies = await db.anomaly.find_many(where={'batchId': batch_id})
    for a in anomalies:
        anomaly_summary[a.category] = anomaly_summary.get(a.category, 0) + 1
    return {'id': batch.id, 'filename': batch.filename, 'status': batch.status, 'total_rows': batch.totalRows, 'anomaly_count': batch.anomalyCount, 'imported_rows': batch.importedRows, 'anomaly_summary': anomaly_summary, 'started_at': batch.startedAt.isoformat(), 'completed_at': batch.completedAt.isoformat() if batch.completedAt else None}