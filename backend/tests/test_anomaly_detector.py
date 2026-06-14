import pytest
from datetime import date
from app.services.anomaly_detector import AnomalyDetector, AnomalyCategory
KNOWN_MEMBERS = ['Aisha', 'Rohan', 'Priya', 'Meera', 'Sam', 'Dev']
MEMBER_TIMELINES = {'aisha': {'joined': date(2026, 2, 1), 'left': None}, 'rohan': {'joined': date(2026, 2, 1), 'left': None}, 'priya': {'joined': date(2026, 2, 1), 'left': None}, 'meera': {'joined': date(2026, 2, 1), 'left': date(2026, 3, 31)}, 'sam': {'joined': date(2026, 4, 15), 'left': None}, 'dev': {'joined': date(2026, 5, 1), 'left': date(2026, 5, 5)}}

def make_detector(rows=None):
    return AnomalyDetector(known_members=KNOWN_MEMBERS, member_timelines=MEMBER_TIMELINES, all_rows=rows or [])

def make_row(**kwargs):
    base = {'date': '2026-03-15', 'description': 'Groceries', 'amount': 1200, 'currency': 'INR', 'paid_by': 'Aisha', 'split_type': 'equal', 'split_details': 'Aisha,Rohan,Priya,Meera', 'notes': ''}
    base.update(kwargs)
    return base

def test_missing_payer_empty():
    detector = make_detector()
    row = make_row(paid_by='')
    anomalies = detector.check_missing_payer(row, 2)
    assert any((a.category == AnomalyCategory.MISSING_PAYER for a in anomalies))

def test_missing_payer_none():
    detector = make_detector()
    row = make_row(paid_by=None)
    anomalies = detector.check_missing_payer(row, 2)
    assert any((a.category == AnomalyCategory.MISSING_PAYER for a in anomalies))

def test_zero_amount_detected():
    detector = make_detector()
    row = make_row(amount=0)
    anomalies = detector.check_zero_amount(row, 2)
    assert any((a.category == AnomalyCategory.ZERO_AMOUNT for a in anomalies))

def test_positive_amount_ok():
    detector = make_detector()
    row = make_row(amount=500)
    anomalies = detector.check_zero_amount(row, 2)
    assert len(anomalies) == 0

def test_negative_amount_detected():
    detector = make_detector()
    row = make_row(amount=-200)
    anomalies = detector.check_negative_amount(row, 2)
    assert any((a.category == AnomalyCategory.NEGATIVE_AMOUNT for a in anomalies))

def test_invalid_date_format():
    detector = make_detector()
    row = make_row(date='15/03/2026')
    anomalies = detector.check_invalid_date(row, 2)
    assert any((a.category == AnomalyCategory.INVALID_DATE for a in anomalies))

def test_future_date():
    detector = make_detector()
    row = make_row(date='2099-01-01')
    anomalies = detector.check_invalid_date(row, 2)
    assert any((a.category == AnomalyCategory.INVALID_DATE for a in anomalies))

def test_valid_date_ok():
    detector = make_detector()
    row = make_row(date='2026-03-15')
    anomalies = detector.check_invalid_date(row, 2)
    assert len(anomalies) == 0

def test_unknown_payer():
    detector = make_detector()
    row = make_row(paid_by='Bob')
    anomalies = detector.check_unknown_member(row, 2)
    assert any((a.category == AnomalyCategory.UNKNOWN_MEMBER for a in anomalies))
    assert 'Bob' in anomalies[0].detected_rule

def test_unknown_in_split():
    detector = make_detector()
    row = make_row(split_with='Aisha;Bob;Priya')
    anomalies = detector.check_unknown_member(row, 2)
    assert any(('Bob' in a.detected_rule for a in anomalies))

def test_settlement_split_type():
    detector = make_detector()
    row = make_row(split_type='settlement', description='Rohan paid Aisha')
    anomalies = detector.check_settlement_as_expense(row, 2)
    assert any((a.category == AnomalyCategory.SETTLEMENT_AS_EXPENSE for a in anomalies))

