# SCOPE — Anomaly Log & Database Schema

## Anomaly Log: expenses_export.csv

Every data problem found in the CSV and how the system handles it.

---

### Row-by-Row Anomaly Inventory

| Row | Description | Anomaly Category | Severity | Policy / Resolution |
|-----|-------------|-----------------|----------|---------------------|
| 5 | Dinner at Marina Bites | `MEMBER_NOT_ACTIVE` | MEDIUM | STRICT policy: Dev is not active in Feb (joined May 1). Excluded from split or reject row. |
| 6 | dinner - marina bites | `MEMBER_NOT_ACTIVE` & `DUPLICATE_EXPENSE` | MEDIUM/HIGH | Discard row as duplicate of Row 5. |
| 7 | Electricity Feb | `AMOUNT_FORMAT` | MEDIUM | Auto-parse comma formatting (₹1,200 -> ₹1200.0). |
| 9 | Movie night snacks | `NAME_CASE_MISMATCH` | LOW | Auto-normalize payer name case (`priya` -> `Priya`). |
| 11 | Groceries DMart | `UNKNOWN_MEMBER` | HIGH | User maps unknown name "Priya S" to known member "Priya". |
| 12 | Aisha birthday cake | `NONSTANDARD_SPLIT_TYPE` | MEDIUM | Map split_type "unequal" to standard "exact" split. |
| 13 | House cleaning supplies | `MISSING_PAYER` & `SETTLEMENT_AS_EXPENSE` | CRITICAL/HIGH | Discard row due to missing payer. |
| 14 | Rohan paid Aisha back | `SETTLEMENT_AS_EXPENSE` | HIGH | Discard as expense; user logs separately as a Settlement. |
| 15 | Pizza Friday | `SPLIT_MISMATCH` | HIGH | Percentages sum to 110% mismatch; discard row. |
| 16 | March rent | `INVALID_DATE` | HIGH | Auto-parse date format (`01/03/2026` -> `2026-03-01`). |
| 17 | Groceries BigBasket | `INVALID_DATE` | HIGH | Auto-parse date format (`03/03/2026` -> `2026-03-03`). Meera was active on March 3. |
| 20 | Goa villa booking | `CURRENCY_MISMATCH` & `INVALID_DATE` & `MEMBER_NOT_ACTIVE` | MEDIUM/HIGH | Discard row as Dev is not active in March. |
| 21 | Beach shack lunch | `CURRENCY_MISMATCH` & `INVALID_DATE` & `MEMBER_NOT_ACTIVE` | MEDIUM/HIGH | Convert USD ($84) via Frankfurter live historical rate on exact date. Exclude inactive Dev. |
| 22 | Scooter rentals | `NONSTANDARD_SPLIT_TYPE` & `INVALID_DATE` & `MEMBER_NOT_ACTIVE` | MEDIUM/HIGH | Map split_type "share" to standard "shares". Exclude inactive Dev. |
| 23 | Parasailing | `UNKNOWN_MEMBER` & `CURRENCY_MISMATCH` & `INVALID_DATE` & `MEMBER_NOT_ACTIVE` | HIGH/MEDIUM | Discard due to unregistered participant "Kabir" in split list and inactive Dev. |
| 24 | Dinner at Thalassa | `CONFLICTING_DUPLICATES` & `INVALID_DATE` | HIGH | Keep first entry (Aisha). |
| 25 | Thalassa dinner | `INVALID_DATE` | HIGH | Discard duplicate entry (Rohan). |
| 26 | Parasailing refund | `NEGATIVE_AMOUNT` & `CURRENCY_MISMATCH` & `INVALID_DATE` & `MEMBER_NOT_ACTIVE` | MEDIUM/HIGH | Convert USD ($30 refund) via Frankfurter API. Import as negative refund credit. Exclude inactive Dev. |
| 27 | Airport cab | `NAME_CASE_MISMATCH` & `INVALID_DATE` | LOW/HIGH | Parse date format (`Mar 14` -> `2026-03-14`) and normalize name (`rohan ` -> `Rohan`). |
| 28 | Groceries DMart | `MISSING_CURRENCY` & `INVALID_DATE` | HIGH | Auto-assume group default currency (INR). |
| 31 | Dinner order Swiggy | `ZERO_AMOUNT` & `INVALID_DATE` | MEDIUM/HIGH | Discard zero-amount row. |
| 32 | Weekend brunch | `SPLIT_MISMATCH` & `INVALID_DATE` | HIGH | Percentages sum to 110% mismatch; discard row. |
| 36 | Groceries BigBasket | `MEMBER_NOT_ACTIVE` | MEDIUM | Exclude Meera under STRICT policy (left March 31, date is April 2). |
| 38 | Sam deposit share | `SETTLEMENT_AS_EXPENSE` | HIGH | Discard as expense; user logs separately as a Settlement. |
| 39 | Housewarming drinks | `MEMBER_NOT_ACTIVE` | MEDIUM | Sam not active on April 10 (joined April 15); exclude Sam or reject row. |
| 40 | Electricity Apr | `MEMBER_NOT_ACTIVE` | MEDIUM | Sam not active on April 12 (joined April 15); exclude Sam or reject row. |
| 42 | Furniture | `NONSTANDARD_SPLIT_TYPE` | MEDIUM | split_type equal has shares split_details; verify and override. |

