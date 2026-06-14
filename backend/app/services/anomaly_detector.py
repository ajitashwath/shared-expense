from dataclasses import dataclass, field
from typing import Optional, Any
from datetime import datetime, date
from enum import Enum
import re

class AnomalyCategory(str, Enum):
    DUPLICATE_EXPENSE = 'DUPLICATE_EXPENSE'
    NEGATIVE_AMOUNT = 'NEGATIVE_AMOUNT'
    INVALID_DATE = 'INVALID_DATE'
    UNKNOWN_MEMBER = 'UNKNOWN_MEMBER'
    SETTLEMENT_AS_EXPENSE = 'SETTLEMENT_AS_EXPENSE'
    CURRENCY_MISMATCH = 'CURRENCY_MISMATCH'
    MEMBER_NOT_ACTIVE = 'MEMBER_NOT_ACTIVE'
    EMPTY_DESCRIPTION = 'EMPTY_DESCRIPTION'
    SPLIT_MISMATCH = 'SPLIT_MISMATCH'
    CONFLICTING_DUPLICATES = 'CONFLICTING_DUPLICATES'
    ZERO_AMOUNT = 'ZERO_AMOUNT'
    MISSING_PAYER = 'MISSING_PAYER'
    AMOUNT_FORMAT = 'AMOUNT_FORMAT'
    NONSTANDARD_SPLIT_TYPE = 'NONSTANDARD_SPLIT_TYPE'
    MISSING_CURRENCY = 'MISSING_CURRENCY'
    NAME_CASE_MISMATCH = 'NAME_CASE_MISMATCH'

class Severity(str, Enum):
    LOW = 'LOW'
    MEDIUM = 'MEDIUM'
    HIGH = 'HIGH'
    CRITICAL = 'CRITICAL'
SEVERITY_MAP = {AnomalyCategory.DUPLICATE_EXPENSE: Severity.HIGH, AnomalyCategory.NEGATIVE_AMOUNT: Severity.MEDIUM, AnomalyCategory.INVALID_DATE: Severity.HIGH, AnomalyCategory.UNKNOWN_MEMBER: Severity.HIGH, AnomalyCategory.SETTLEMENT_AS_EXPENSE: Severity.HIGH, AnomalyCategory.CURRENCY_MISMATCH: Severity.MEDIUM, AnomalyCategory.MEMBER_NOT_ACTIVE: Severity.MEDIUM, AnomalyCategory.EMPTY_DESCRIPTION: Severity.LOW, AnomalyCategory.SPLIT_MISMATCH: Severity.HIGH, AnomalyCategory.CONFLICTING_DUPLICATES: Severity.HIGH, AnomalyCategory.ZERO_AMOUNT: Severity.MEDIUM, AnomalyCategory.MISSING_PAYER: Severity.CRITICAL, AnomalyCategory.AMOUNT_FORMAT: Severity.MEDIUM, AnomalyCategory.NONSTANDARD_SPLIT_TYPE: Severity.MEDIUM, AnomalyCategory.MISSING_CURRENCY: Severity.HIGH, AnomalyCategory.NAME_CASE_MISMATCH: Severity.LOW}
RESOLUTION_MAP = {AnomalyCategory.DUPLICATE_EXPENSE: 'Keep Both, Merge, or Discard Row', AnomalyCategory.NEGATIVE_AMOUNT: 'Approve as Refund or Reject', AnomalyCategory.INVALID_DATE: 'Correct Date or Reject Row', AnomalyCategory.UNKNOWN_MEMBER: 'Map to Existing Member or Reject', AnomalyCategory.SETTLEMENT_AS_EXPENSE: 'Convert to Settlement or Reject', AnomalyCategory.CURRENCY_MISMATCH: 'Apply Currency Conversion at Historical Rate or Override Amount', AnomalyCategory.MEMBER_NOT_ACTIVE: 'Override with INCLUSIVE Policy or Exclude Member', AnomalyCategory.EMPTY_DESCRIPTION: 'Add Description or Import as-is', AnomalyCategory.SPLIT_MISMATCH: 'Recalculate Split or Reject Row', AnomalyCategory.CONFLICTING_DUPLICATES: 'Keep One, Merge, or Keep Both', AnomalyCategory.ZERO_AMOUNT: 'Correct Amount or Reject Row', AnomalyCategory.MISSING_PAYER: 'Specify Payer or Reject Row', AnomalyCategory.AMOUNT_FORMAT: 'Auto-parse comma-formatted amount or Reject Row', AnomalyCategory.NONSTANDARD_SPLIT_TYPE: 'Map to standard split type (equal/percentage/exact/shares) or Reject', AnomalyCategory.MISSING_CURRENCY: 'Assume INR or Specify Currency', AnomalyCategory.NAME_CASE_MISMATCH: 'Normalize name to correct case or Reject'}
SPLIT_TYPE_ALIASES = {'unequal': 'exact', 'share': 'shares'}
CANONICAL_SPLIT_TYPES = {'equal', 'percentage', 'exact', 'shares', 'custom', 'settlement'}

