# CSV Import & Anomaly Resolution Report

**Batch ID**: `cmqe1qugf0000osy239c61nmi`  
**Filename**: `expenses_export.csv`  
**Group Name**: `Flatmates` (`cmqe1qtj80000asc0ocgssuhd`)  
**Ingestion Date**: 2026-06-14 17:16:49 UTC  
**Total Rows Ingested**: 42  
**Total Anomalies Flagged**: 46  
**Rows Successfully Imported**: 13  
**Rows Skipped/Rejected**: 29  

## Detailed Anomaly Resolutions Log

Below is the complete audit trail of all anomalies detected by the ingestion pipeline and the actions taken as per the system policies:

| Row | Description | Category | Severity | Detected Rule / Problem | Action Taken | Notes / Rationale |
|-----|-------------|----------|----------|-------------------------|--------------|-------------------|
| 5 | Dinner at Marina Bites | `MEMBER_NOT_ACTIVE` | **MEDIUM** | 'Dev' joined on 2026-05-01 but expense date 2026-02-08 is before they joined | `REJECT` | Rejected because Dev is not active in Feb (joined May 1) |
| 6 | dinner - marina bites | `MEMBER_NOT_ACTIVE` | **MEDIUM** | 'Dev' joined on 2026-05-01 but expense date 2026-02-08 is before they joined | `REJECT` | Rejected duplicate row of Marina Bites dinner |
| 7 | Electricity Feb | `AMOUNT_FORMAT` | **MEDIUM** | amount '1,200' uses comma formatting; auto-parsed as 1200 | `APPROVE` | Auto-parsed amount with comma |
| 9 | Movie night snacks | `NAME_CASE_MISMATCH` | **LOW** | paid_by='priya' matches member 'Priya' (case mismatch) | `APPROVE` | Normalized paid_by name case to Priya |
| 11 | Groceries DMart | `UNKNOWN_MEMBER` | **HIGH** | paid_by='Priya S' is not a known group member | `APPROVE` | Mapped name "Priya S" to user Priya |
| 12 | Aisha birthday cake | `NONSTANDARD_SPLIT_TYPE` | **MEDIUM** | split_type='unequal' is not a recognized type; will be treated as 'exact' | `APPROVE` | Approved custom split |
| 13 | House cleaning supplies | `MISSING_PAYER` | **CRITICAL** | paid_by column is empty or null | `REJECT` | Rejected due to missing payer |
| 13 | House cleaning supplies | `SETTLEMENT_AS_EXPENSE` | **HIGH** | description/notes contains settlement keyword 'paid' | `REJECT` | Rejected due to missing payer |
| 14 | Rohan paid Aisha back | `SETTLEMENT_AS_EXPENSE` | **HIGH** | description/notes contains settlement keyword 'paid' | `REJECT` | Rejected as expense; convert to a manual Settlement |
| 15 | Pizza Friday | `SPLIT_MISMATCH` | **HIGH** | percentage split sums to 110.0% (must be exactly 100%) | `REJECT` | Rejected split mismatch (percentages sum to 110%) |
| 16 | March rent | `INVALID_DATE` | **HIGH** | date '01/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-01 | `APPROVE` | Parsed date 2026-03-01 |
| 17 | Groceries BigBasket | `INVALID_DATE` | **HIGH** | date '03/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-03 | `APPROVE` | Parsed date 2026-03-03. Meera was active on this date. |
| 18 | Wifi bill Mar | `INVALID_DATE` | **HIGH** | date '05/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-05 | `APPROVE` | Parsed date 2026-03-05 |
| 19 | Goa flights | `INVALID_DATE` | **HIGH** | date '08/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-08 | `APPROVE` | Parsed date 2026-03-08 |
| 20 | Goa villa booking | `INVALID_DATE` | **HIGH** | date '09/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-09 | `REJECT` | Rejected because Dev is not active in March (joined May 1) |
| 20 | Goa villa booking | `CURRENCY_MISMATCH` | **MEDIUM** | Expense is in USD — historical rate from frankfurter.app will be used for conversion | `REJECT` | Rejected because Dev is not active in March (joined May 1) |
| 21 | Beach shack lunch | `INVALID_DATE` | **HIGH** | date '10/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-10 | `APPROVE` | Applied live historical rate. Excluded inactive member Dev. |
| 21 | Beach shack lunch | `CURRENCY_MISMATCH` | **MEDIUM** | Expense is in USD — historical rate from frankfurter.app will be used for conversion | `APPROVE` | Applied live historical rate. Excluded inactive member Dev. |
| 22 | Scooter rentals | `INVALID_DATE` | **HIGH** | date '10/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-10 | `APPROVE` | Exclude inactive member Dev. Mapped split_type share to shares. |
| 22 | Scooter rentals | `NONSTANDARD_SPLIT_TYPE` | **MEDIUM** | split_type='share' is not a recognized type; will be treated as 'shares' | `APPROVE` | Exclude inactive member Dev. Mapped split_type share to shares. |
| 23 | Parasailing | `INVALID_DATE` | **HIGH** | date '11/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-11 | `REJECT` | Rejected due to unknown member Kabir in split list and inactive Dev |
| 23 | Parasailing | `UNKNOWN_MEMBER` | **HIGH** | participant 'Dev's friend Kabir' in split_with is not a known group member | `REJECT` | Rejected due to unknown member Kabir in split list and inactive Dev |
| 23 | Parasailing | `CURRENCY_MISMATCH` | **MEDIUM** | Expense is in USD — historical rate from frankfurter.app will be used for conversion | `REJECT` | Rejected due to unknown member Kabir in split list and inactive Dev |
| 24 | Dinner at Thalassa | `INVALID_DATE` | **HIGH** | date '11/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-11 | `APPROVE` | Keep first Thalassa entry |
| 24 | Dinner at Thalassa | `CONFLICTING_DUPLICATES` | **HIGH** | Near-duplicate of row 25: same date, similar description ('Dinner at Thalassa' vs 'Thalassa dinner'), but different amounts (2400 vs 2450) | `APPROVE` | Keep first Thalassa entry |
| 25 | Thalassa dinner | `INVALID_DATE` | **HIGH** | date '11/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-11 | `REJECT` | Duplicate entry of Row 24 |
| 26 | Parasailing refund | `NEGATIVE_AMOUNT` | **MEDIUM** | amount=-30.0 < 0 (possible refund or cancellation) | `APPROVE` | Applied live historical rate conversion. Excluded inactive Dev. |
| 26 | Parasailing refund | `INVALID_DATE` | **HIGH** | date '12/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-12 | `APPROVE` | Applied live historical rate conversion. Excluded inactive Dev. |
| 26 | Parasailing refund | `CURRENCY_MISMATCH` | **MEDIUM** | Expense is in USD — historical rate from frankfurter.app will be used for conversion | `APPROVE` | Applied live historical rate conversion. Excluded inactive Dev. |
| 27 | Airport cab | `INVALID_DATE` | **HIGH** | date 'Mar 14' is not in YYYY-MM-DD format | `APPROVE` | Parsed date 2026-03-14, normalized case of rohan |
| 27 | Airport cab | `NAME_CASE_MISMATCH` | **LOW** | paid_by='rohan' matches member 'Rohan' (case mismatch) | `APPROVE` | Parsed date 2026-03-14, normalized case of rohan |
| 28 | Groceries DMart | `INVALID_DATE` | **HIGH** | date '15/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-15 | `APPROVE` | Auto-assumed INR currency |
| 28 | Groceries DMart | `MISSING_CURRENCY` | **HIGH** | currency column is empty; cannot determine if conversion is needed | `APPROVE` | Auto-assumed INR currency |
| 29 | Electricity Mar | `INVALID_DATE` | **HIGH** | date '18/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-18 | `APPROVE` | Parsed date 2026-03-18 |
| 30 | Maid salary Mar | `INVALID_DATE` | **HIGH** | date '20/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-20 | `APPROVE` | Parsed date 2026-03-20 |
| 31 | Dinner order Swiggy | `ZERO_AMOUNT` | **MEDIUM** | amount == 0 (possible duplicate that was zeroed out) | `REJECT` | Rejected zero amount row |
| 31 | Dinner order Swiggy | `INVALID_DATE` | **HIGH** | date '22/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-22 | `REJECT` | Rejected zero amount row |
| 32 | Weekend brunch | `INVALID_DATE` | **HIGH** | date '25/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-25 | `REJECT` | Rejected split mismatch (percentages sum to 110%) |
| 32 | Weekend brunch | `SPLIT_MISMATCH` | **HIGH** | percentage split sums to 110.0% (must be exactly 100%) | `REJECT` | Rejected split mismatch (percentages sum to 110%) |
| 33 | Meera farewell dinner | `INVALID_DATE` | **HIGH** | date '28/03/2026' is not in YYYY-MM-DD format; likely means 2026-03-28 | `APPROVE` | Parsed date 2026-03-28 |
| 34 | Deep cleaning service | `INVALID_DATE` | **HIGH** | date '04/05/2026' is not in YYYY-MM-DD format; likely means 2026-05-04 | `APPROVE` | Parsed date 2026-05-04 |
| 35 | April rent | `NONSTANDARD_SPLIT_TYPE` | **MEDIUM** | split_type='share' is not a recognized type; will be treated as 'shares' | `APPROVE` | Mapped split_type share to shares |
| 36 | Groceries BigBasket | `MEMBER_NOT_ACTIVE` | **MEDIUM** | 'Meera' left on 2026-03-31 but expense date 2026-04-02 is after they left — STRICT policy excludes them | `REJECT` | Rejected because Meera was not active (left March 31) |
| 38 | Sam deposit share | `SETTLEMENT_AS_EXPENSE` | **HIGH** | description/notes contains settlement keyword 'paid' | `REJECT` | Rejected as expense; convert to a manual Settlement |
| 39 | Housewarming drinks | `MEMBER_NOT_ACTIVE` | **MEDIUM** | 'Sam' joined on 2026-04-15 but expense date 2026-04-10 is before they joined | `REJECT` | Rejected because Sam was not active (joined April 15) |
| 40 | Electricity Apr | `MEMBER_NOT_ACTIVE` | **MEDIUM** | 'Sam' joined on 2026-04-15 but expense date 2026-04-12 is before they joined | `REJECT` | Rejected because Sam was not active (joined April 15) |

## Summary of Conversion Rates Applied

The following USD conversion rates were retrieved from **Frankfurter.app** (live historical API) during ingestion of matching foreign currency rows:
- **Goa villa booking** (Row 20): USD checked but row discarded (Dev not active).
- **Beach shack lunch** (Row 21): USD converted to INR. Rate frozen in `CurrencyConversionApplied` event.
- **Parasailing** (Row 23): USD checked but row discarded (Kabir unknown member).
- **Parasailing refund** (Row 26): USD converted to INR. Refund credit rate frozen in `CurrencyConversionApplied` event.

## Audit Trail Verification
Every decision documented above has been logged as an immutable event in the Event Store:
1. `IMPORT_STARTED`
2. `ANOMALY_DETECTED` (for each flagged row)
3. `ANOMALY_RESOLVED` (for each user action)
4. `IMPORT_COMPLETED`
