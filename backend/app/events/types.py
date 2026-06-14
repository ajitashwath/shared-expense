from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel
from datetime import datetime

class EventType(str, Enum):
    USER_REGISTERED = 'UserRegistered'
    USER_UPDATED = 'UserUpdated'
    USER_DEACTIVATED = 'UserDeactivated'
    GROUP_CREATED = 'GroupCreated'
    GROUP_UPDATED = 'GroupUpdated'
    GROUP_DELETED = 'GroupDeleted'
    MEMBER_JOINED_GROUP = 'MemberJoinedGroup'
    MEMBER_LEFT_GROUP = 'MemberLeftGroup'
    MEMBERSHIP_POLICY_CHANGED = 'MembershipPolicyChanged'
    EXPENSE_CREATED = 'ExpenseCreated'
    EXPENSE_SPLIT_ASSIGNED = 'ExpenseSplitAssigned'
    EXPENSE_CORRECTED = 'ExpenseCorrected'
    EXPENSE_DELETED = 'ExpenseDeleted'
    EXPENSE_IMPORTED = 'ExpenseImported'
    CURRENCY_CONVERSION_APPLIED = 'CurrencyConversionApplied'
    SETTLEMENT_RECORDED = 'SettlementRecorded'
    IMPORT_STARTED = 'ImportStarted'
    IMPORT_ROW_PROCESSED = 'ImportRowProcessed'
    ANOMALY_DETECTED = 'AnomalyDetected'
    ANOMALY_RESOLVED = 'AnomalyResolved'
    IMPORT_COMPLETED = 'ImportCompleted'
    IMPORT_REJECTED = 'ImportRejected'
    PROJECTION_REBUILT = 'ProjectionRebuilt'
    BALANCE_RECOMPUTED = 'BalanceRecomputed'

class AggregateType(str, Enum):
    USER = 'User'
    GROUP = 'Group'
    EXPENSE = 'Expense'
    SETTLEMENT = 'Settlement'
    IMPORT = 'Import'

class DomainEvent(BaseModel):
    aggregate_id: str
    aggregate_type: AggregateType
    event_type: EventType
    payload: dict[str, Any]
    created_by: Optional[str] = None

    class Config:
        use_enum_values = True

class UserRegisteredPayload(BaseModel):
    name: str
    email: str
    role: str

class GroupCreatedPayload(BaseModel):
    name: str
    description: Optional[str]
    membership_policy: str
    created_by: str

class MemberJoinedGroupPayload(BaseModel):
    user_id: str
    user_name: str
    group_id: str
    joined_at: str

class MemberLeftGroupPayload(BaseModel):
    user_id: str
    user_name: str
    group_id: str
    left_at: str

class ExpenseCreatedPayload(BaseModel):
    group_id: str
    description: str
    amount: float
    currency: str
    paid_by_id: str
    paid_by_name: str
    split_type: str
    expense_date: str
    is_imported: bool = False

class ExpenseSplitAssignedPayload(BaseModel):
    expense_id: str
    user_id: str
    user_name: str
    amount: float
    percentage: Optional[float] = None
    shares: Optional[int] = None

class ExpenseCorrectedPayload(BaseModel):
    expense_id: str
    field: str
    old_value: Any
    new_value: Any
    reason: str

class CurrencyConversionAppliedPayload(BaseModel):
    expense_id: str
    original_amount: float
    original_currency: str
    conversion_rate: float
    converted_amount: float
    conversion_date: str

class SettlementRecordedPayload(BaseModel):
    group_id: str
    from_user_id: str
    from_user_name: str
    to_user_id: str
    to_user_name: str
    amount: float
    settlement_date: str
    notes: Optional[str] = None

class AnomalyDetectedPayload(BaseModel):
    batch_id: str
    row_number: int
    category: str
    severity: str
    detected_rule: str
    raw_data: dict
    suggested_resolution: str

class AnomalyResolvedPayload(BaseModel):
    anomaly_id: str
    batch_id: str
    row_number: int
    user_decision: str
    resolved_by: str
    notes: Optional[str] = None

class ImportCompletedPayload(BaseModel):
    batch_id: str
    filename: str
    total_rows: int
    imported_rows: int
    anomaly_count: int
    resolved_count: int

class ImportRejectedPayload(BaseModel):
    batch_id: str
    filename: str
    rejected_by: str
    reason: Optional[str] = None

class ProjectionRebuiltPayload(BaseModel):
    group_id: str
    rebuilt_by: str
    rebuilt_at: str
    scope: str

class BalanceRecomputedPayload(BaseModel):
    group_id: str
    recomputed_by: str
    recomputed_at: str
    active_member_count: int