---

## Anomaly Resolution Policies

### DUPLICATE_EXPENSE
- **Keep Both**: Both rows become separate expenses. Only if the user confirms they are genuinely different events.
- **Merge**: The first row is imported; the second is discarded. Decision is recorded as a `AnomalyResolved` event.
- **Discard Row**: The flagged row is rejected. Raw data is preserved in `raw_import_rows` forever.

### NEGATIVE_AMOUNT
- **Approve as Refund**: Row is imported as an expense with negative amount (reduces group total).
- **Reject**: Row is discarded.

### INVALID_DATE
- **Override**: User provides correct date. A `ExpenseCorrected` event records the old and new values.
- **Reject**: Row is discarded.

### UNKNOWN_MEMBER
- **Map to Existing Member**: User specifies which existing user this name refers to.
- **Reject**: Row is discarded.

### SETTLEMENT_AS_EXPENSE
- **Convert to Settlement**: Row becomes a `SettlementRecorded` event, not `ExpenseCreated`.
- **Reject**: Row is discarded. (Never silently ignored.)

### CURRENCY_MISMATCH
- **Apply Currency Conversion**: System uses the historical rate for the expense date. A `CurrencyConversionApplied` event is generated storing: original_amount, currency, rate, converted_amount.
- **Override Amount**: User provides the correct INR amount manually.

### MEMBER_NOT_ACTIVE
- **Override with INCLUSIVE Policy**: Include the member anyway. Requires explicit approval.
- **Exclude Member**: Member is removed from the split. Remaining members split the full amount.

### SPLIT_MISMATCH
- **Recalculate**: User corrects the split values.
- **Reject**: Row is discarded.

### ZERO_AMOUNT
- **Reject**: Zero-amount expenses cannot be split. Row is discarded.

### MISSING_PAYER
- **Specify Payer**: User selects which member paid.
- **Reject**: Row is discarded.

---

## Key Data Decisions

### Sam's Requirement
> "I moved in mid-April. Why would March electricity affect my balance?"

**Decision**: With STRICT membership policy (default), only members active on the expense date are included in splits. Sam joined April 15. Any expense dated before April 15 that includes Sam in the split_details is flagged with `MEMBER_NOT_ACTIVE`. 

If approved by the user (override), Sam is included. If rejected, the expense is split only among the active members at that date.

### Meera's Requirement
> "Clean up the duplicates — but I want to approve anything the app deletes or changes."

**Decision**: The system NEVER auto-deletes. Every anomaly requires a user decision:
- The raw CSV row is stored in `raw_import_rows` table PERMANENTLY.
- Every decision (Approve/Reject/Merge) generates an `AnomalyResolved` event with the user's ID and timestamp.
- The audit trail is always viewable.

### Priya's Requirement
> "Half the trip was in dollars. The sheet pretends a dollar is a rupee. That can't be right."

**Decision**: USD amounts are detected as `CURRENCY_MISMATCH`. When approved, the system converts using the live historical exchange rate for the exact expense date (fetched from Frankfurter API). The `CurrencyConversionApplied` event stores all conversion metadata. Historical expenses are NEVER recalculated with future exchange rates.

---