@dataclass
class DetectedAnomaly:
    row_number: int
    category: AnomalyCategory
    severity: Severity
    detected_rule: str
    raw_data: dict
    suggested_resolution: str
    conflicting_row_number: Optional[int] = None
    extra: dict = field(default_factory=dict)

class AnomalyDetector:
    SETTLEMENT_KEYWORDS = ['paid', 'settled', 'settlement', 'owes', 'repaid', 'cleared', 'transferred', 'reimburse', 'reimbursed', 'payback', 'pay back']
    SUPPORTED_CURRENCIES = {'INR', 'USD', 'EUR', 'GBP'}
    BASE_CURRENCY = 'INR'

    def __init__(self, known_members: list[str], member_timelines: dict[str, dict], all_rows: list[dict]):
        self.known_members_raw = known_members
        self.known_members_lower = {m.lower() for m in known_members}
        self.known_members_map = {m.lower(): m for m in known_members}
        self.member_timelines = {k.lower(): v for k, v in member_timelines.items()}
        self.all_rows = all_rows

    def detect_all(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        anomalies: list[DetectedAnomaly] = []
        anomalies.extend(self.check_amount_format(row, row_number))
        anomalies.extend(self.check_missing_payer(row, row_number))
        anomalies.extend(self.check_zero_amount(row, row_number))
        anomalies.extend(self.check_negative_amount(row, row_number))
        anomalies.extend(self.check_invalid_date(row, row_number))
        anomalies.extend(self.check_empty_description(row, row_number))
        anomalies.extend(self.check_missing_currency(row, row_number))
        anomalies.extend(self.check_name_case_mismatch(row, row_number))
        anomalies.extend(self.check_unknown_member(row, row_number))
        anomalies.extend(self.check_settlement_as_expense(row, row_number))
        anomalies.extend(self.check_currency_mismatch(row, row_number))
        anomalies.extend(self.check_nonstandard_split_type(row, row_number))
        anomalies.extend(self.check_split_mismatch(row, row_number))
        anomalies.extend(self.check_duplicate_expense(row, row_number))
        anomalies.extend(self.check_conflicting_duplicates(row, row_number))
        anomalies.extend(self.check_member_not_active(row, row_number))
        return anomalies

    def check_amount_format(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        raw_amount = str(row.get('amount', '')).strip()
        if ',' in raw_amount:
            cleaned = raw_amount.replace(',', '')
            try:
                float(cleaned)
                return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.AMOUNT_FORMAT, severity=Severity.MEDIUM, detected_rule=f"amount '{raw_amount}' uses comma formatting; auto-parsed as {cleaned}", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.AMOUNT_FORMAT], extra={'parsed_amount': float(cleaned)})]
            except ValueError:
                pass
        return []

    def check_missing_payer(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        paid_by = str(row.get('paid_by', '')).strip()
        if not paid_by or paid_by.lower() in ['nan', 'none', '']:
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.MISSING_PAYER, severity=Severity.CRITICAL, detected_rule='paid_by column is empty or null', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.MISSING_PAYER])]
        return []

    def check_zero_amount(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        try:
            amount = self._parse_amount(row)
            if amount == 0:
                return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.ZERO_AMOUNT, severity=Severity.MEDIUM, detected_rule='amount == 0 (possible duplicate that was zeroed out)', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.ZERO_AMOUNT])]
        except (ValueError, TypeError):
            pass
        return []

    def check_negative_amount(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        try:
            amount = self._parse_amount(row)
            if amount < 0:
                return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.NEGATIVE_AMOUNT, severity=Severity.MEDIUM, detected_rule=f'amount={amount} < 0 (possible refund or cancellation)', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.NEGATIVE_AMOUNT])]
        except (ValueError, TypeError):
            pass
        return []

    def check_invalid_date(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        date_str = str(row.get('date', '')).strip()
        if not date_str or date_str.lower() in ['nan', 'none', '']:
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.INVALID_DATE, severity=Severity.HIGH, detected_rule='date column is empty', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.INVALID_DATE])]
        try:
            parsed = datetime.strptime(date_str, '%Y-%m-%d').date()
            today = date.today()
            if parsed > today:
                return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.INVALID_DATE, severity=Severity.HIGH, detected_rule=f"date '{date_str}' is in the future", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.INVALID_DATE])]
        except ValueError:
            alternative = self._try_parse_date_fallback(date_str)
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.INVALID_DATE, severity=Severity.HIGH, detected_rule=f"date '{date_str}' is not in YYYY-MM-DD format" + (f'; likely means {alternative}' if alternative else ''), raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.INVALID_DATE], extra={'suggested_date': str(alternative) if alternative else None})]
        return []

    def check_empty_description(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        desc = str(row.get('description', '')).strip()
        if not desc or desc.lower() in ['nan', 'none', '']:
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.EMPTY_DESCRIPTION, severity=Severity.LOW, detected_rule='description is empty', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.EMPTY_DESCRIPTION])]
        return []

    def check_missing_currency(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        currency = str(row.get('currency', '')).strip()
        if not currency or currency.lower() in ['nan', 'none', '']:
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.MISSING_CURRENCY, severity=Severity.HIGH, detected_rule='currency column is empty; cannot determine if conversion is needed', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.MISSING_CURRENCY])]
        return []

    def check_name_case_mismatch(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        paid_by_raw = str(row.get('paid_by', '')).strip()
        if not paid_by_raw or paid_by_raw.lower() in ['nan', 'none']:
            return []
        if paid_by_raw.lower() in self.known_members_lower and paid_by_raw not in self.known_members_raw:
            canonical = self.known_members_map.get(paid_by_raw.lower(), paid_by_raw)
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.NAME_CASE_MISMATCH, severity=Severity.LOW, detected_rule=f"paid_by='{paid_by_raw}' matches member '{canonical}' (case mismatch)", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.NAME_CASE_MISMATCH], extra={'canonical_name': canonical})]
        return []

    def check_unknown_member(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        anomalies = []
        paid_by = str(row.get('paid_by', '')).strip()
        if paid_by and paid_by.lower() not in ['nan', 'none', '']:
            if paid_by.lower() not in self.known_members_lower:
                anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.UNKNOWN_MEMBER, severity=Severity.HIGH, detected_rule=f"paid_by='{paid_by}' is not a known group member", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.UNKNOWN_MEMBER]))
        split_with = str(row.get('split_with', '')).strip()
        members = self._extract_member_names_from_split_with(split_with)
        for member in members:
            if member.lower() not in self.known_members_lower:
                anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.UNKNOWN_MEMBER, severity=Severity.HIGH, detected_rule=f"participant '{member}' in split_with is not a known group member", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.UNKNOWN_MEMBER]))
        return anomalies

    def check_settlement_as_expense(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        desc = str(row.get('description', '')).lower()
        notes = str(row.get('notes', '')).lower()
        split_type = str(row.get('split_type', '')).lower().strip()
        if split_type == 'settlement':
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.SETTLEMENT_AS_EXPENSE, severity=Severity.HIGH, detected_rule="split_type='settlement' — this is a debt payment, not an expense", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.SETTLEMENT_AS_EXPENSE])]
        combined_text = desc + ' ' + notes
        for kw in self.SETTLEMENT_KEYWORDS:
            pattern = re.compile('\\b' + re.escape(kw) + '\\b', re.IGNORECASE)
            if pattern.search(combined_text):
                return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.SETTLEMENT_AS_EXPENSE, severity=Severity.HIGH, detected_rule=f"description/notes contains settlement keyword '{kw}'", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.SETTLEMENT_AS_EXPENSE])]
        if not split_type or split_type in ['nan', 'none']:
            split_with = str(row.get('split_with', '')).strip()
            participants = self._extract_member_names_from_split_with(split_with)
            if len(participants) == 1:
                return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.SETTLEMENT_AS_EXPENSE, severity=Severity.HIGH, detected_rule=f'No split_type and only one participant ({participants[0]}); pattern matches a settlement payment', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.SETTLEMENT_AS_EXPENSE])]
        return []

    def check_currency_mismatch(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        currency = str(row.get('currency', '')).strip().upper()
        if not currency or currency in ['NAN', 'NONE']:
            return []
        if currency not in self.SUPPORTED_CURRENCIES:
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.CURRENCY_MISMATCH, severity=Severity.MEDIUM, detected_rule=f"currency '{currency}' is not supported (supported: {self.SUPPORTED_CURRENCIES})", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.CURRENCY_MISMATCH])]
        if currency != self.BASE_CURRENCY:
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.CURRENCY_MISMATCH, severity=Severity.MEDIUM, detected_rule=f'Expense is in {currency} — historical rate from frankfurter.app will be used for conversion', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.CURRENCY_MISMATCH], extra={'currency': currency, 'requires_conversion': True})]
        return []

    def check_nonstandard_split_type(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        split_type = str(row.get('split_type', '')).strip().lower()
        if not split_type or split_type in ['nan', 'none', '']:
            return []
        if split_type not in CANONICAL_SPLIT_TYPES:
            alias = SPLIT_TYPE_ALIASES.get(split_type)
            return [DetectedAnomaly(row_number=row_number, category=AnomalyCategory.NONSTANDARD_SPLIT_TYPE, severity=Severity.MEDIUM, detected_rule=f"split_type='{split_type}' is not a recognized type" + (f"; will be treated as '{alias}'" if alias else ''), raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.NONSTANDARD_SPLIT_TYPE], extra={'canonical_type': alias})]
        return []

    def check_split_mismatch(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        split_type = str(row.get('split_type', '')).lower().strip()
        split_details = str(row.get('split_details', '')).strip()
        anomalies = []
        try:
            total_amount = self._parse_amount(row)
        except (ValueError, TypeError):
            return []
        if split_type == 'percentage':
            try:
                total_pct = self._sum_value_split(split_details)
                if abs(total_pct - 100.0) > 0.01:
                    anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.SPLIT_MISMATCH, severity=Severity.HIGH, detected_rule=f'percentage split sums to {total_pct:.1f}% (must be exactly 100%)', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.SPLIT_MISMATCH], extra={'actual_sum': total_pct}))
            except Exception as e:
                anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.SPLIT_MISMATCH, severity=Severity.HIGH, detected_rule=f'could not parse percentage split_details: {e}', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.SPLIT_MISMATCH]))
        elif split_type in ['exact', 'unequal']:
            try:
                total_exact = self._sum_value_split(split_details)
                if total_exact > 0 and abs(total_exact - total_amount) > 0.01:
                    anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.SPLIT_MISMATCH, severity=Severity.HIGH, detected_rule=f'exact split sums to {total_exact:.2f} but expense amount is {total_amount:.2f}', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.SPLIT_MISMATCH]))
            except Exception:
                pass
        return anomalies

    def check_duplicate_expense(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        anomalies = []
        for i, other in enumerate(self.all_rows):
            other_row_num = i + 2
            if other_row_num == row_number:
                continue
            if str(other.get('date', '')).strip() == str(row.get('date', '')).strip() and str(other.get('description', '')).lower().strip() == str(row.get('description', '')).lower().strip() and (str(other.get('amount', '')).strip() == str(row.get('amount', '')).strip()) and (str(other.get('paid_by', '')).lower().strip() == str(row.get('paid_by', '')).lower().strip()) and (other_row_num > row_number):
                anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.DUPLICATE_EXPENSE, severity=Severity.HIGH, detected_rule=f'Exact duplicate of row {other_row_num}: same date, description, amount, paid_by', raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.DUPLICATE_EXPENSE], conflicting_row_number=other_row_num))
        return anomalies

    def check_conflicting_duplicates(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        anomalies = []
        for i, other in enumerate(self.all_rows):
            other_row_num = i + 2
            if other_row_num == row_number:
                continue
            same_date = str(other.get('date', '')).strip() == str(row.get('date', '')).strip()
            desc1 = str(row.get('description', '')).lower().strip()
            desc2 = str(other.get('description', '')).lower().strip()
            similar_desc = desc1 in desc2 or desc2 in desc1 or self._word_overlap(desc1, desc2) >= 0.5
            diff_amount = str(other.get('amount', '')).strip() != str(row.get('amount', '')).strip()
            if same_date and similar_desc and diff_amount and (other_row_num > row_number):
                anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.CONFLICTING_DUPLICATES, severity=Severity.HIGH, detected_rule=f"Near-duplicate of row {other_row_num}: same date, similar description ('{row.get('description')}' vs '{other.get('description')}'), but different amounts ({row.get('amount')} vs {other.get('amount')})", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.CONFLICTING_DUPLICATES], conflicting_row_number=other_row_num))
        return anomalies

    def check_member_not_active(self, row: dict, row_number: int) -> list[DetectedAnomaly]:
        anomalies = []
        date_str = str(row.get('date', '')).strip()
        try:
            expense_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return []
        split_with = str(row.get('split_with', '')).strip()
        members = self._extract_member_names_from_split_with(split_with)
        for member in members:
            timeline = self.member_timelines.get(member.lower())
            if not timeline:
                continue
            joined = timeline.get('joined')
            left = timeline.get('left')
            if joined and expense_date < joined:
                anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.MEMBER_NOT_ACTIVE, severity=Severity.MEDIUM, detected_rule=f"'{member}' joined on {joined} but expense date {expense_date} is before they joined", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.MEMBER_NOT_ACTIVE]))
            elif left and expense_date > left:
                anomalies.append(DetectedAnomaly(row_number=row_number, category=AnomalyCategory.MEMBER_NOT_ACTIVE, severity=Severity.MEDIUM, detected_rule=f"'{member}' left on {left} but expense date {expense_date} is after they left — STRICT policy excludes them", raw_data=row, suggested_resolution=RESOLUTION_MAP[AnomalyCategory.MEMBER_NOT_ACTIVE]))
        return anomalies

    def _parse_amount(self, row: dict) -> float:
        raw = str(row.get('amount', '0')).strip()
        cleaned = raw.replace(',', '')
        return float(cleaned)

    def _extract_member_names_from_split_with(self, split_with: str) -> list[str]:
        if not split_with or split_with.lower() in ['nan', 'none']:
            return []
        return [m.strip() for m in split_with.split(';') if m.strip()]

    def _sum_value_split(self, split_details: str) -> float:
        total = 0.0
        if not split_details or split_details.lower() in ['nan', 'none']:
            return total
        parts = [p.strip() for p in split_details.replace(';', ',').split(',') if p.strip()]
        for part in parts:
            match = re.search('(\\d+(?:\\.\\d+)?)\\s*%?$', part)
            if match:
                total += float(match.group(1))
        return total

    def _word_overlap(self, s1: str, s2: str) -> float:
        w1 = set(s1.split())
        w2 = set(s2.split())
        if not w1 or not w2:
            return 0.0
        return len(w1 & w2) / len(w1 | w2)

    def _try_parse_date_fallback(self, date_str: str) -> Optional[date]:
        formats = ['%Y-%b-%d', '%d-%b-%Y', '%d/%m/%Y', '%m/%d/%Y', '%b %d %Y']
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None