def test_settlement_keyword_in_desc():
    detector = make_detector()
    row = make_row(description='Rohan paid Aisha back for dinner')
    anomalies = detector.check_settlement_as_expense(row, 2)
    assert any((a.category == AnomalyCategory.SETTLEMENT_AS_EXPENSE for a in anomalies))

def test_usd_currency_flagged():
    detector = make_detector()
    row = make_row(currency='USD', amount=150)
    anomalies = detector.check_currency_mismatch(row, 2)
    assert any((a.category == AnomalyCategory.CURRENCY_MISMATCH for a in anomalies))

def test_inr_currency_ok():
    detector = make_detector()
    row = make_row(currency='INR')
    anomalies = detector.check_currency_mismatch(row, 2)
    assert len(anomalies) == 0

def test_percentage_not_100():
    detector = make_detector()
    row = make_row(split_type='percentage', split_details='Aisha:40,Rohan:40,Priya:10', amount=1000)
    anomalies = detector.check_split_mismatch(row, 2)
    assert any((a.category == AnomalyCategory.SPLIT_MISMATCH for a in anomalies))

def test_percentage_100_ok():
    detector = make_detector()
    row = make_row(split_type='percentage', split_details='Aisha:50,Rohan:50', amount=1000)
    anomalies = detector.check_split_mismatch(row, 2)
    assert len(anomalies) == 0

def test_exact_split_mismatch():
    detector = make_detector()
    row = make_row(split_type='exact', split_details='Aisha:300,Rohan:400', amount=1000)
    anomalies = detector.check_split_mismatch(row, 2)
    assert any((a.category == AnomalyCategory.SPLIT_MISMATCH for a in anomalies))

def test_exact_duplicate_detected():
    row1 = make_row(date='2026-05-15', description='Electricity Bill', amount=850, paid_by='Sam')
    row2 = make_row(date='2026-05-15', description='Electricity Bill', amount=850, paid_by='Sam')
    all_rows = [row1, row2]
    detector = make_detector(rows=all_rows)
    anomalies = detector.check_duplicate_expense(row1, 2)
    assert any((a.category == AnomalyCategory.DUPLICATE_EXPENSE for a in anomalies))

def test_no_false_positive_duplicate():
    row1 = make_row(date='2026-05-15', description='Electricity Bill', amount=850)
    row2 = make_row(date='2026-06-15', description='Electricity Bill', amount=850)
    detector = make_detector(rows=[row1, row2])
    anomalies = detector.check_duplicate_expense(row1, 2)
    assert len(anomalies) == 0

def test_meera_included_after_leaving():
    detector = make_detector()
    row = make_row(date='2026-04-12', split_with='Aisha;Rohan;Priya;Meera')
    anomalies = detector.check_member_not_active(row, 2)
    assert any((a.category == AnomalyCategory.MEMBER_NOT_ACTIVE and 'Meera' in a.detected_rule for a in anomalies))

def test_sam_included_before_joining():
    detector = make_detector()
    row = make_row(date='2026-03-10', split_with='Aisha;Rohan;Priya;Sam')
    anomalies = detector.check_member_not_active(row, 2)
    assert any((a.category == AnomalyCategory.MEMBER_NOT_ACTIVE and 'Sam' in a.detected_rule for a in anomalies))

def test_active_member_ok():
    detector = make_detector()
    row = make_row(date='2026-03-15', split_with='Aisha;Rohan;Priya;Meera')
    anomalies = detector.check_member_not_active(row, 2)
    assert len(anomalies) == 0

def test_empty_description():
    detector = make_detector()
    row = make_row(description='')
    anomalies = detector.check_empty_description(row, 2)
    assert any((a.category == AnomalyCategory.EMPTY_DESCRIPTION for a in anomalies))