## Database Schema

### Core Event Infrastructure

```
event_store
├── id (PK)
├── aggregate_id          # ID of the entity this event belongs to
├── aggregate_type        # User | Group | Expense | Settlement | Import
├── event_type            # UserRegistered | ExpenseCreated | etc.
├── event_version         # Event schema version
├── event_payload (JSON)  # Full event data
├── created_at
└── created_by            # User who triggered the event
```

### Import Infrastructure

```
import_batches
├── id (PK)
├── filename
├── uploaded_by
├── total_rows, valid_rows, anomaly_count, imported_rows
├── status        # PENDING → PROCESSING → REVIEW → COMPLETED | FAILED
├── started_at, completed_at
└── group_id

raw_import_rows          # All CSV rows stored as-is, NEVER deleted
├── id (PK)
├── batch_id → import_batches
├── row_number
├── raw_data (JSON)
├── status        # PENDING → APPROVED | REJECTED | IMPORTED
└── processed_at

anomalies
├── id (PK)
├── batch_id → import_batches
├── raw_row_id → raw_import_rows
├── row_number
├── category      # AnomalyCategory enum
├── severity      # LOW | MEDIUM | HIGH | CRITICAL
├── raw_data (JSON)
├── detected_rule
├── suggested_resolution
├── user_decision # APPROVE | REJECT | MERGE | OVERRIDE | SKIP | NULL (pending)
├── decided_by, decided_at
└── notes
```

### Projection Tables (Read Models)

```
projection_users
├── id (PK)
├── email (UNIQUE)
├── name
├── password_hash
├── role           # ADMIN | MEMBER | VIEWER
└── is_active

projection_groups
├── id (PK)
├── name
├── description
├── membership_policy  # STRICT | INCLUSIVE
└── created_by

projection_memberships  ← Temporal membership (the key table)
├── id (PK)
├── user_id → projection_users
├── group_id → projection_groups
├── joined_at          # Date member joined
├── left_at            # Date member left (NULL = still active)
├── is_active
└── added_by

projection_expenses
├── id (PK)
├── group_id
├── description
├── amount             # Always in INR (converted)
├── currency           # Always INR post-conversion
├── original_amount    # USD amount before conversion (if applicable)
├── original_currency
├── conversion_rate    # Rate used at import time (never changes)
├── paid_by_id
├── split_type         # EQUAL | PERCENTAGE | EXACT | SHARES | CUSTOM
├── expense_date
├── is_imported
├── import_batch_id
└── is_settlement

projection_expense_splits
├── id (PK)
├── expense_id → projection_expenses
├── user_id
├── amount             # Amount this user owes for this expense
├── percentage         # If percentage split
└── shares             # If shares split

projection_balances
├── id (PK)
├── user_id
├── group_id
└── net_balance        # positive = owed to user; negative = user owes

projection_import_reports
├── id (PK)
├── batch_id (UNIQUE)
├── filename
├── total_rows, imported_rows, anomaly_count
├── resolved_count, pending_count
└── anomaly_summary (JSON)  # {category: count} breakdown
```

---

## Event Catalog

| Event | Aggregate | When |
|-------|-----------|------|
| `UserRegistered` | User | New user signs up |
| `GroupCreated` | Group | Admin creates a group |
| `MemberJoinedGroup` | Group | Member added to group |
| `MemberLeftGroup` | Group | Member removed from group |
| `ExpenseCreated` | Expense | New expense recorded |
| `ExpenseSplitAssigned` | Expense | One split assigned (one per participant) |
| `ExpenseCorrected` | Expense | Field corrected post-import |
| `ExpenseImported` | Expense | Row imported from CSV |
| `CurrencyConversionApplied` | Expense | USD converted to INR |
| `SettlementRecorded` | Settlement | Debt payment recorded |
| `ImportStarted` | Import | CSV upload begins |
| `AnomalyDetected` | Import | Rule triggered for a row |
| `AnomalyResolved` | Import | User makes a decision |
| `ImportCompleted` | Import | All rows processed |
| `ImportRejected` | Import | CSV import batch aborted or rejected by user |
| `ProjectionRebuilt` | System | Database projections rebuilt from event log |
| `BalanceRecomputed` | System | Group net balances re-calculated from expense splits |

